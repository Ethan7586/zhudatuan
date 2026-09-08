import { randomBytes } from 'node:crypto';
import { RUNTIME_LIMITS } from '@shop/config/runtime';
import type { TransactionManager, TransactionOptions } from '../../../../platform/database/TransactionManager';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import { PgTransactionAccess, type SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import { mapParallel } from '@shop/kernel';
import { DomainError } from '../../../../platform/error/DomainError';
import type { TaskAuthorizationPort } from '../../../access/public';
import type { ExportExecution, ExportPageRow, ExportPlan, ExportPort, ExportRenderer, ExportResult, RuntimeExportWork } from '../../../runtime/public';
import type { CredentialProtector } from '../../application/port/CredentialProtector';
import { readSearchSnapshot } from './SearchSnapshot';
import { assertExportWork } from '../../application/service/ExportAuthorization';
import { readExportPage, readExportSnapshot, type ExportPage, type CredentialPage } from './ExportSnapshot';

interface VoucherPlan extends ExportPlan {
  readonly work: RuntimeExportWork;
  readonly execution: ExportExecution;
  readonly watermark: readonly [string, unknown, unknown];
}

export class PgVoucherExportProcess implements ExportRenderer<VoucherPlan> {
  private readonly transactions = new PgTransactionAccess();

  constructor(
    private readonly manager: TransactionManager,
    private readonly exports: ExportPort,
    private readonly protector: CredentialProtector,
    private readonly maximumAttempts: number,
    private readonly authorization: TaskAuthorizationPort
  ) {
    if (!Number.isSafeInteger(maximumAttempts) || maximumAttempts < 1) throw new Error('VOUCHER_EXPORT_ATTEMPTS_INVALID');
  }

  async open(id: string, execution: ExportExecution): Promise<VoucherPlan | null> {
    const work = await this.manager.write(options(id, execution), (context) => this.exports.claim(context, id, execution.scope, 'voucher'));
    if (work === null) return null;
    return Object.freeze({
      id,
      owner: 'voucher',
      columns: Object.freeze([...header(work.kind), '导出编号', '申请人', '申请时间']),
      cursor: null,
      pageRows: RUNTIME_LIMITS.voucherExport.pageRows,
      expectedRows: null,
      maximumAttempts: this.maximumAttempts,
      work,
      execution,
      watermark: Object.freeze([work.id, work.authorization.actor, work.authorization.capturedAt]) as readonly [string, unknown, unknown],
    });
  }

  async prepare(plan: VoucherPlan): Promise<number> {
    this.assertPlan(plan);
    const snapshot = await this.manager.read(options(plan.id, plan.execution), async (context) => {
      await this.authorization.assert(context, plan.work.authorization);
      return this.snapshot(context, plan);
    });
    return snapshot.count;
  }

  async read(plan: VoucherPlan, cursor: string | null, fetch: number): Promise<readonly ExportPageRow[]> {
    available(plan.execution);
    const page = await this.manager.read(options(plan.id, plan.execution), async (context) => {
      await this.authorization.assert(context, plan.work.authorization);
      return readPage(this.transactions.database(context), plan.work, cursor, fetch);
    });
    const rendered = plan.work.kind === 'credential' ? await mapParallel(page, RUNTIME_LIMITS.voucherExport.revealConcurrency, (row) => this.reveal(plan.work, row as CredentialPage)) : page.map(({ cells }) => cells);
    available(plan.execution);
    return Object.freeze(page.map((row, index) => Object.freeze({ cursor: row.cursor, cells: Object.freeze([...(rendered[index] ?? []), ...plan.watermark]) })));
  }

  advance(): Promise<void> {
    return Promise.resolve();
  }

  async complete(plan: VoucherPlan, result: ExportResult): Promise<void> {
    await this.manager.write(options(plan.id, plan.execution), async (context) => {
      await this.authorization.assert(context, plan.work.authorization);
      const snapshot = await this.snapshot(context, plan);
      const expiry = Math.min(Date.now() + RUNTIME_LIMITS.voucherExport.downloadTtlSeconds * 1000, Date.parse(snapshot.expiresAt));
      if (expiry <= Date.now()) throw new Error('VOUCHER_EXPORT_SNAPSHOT_EXPIRED');
      await this.exports.ready(context, plan.work.id, plan.work.scope, 'voucher', {
        reference: result.object.reference,
        sha256: result.object.sha256,
        rows: result.rows,
        tokenHash: randomBytes(32).toString('hex'),
        expiresAt: new Date(expiry).toISOString(),
      });
    });
  }

  fail(plan: VoucherPlan, _code: string, terminal: boolean): Promise<void> {
    return this.manager.write(options(plan.id, plan.execution), (context) => this.exports.fail(context, plan.work.id, plan.work.scope, 'voucher', terminal));
  }

  retryable(cause: unknown): boolean {
    return !(cause instanceof DomainError && cause.code === 'AUTHORIZATION_DENIED');
  }

  private snapshot(context: ReadTransactionContext, plan: VoucherPlan): Promise<Readonly<{ count: number; expiresAt: string }>> | Readonly<{ count: number; expiresAt: string }> {
    if (plan.work.kind === 'search')
      return {
        count: integer(plan.work.snapshot.count, 'VOUCHER_EXPORT_SNAPSHOT_INVALID'),
        expiresAt: instant(plan.work.snapshot.expiresAt, 'VOUCHER_EXPORT_SNAPSHOT_INVALID'),
      };
    return readExportSnapshot(this.transactions.database(context), plan.work);
  }

  private assertPlan(plan: VoucherPlan): void {
    assertExportWork(plan.work);
    if (plan.work.id !== plan.id || plan.work.scope !== plan.execution.scope) throw new Error('VOUCHER_EXPORT_SNAPSHOT_INVALID');
  }

  private async reveal(work: RuntimeExportWork, row: CredentialPage): Promise<readonly unknown[]> {
    const binding = Object.freeze({ scope: work.scope, pool: row.pool, credential: row.credential });
    const [number, secret] = await Promise.all([this.protector.reveal(row.numberCiphertext, 'number', binding), this.protector.reveal(row.secretCiphertext, 'secret', binding)]);
    return Object.freeze([row.cells[0], number, secret, ...row.cells.slice(1)]);
  }
}

async function readPage(database: SqlExecutor, work: RuntimeExportWork, cursor: string | null, limit: number): Promise<readonly ExportPage[]> {
  if (work.kind === 'credential' || work.kind === 'issueorder' || work.kind === 'action') return readExportPage(database, work, cursor, limit);
  if (work.kind === 'search') return searchPage(database, work, cursor, limit);
  throw new Error('VOUCHER_EXPORT_KIND_UNSUPPORTED');
}

async function searchPage(database: SqlExecutor, work: RuntimeExportWork, cursor: string | null, limit: number): Promise<readonly ExportPage[]> {
  const snapshot = text(work.snapshot.snapshot, 'VOUCHER_EXPORT_SNAPSHOT_REQUIRED');
  const evidence = await readSearchSnapshot(database, work.scope, snapshot, text(work.authorization.actor, 'VOUCHER_EXPORT_ACTOR_REQUIRED'), new Date());
  if (evidence.filterHash !== work.snapshot.filterHash || evidence.watermark !== work.snapshot.watermark || evidence.count !== work.snapshot.count || evidence.expiresAt !== work.snapshot.expiresAt)
    throw new Error('VOUCHER_EXPORT_SNAPSHOT_INVALID');
  const result = await database.query<{
    ordinal: number;
    id: string;
    masked: string;
    product: string;
    holder: string | null;
    remaining: number;
    currency: string;
    state: string;
    starts: Date;
    expires: Date;
    version: number;
  }>(
    `select item.ordinal::integer,item.voucher_id id,item.number_masked masked,item.product_id product,item.member_id holder,
      item.remaining_minor::integer remaining,item.currency,item.state,item.starts_at starts,item.expires_at expires,item.voucher_version::integer version
     from voucher.searchsnapshotitem item
     where item.snapshot_id=$1 and item.scope_id=$2 and ($3::bigint is null or item.ordinal>$3) order by item.ordinal limit $4`,
    [snapshot, work.scope, cursor ? Number(cursor) : null, limit]
  );
  return Object.freeze(
    result.rows.map((row) =>
      Object.freeze({
        cursor: String(row.ordinal),
        cells: Object.freeze([row.id, row.masked, row.product, row.holder, row.remaining, row.currency, row.state, new Date(row.starts).toISOString(), new Date(row.expires).toISOString(), row.version]),
      })
    )
  );
}

function header(kind: string): readonly string[] {
  if (kind === 'credential') return ['凭证ID', '卡号', '密钥', '卡号库', '产品', '状态', '密钥版本', '创建时间'];
  if (kind === 'issueorder') return ['序号', '批次', '状态', '凭证ID', '卡券ID', '卡号尾号', '错误码', '更新时间'];
  if (kind === 'action') return ['卡券ID', '状态', '原状态', '新状态', '错误码', '可重试', '更新时间'];
  if (kind === 'search') return ['卡券ID', '卡号尾号', '产品', '持有人', '余额分', '币种', '状态', '生效时间', '过期时间', '版本'];
  return ['无效导出'];
}

function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(code);
  return value.trim();
}
function instant(value: unknown, code: string): string {
  const result = text(value, code);
  if (Number.isNaN(Date.parse(result))) throw new Error(code);
  return result;
}
function integer(value: unknown, code: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error(code);
  return value as number;
}
function available(execution: Pick<ExportExecution, 'signal' | 'deadline'>): void {
  if (execution.signal.aborted) throw execution.signal.reason ?? new Error('VOUCHER_EXPORT_ABORTED');
  if (Date.now() >= execution.deadline) throw new Error('DEADLINE_EXCEEDED');
}
function options(id: string, execution: ExportExecution): TransactionOptions {
  return { tenant: execution.scope, membership: '', scope: execution.scope, actor: 'system:voucher', trace: execution.trace || id, operation: 'job.voucher.export', workload: 'jobs', signal: execution.signal, deadline: execution.deadline };
}
