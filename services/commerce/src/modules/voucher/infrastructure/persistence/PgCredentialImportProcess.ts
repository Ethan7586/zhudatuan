import { createHash } from 'node:crypto';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { TransactionManager } from '../../../../foundation/persistence/TransactionManager';
import type { TaskAuthorizationPort } from '../../../access/public/TaskAuthorizationPort';
import type { BatchImportProcessPort, ImportBatchFactoryPort, ImportPort, ImportTarget, JobPort } from '../../../runtime/public';
import type { CredentialProtector } from '../../application/port/CredentialProtector';
import { Credential } from '../../domain/model/Credential';
import { CredentialSecret } from '../../domain/value/CredentialSecret';
import { VoucherNumber } from '../../domain/value/VoucherNumber';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import { mapParallel } from '../../../../foundation/performance/Parallel';

export function createCredentialImportProcess(factory: ImportBatchFactoryPort, manager: TransactionManager, runtime: ImportPort, jobs: JobPort,
  protector: Pick<CredentialProtector, 'protect'>, authorization: TaskAuthorizationPort): BatchImportProcessPort {
  const transactions = new PgTransactionAccess();
  return factory.create({
    owner: 'voucher', failure: 'VOUCHER_CREDENTIAL_IMPORT_FAILED', transactions: manager, runtime, authorization, concurrency: 8,
    prepare: async (target, rows) => {
      const prepared = await mapParallel(rows, 8, async ({ row, value }) => {
        const payload = await prepareCredential(protector, target, row, value);
        return Object.freeze({ row, payload });
      });
      const failures = prepared.flatMap(({ row, payload }) => payload.invalid
        ? [Object.freeze({ row, reason: payload.invalid, field: null, detail: '卡券号或密钥格式不正确' })] : []);
      return Object.freeze({ rows: Object.freeze(prepared), failures: Object.freeze(failures) });
    },
    write: (context, target, row, value) => importCredential(transactions, context, target, row, value),
    continue: (context, target, sequence) => jobs.create(context, {
      scope: target.scope, owner: 'voucher', kind: 'credentialimport', queue: 'import', payload: Object.freeze({ import: target.id }),
      idempotency: `${target.id}:${sequence}`, actor: 'system:voucher',
    }).then(() => undefined),
  });
}

async function prepareCredential(protector: Pick<CredentialProtector, 'protect'>, target: ImportTarget, row: number, value: Readonly<Record<string, string>>): Promise<Readonly<Record<string, string>>> {
  let number: string;
  let secret: string;
  try {
    number = new VoucherNumber(value.number ?? '').value;
    secret = new CredentialSecret(value.secret ?? '').value;
  } catch (cause) {
    if (cause instanceof DomainError) return Object.freeze({ invalid: cause.code });
    throw cause;
  }
  const binding = Object.freeze({ scope: target.scope, pool: text(target.metadata?.pool, 'VOUCHER_CREDENTIAL_POOL_REQUIRED'), credential: credentialId(target.id, row) });
  const [protectedNumber, protectedSecret] = await Promise.all([
    protector.protect(number, 'number', binding), protector.protect(secret, 'secret', binding),
  ]);
  return Object.freeze({ numberCiphertext: protectedNumber.ciphertext, secretCiphertext: protectedSecret.ciphertext,
    numberFingerprint: protectedNumber.fingerprint, secretFingerprint: protectedSecret.fingerprint,
    numberMasked: protectedNumber.masked, keyVersion: `${protectedNumber.keyVersion}:${protectedSecret.keyVersion}` });
}

async function importCredential(
  transactions: PgTransactionAccess,
  context: WriteTransactionContext,
  target: Readonly<{ id: string; scope: string; metadata?: Readonly<Record<string, unknown>> }>,
  row: number,
  value: Readonly<Record<string, string>>
): Promise<void> {
  if (value.invalid) throw new Error(/^[A-Z_]{1,100}$/.test(value.invalid) ? value.invalid : 'VOUCHER_CREDENTIAL_IMPORT_FAILED');
  const pool = text(target.metadata?.pool, 'VOUCHER_CREDENTIAL_POOL_REQUIRED');
  const id = credentialId(target.id, row);
  const database = transactions.database(context);
  const existing = await database.query(`select 1 from voucher.credential where id=$1 and scope_id=$2`, [id, target.scope]);
  if (existing.rows[0]) return;
  const selected = await database.query<{ product_id: string; state: string; mode: string }>(
    `select product_id,state,mode from voucher.credentialpool where id=$1 and scope_id=$2`, [pool, target.scope]
  );
  const source = selected.rows[0];
  if (!source || source.mode !== 'imported' || source.state !== 'open') throw new Error('VOUCHER_POOL_CLOSED');
  const credential = new Credential({ id, pool, product: source.product_id, fingerprint: text(value.numberFingerprint, 'VOUCHER_CREDENTIAL_CONFLICT'),
    keyVersion: text(value.keyVersion, 'VOUCHER_CREDENTIAL_CONFLICT'), state: 'generated', issueBatch: null, version: 1 });
  const ready = credential.available();
  if (!value.numberCiphertext || !value.secretCiphertext || !/^[a-f0-9]{64}$/.test(value.secretFingerprint ?? '')) throw new Error('VOUCHER_CREDENTIAL_CONFLICT');
  try {
    const reserved = await database.query<{ product_id: string }>(
      `update voucher.credentialpool set generated=generated+1,version=version+1
       where id=$1 and scope_id=$2 and mode='imported' and state='open' and generated<capacity returning product_id`, [pool, target.scope]
    );
    if (!reserved.rows[0]) throw new Error('VOUCHER_STOCK_INSUFFICIENT');
    await database.query(
      `insert into voucher.credential(id,scope_id,pool_id,product_id,number_ciphertext,secret_ciphertext,number_fingerprint,
       secret_fingerprint,number_masked,key_version,state,issue_batch_id,version,created_at,updated_at)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'generated',null,1,clock_timestamp(),clock_timestamp())`,
      [id, target.scope, pool, reserved.rows[0].product_id, value.numberCiphertext, value.secretCiphertext, credential.value.fingerprint,
        value.secretFingerprint, value.numberMasked, credential.value.keyVersion]
    );
    await database.query(`update voucher.credential set state=$3,version=$4 where id=$1 and scope_id=$2 and state='generated'`, [id, target.scope, ready.value.state, ready.value.version]);
  } catch (cause) {
    if (cause !== null && typeof cause === 'object' && Reflect.get(cause, 'code') === '23505') throw new Error('VOUCHER_CREDENTIAL_DUPLICATE');
    throw cause;
  }
}

function credentialId(target: string, row: number): string {
  return `credential:${createHash('sha256').update(`${target}\u0000${row}`).digest('hex').slice(0, 32)}`;
}

function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(code);
  return value.trim();
}
