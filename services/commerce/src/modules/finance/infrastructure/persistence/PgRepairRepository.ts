import { createHash } from 'node:crypto';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { FinanceEntryTemplate } from '../../domain/model/FinancePolicy';
import type { RepairDifference } from '../../domain/model/RepairCase';
import type { RepairRepository } from '../../domain/repository/RepairRepository';
import { DomainError } from '../../../../foundation/domain/DomainError';

const projection = `repair.id,repair.statement_id "statementId",repair.status,repair.source_hash "sourceHash",
repair.preview_hash "previewHash",repair.differences,repair.entries,repair.maker_id "makerId",repair.checker_id "checkerId",
repair.reason,repair.version,repair.created_at "createdAt",repair.updated_at "updatedAt"`;
interface RepairState {
  readonly status: string;
  readonly maker_id: string;
  readonly version: number;
}

export class PgRepairRepository implements RepairRepository {
  constructor(private readonly database: OperationDatabase) {}

  read(scopeIds: readonly string[], status: string | null, statementId: string | null, cursor: string | null, limit: number) {
    return this.database.query(
      `select ${projection} from finance.repair repair where repair.scope_id=any($1::text[])
      and ($2::text is null or repair.status=$2) and ($3::text is null or repair.statement_id=$3)
      and ($4::text is null or repair.id>$4) order by repair.id limit $5`,
      [scopeIds, status, statementId, cursor, limit]
    );
  }

  async statement(scopeId: string, statementId: string): Promise<Readonly<{ id: string; hash: string; version: number; differences: readonly RepairDifference[] }> | null> {
    const result = await this.database.query<{ id: string; hash: string; version: number; debit_minor: number; credit_minor: number; currency: string }>(
      `select id,coalesce(sha256,encode(public.digest(id||':'||debit_minor||':'||credit_minor||':'||closing_minor,'sha256'),'hex')) hash,
      version,debit_minor::float8 debit_minor,credit_minor::float8 credit_minor,currency from finance.statement
      where id=$1 and scope_id=$2 and state in('draft','final') for share`,
      [statementId, scopeId]
    );
    const row = result.rows[0];
    if (!row) return null;
    const difference = Object.freeze({
      id: `reconciliationdifference:${digest(`${row.id}:balance`)}`,
      kind: 'statementbalance',
      expectedMinor: row.credit_minor,
      actualMinor: row.debit_minor,
      deltaMinor: row.debit_minor - row.credit_minor,
      currency: row.currency,
    });
    return Object.freeze({ id: row.id, hash: row.hash, version: row.version, differences: Object.freeze([difference]) });
  }

  async savePreview(
    input: Readonly<{
      tokenHash: string;
      scopeId: string;
      statementId: string;
      sourceHash: string;
      sourceVersion: number;
      previewHash: string;
      entries: readonly FinanceEntryTemplate[];
      differences: readonly RepairDifference[];
      makerId: string;
      reason: string;
      expiresAt: string;
    }>
  ): Promise<void> {
    const result = await this.database.query(
      `insert into finance.repairpreview(token_hash,scope_id,statement_id,source_hash,source_version,preview_hash,
      entries,differences,maker_id,reason,expires_at,created_at) values($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,clock_timestamp())
      on conflict(token_hash) do nothing returning token_hash`,
      [input.tokenHash, input.scopeId, input.statementId, input.sourceHash, input.sourceVersion, input.previewHash, JSON.stringify(input.entries), JSON.stringify(input.differences), input.makerId, input.reason, input.expiresAt]
    );
    if (!result.rows[0]) throw new DomainError('FINANCE_REPAIR_CONFLICT');
  }

