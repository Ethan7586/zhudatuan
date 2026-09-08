import { createHash, randomBytes } from 'node:crypto';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { CredentialGenerateWork } from '../../application/process/CredentialGenerateProcess';
import type { CredentialProtector, ProtectedCredential } from '../../application/port/CredentialProtector';
import type { JobPort } from '../../../runtime/public';
import type { TransactionManager, TransactionOptions } from '../../../../platform/database/TransactionManager';
import { mapParallel } from '@shop/kernel';

interface PoolRow {
  readonly prefix: string;
  readonly product_id: string;
  readonly generated: number;
  readonly state: string;
  readonly mode: string;
}

interface CredentialInput {
  readonly id: string;
  readonly number: ProtectedCredential;
  readonly secret: ProtectedCredential;
}

const CHUNK_SIZE = 250;
const ENCRYPTION_CONCURRENCY = 16;

export class PgCredentialGenerateProcess implements CredentialGenerateWork {
  private readonly transactions = new PgTransactionAccess();

  constructor(
    private readonly manager: TransactionManager,
    private readonly protector: CredentialProtector,
    private readonly jobs: JobPort
  ) {}

  async generate(input: Parameters<CredentialGenerateWork['generate']>[0]): Promise<void> {
    const pool = await this.manager.read(options(input, 'readpool'), async (context) => {
      const found = await this.transactions.database(context).query<PoolRow>(`select prefix,product_id,generated::integer,state,mode from voucher.credentialpool where id=$1 and scope_id=$2`, [input.pool, input.scope]);
      return found.rows[0] ?? null;
    });
    if (!pool || pool.mode !== 'generated') throw new Error('VOUCHER_CREDENTIAL_POOL_INVALID');
    if (pool.generated < input.start + input.count - 1) throw new Error('VOUCHER_CREDENTIAL_RESERVATION_INVALID');

    const progress = await this.manager.read(options(input, 'readprogress'), (context) => this.jobs.read(context, input.job, input.scope, 'voucher'));
    let processed = Math.min(progress?.processed ?? 0, input.count);
    while (processed < input.count) {
      available(input);
      const ordinals = Array.from({ length: Math.min(CHUNK_SIZE, input.count - processed) }, (_, index) => processed + index + 1);
      const candidates = ordinals.map((offset) => ({ id: credentialId(input.scope, input.pool, input.start + offset - 1), offset }));
      const existing = await this.manager.read(options(input, `existing:${processed}`), async (context) => {
        const result = await this.transactions.database(context).query<{ id: string }>(`select id from voucher.credential where scope_id=$1 and id=any($2::text[])`, [input.scope, candidates.map(({ id }) => id)]);
        return new Set(result.rows.map(({ id }) => id));
      });
      const encrypted = await mapParallel(
        candidates.filter(({ id }) => !existing.has(id)),
        ENCRYPTION_CONCURRENCY,
        async ({ id, offset }) => {
          available(input);
          const binding = Object.freeze({ scope: input.scope, pool: input.pool, credential: id });
          const [number, secret] = await Promise.all([this.protector.protect(numberValue(pool.prefix, input.job, offset), 'number', binding), this.protector.protect(randomBytes(32).toString('hex'), 'secret', binding)]);
          return Object.freeze({ id, number, secret });
        }
      );
      processed = await this.manager.write(options(input, `persist:${processed}`), async (context) => {
        const database = this.transactions.database(context);
        if (encrypted.length > 0) await insertCredentials(database, input, pool.product_id, encrypted);
        const count = await database.query<{ count: number }>(`select count(*)::integer count from voucher.credential where scope_id=$1 and id=any($2::text[]) and state in('available','allocated')`, [
          input.scope,
          candidates.map(({ id }) => id),
        ]);
        if ((count.rows[0]?.count ?? 0) !== candidates.length) throw new Error('VOUCHER_CREDENTIAL_CHUNK_INCOMPLETE');
        const next = ordinals.at(-1)!;
        await this.jobs.progress(context, input.job, input.scope, 'voucher', { total: input.count, processed: next, succeeded: next, failed: 0, retryable: 0 });
        return next;
      });
    }
  }
}

async function insertCredentials(database: ReturnType<PgTransactionAccess['database']>, input: Parameters<CredentialGenerateWork['generate']>[0], product: string, credentials: readonly CredentialInput[]): Promise<void> {
  const rows = credentials.map(({ id, number, secret }) => ({
    id,
    numberCiphertext: number.ciphertext,
    secretCiphertext: secret.ciphertext,
    numberFingerprint: number.fingerprint,
    secretFingerprint: secret.fingerprint,
    numberMasked: number.masked,
    keyVersion: `${number.keyVersion}:${secret.keyVersion}`,
  }));
  await database.query(
    `insert into voucher.credential(id,scope_id,pool_id,product_id,number_ciphertext,secret_ciphertext,number_fingerprint,
       secret_fingerprint,number_masked,key_version,state,issue_batch_id,version,created_at,updated_at)
     select item.id,$1,$2,$3,item."numberCiphertext",item."secretCiphertext",item."numberFingerprint",
       item."secretFingerprint",item."numberMasked",item."keyVersion",'generated',null,1,clock_timestamp(),clock_timestamp()
     from jsonb_to_recordset($4::jsonb) item(id text,"numberCiphertext" text,"secretCiphertext" text,"numberFingerprint" text,
       "secretFingerprint" text,"numberMasked" text,"keyVersion" text)
     on conflict(id) do nothing`,
    [input.scope, input.pool, product, JSON.stringify(rows)]
  );
  await database.query(
    `update voucher.credential set state='available',version=version+1
     where scope_id=$1 and id=any($2::text[]) and state='generated'`,
    [input.scope, rows.map(({ id }) => id)]
  );
}

function credentialId(scope: string, pool: string, offset: number): string {
  return `credential:${createHash('sha256').update(`${scope}\u0000${pool}\u0000${offset}`).digest('hex').slice(0, 32)}`;
}

function numberValue(prefix: string, job: string, offset: number): string {
  return `${prefix}${createHash('sha256').update(`${job}\u0000${offset}`).digest('hex').slice(0, 24).toUpperCase()}`;
}

function options(input: Parameters<CredentialGenerateWork['generate']>[0], action: string): TransactionOptions {
  return { tenant: input.scope, membership: '', scope: input.scope, actor: 'system:voucher', trace: input.job, operation: `job.voucher.credentialgenerate.${action}`, workload: 'jobs', signal: input.signal, deadline: input.deadline };
}

function available(input: Parameters<CredentialGenerateWork['generate']>[0]): void {
  if (input.signal.aborted) throw input.signal.reason ?? new Error('VOUCHER_GENERATION_ABORTED');
  if (Date.now() >= input.deadline) throw new Error('DEADLINE_EXCEEDED');
}