  submit(input: Readonly<{ id: string; tokenHash: string; scopeId: string; makerId: string; previewHash: string; sourceVersion: number; reason: string }>) {
    return this.database.query(
      `with preview as (
        delete from finance.repairpreview preview using finance.statement statement
        where preview.token_hash=$1 and preview.scope_id=$2 and preview.maker_id=$3 and preview.preview_hash=$4
          and preview.source_version=$5 and preview.expires_at>clock_timestamp() and statement.id=preview.statement_id
          and statement.scope_id=preview.scope_id and statement.version=preview.source_version
          and coalesce(statement.sha256,encode(public.digest(statement.id||':'||statement.debit_minor||':'||statement.credit_minor||':'||statement.closing_minor,'sha256'),'hex'))=preview.source_hash
        returning preview.*
      ), created as (
        insert into finance.repair(id,scope_id,statement_id,status,source_hash,source_version,preview_hash,differences,
          entries,maker_id,checker_id,reason,version,created_at,updated_at)
        select $6,$2,statement_id,'submitted',source_hash,source_version,preview_hash,differences,entries,$3,null,$7,1,clock_timestamp(),clock_timestamp()
        from preview returning *
      ) select ${projection} from created repair`,
      [input.tokenHash, input.scopeId, input.makerId, input.previewHash, input.sourceVersion, input.id, input.reason]
    );
  }

  async decide(input: Readonly<{ id: string; scopeId: string; checkerId: string; decision: 'approved' | 'rejected'; expectedVersion: number; reason: string }>) {
    const current = await this.lock(input.id, input.scopeId);
    if (current.status !== 'submitted') throw new DomainError('FINANCE_REPAIR_ALREADY_DECIDED');
    if (current.maker_id === input.checkerId) throw new DomainError('MAKER_CHECKER_SEPARATION_REQUIRED');
    if (current.version !== input.expectedVersion) throw new DomainError('VERSION_CONFLICT');
    if (input.decision === 'approved') {
      await this.database.query(`select finance.approve_repair($1,$2,$3,$4,$5)`, [input.id, input.scopeId, input.checkerId, input.expectedVersion, input.reason]);
      return this.database.query(`select ${projection} from finance.repair repair where repair.id=$1 and repair.scope_id=$2`, [input.id, input.scopeId]);
    }
    return this.database.query(
      `with changed as (
        update finance.repair set status=$4,checker_id=$3,reason=$6,version=version+1,updated_at=clock_timestamp()
        where id=$1 and scope_id=$2 and status='submitted' and maker_id<>$3 and version=$5 returning *
      ), movement as (
        insert into finance.repairmovement(id,movement_key,repair_id,scope_id,previous_status,next_status,actor_id,reason,created_at)
        select 'repairmovement:'||encode(public.digest(id||':'||version,'sha256'),'hex'),'repair:'||id||':'||status||':'||version,
          id,scope_id,'submitted',status,$3,$6,clock_timestamp()
        from changed returning repair_id
      ) select ${projection} from changed repair join movement on movement.repair_id=repair.id`,
      [input.id, input.scopeId, input.checkerId, input.decision, input.expectedVersion, input.reason]
    );
  }

  async reverse(input: Readonly<{ id: string; scopeId: string; checkerId: string; expectedVersion: number; reason: string }>) {
    const current = await this.lock(input.id, input.scopeId);
    if (current.status !== 'approved') throw new DomainError(current.status === 'reversed' ? 'FINANCE_REPAIR_ALREADY_DECIDED' : 'FINANCE_REPAIR_CONFLICT');
    if (current.maker_id === input.checkerId) throw new DomainError('MAKER_CHECKER_SEPARATION_REQUIRED');
    if (current.version !== input.expectedVersion) throw new DomainError('VERSION_CONFLICT');
    await this.database.query(`select finance.reverse_repair($1,$2,$3,$4,$5)`, [input.id, input.scopeId, input.checkerId, input.expectedVersion, input.reason]);
    return this.database.query(`select ${projection} from finance.repair repair where repair.id=$1 and repair.scope_id=$2`, [input.id, input.scopeId]);
  }

  private async lock(id: string, scopeId: string): Promise<RepairState> {
    const result = await this.database.query<RepairState>('select status,maker_id,version from finance.repair where id=$1 and scope_id=$2 for update', [id, scopeId]);
    const row = result.rows[0];
    if (!row) throw new DomainError('FINANCE_REPAIR_CONFLICT');
    return row;
  }
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
