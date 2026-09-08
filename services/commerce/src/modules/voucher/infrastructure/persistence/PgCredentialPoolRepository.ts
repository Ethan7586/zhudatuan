import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { DomainError } from '../../../../platform/error/DomainError';
import type { CredentialPoolRepository } from '../../application/port/CredentialPoolRepository';
import { CredentialPool } from '../../domain/model/CredentialPool';
import { body, cursor, entity, expected, limit, number, one, optionalText, page, path, POOL, query, text } from './VoucherSupport';

export class PgCredentialPoolRepository implements CredentialPoolRepository {
  constructor(private readonly transactions = new PgTransactionAccess()) {}
  async create(call: Parameters<CredentialPoolRepository['create']>[0]) {
    const database = this.transactions.database(call.context.transaction);
    const value = body(call);
    const product = text(value.product, 'product');
    const mode = value.mode === 'imported' ? 'imported' : value.mode === 'generated' ? 'generated' : null;
    if (!mode) throw new DomainError('VALIDATION_FAILED', { field: 'mode' });
    const aggregate = new CredentialPool({
      id: entity('credentialpool'),
      scope: call.scope,
      product,
      name: text(value.name, 'name'),
      mode,
      prefix: text(value.prefix, 'prefix').toUpperCase(),
      capacity: Number(value.capacity),
      generated: 0,
      state: 'open',
      version: 1,
    });
    const locked = await database.query(`select id,pool_id from voucher.product where id=$1 and scope_id=$2 for update`, [product, call.scope]);
    if (!locked.rows[0]) throw new DomainError('RESOURCE_NOT_FOUND');
    if (locked.rows[0].pool_id) throw new DomainError('VOUCHER_CREDENTIAL_CONFLICT');
    await database.query(
      `insert into voucher.credentialpool(id,number,scope_id,product_id,name,mode,prefix,capacity,generated,state,version,created_at,updated_at)
      values($1,$2,$3,$4,$5,$6,$7,$8,0,'open',1,$9,$9)`,
      [aggregate.value.id, number('CP'), call.scope, product, aggregate.value.name, mode, aggregate.value.prefix, aggregate.value.capacity, call.now]
    );
    const changed = await database.query(`update voucher.product set pool_id=$3,version=version+1 where id=$1 and scope_id=$2 returning version::integer`, [product, call.scope, aggregate.value.id]);
    if (changed.rowCount !== 1) throw new DomainError('VERSION_CONFLICT');
    return this.read(call, aggregate.value.id, 201, 'voucher.credentialpools.create');
  }
  async close(call: Parameters<CredentialPoolRepository['close']>[0]) {
    const database = this.transactions.database(call.context.transaction);
    const id = path(call, 'poolid');
    const result = await database.query(`update voucher.credentialpool set state='closed',version=version+1 where id=$1 and scope_id=$2 and version=$3 and state='open' returning id`, [id, call.scope, expected(call)]);
    if (!result.rows[0]) await conflict(database, id, call.scope);
    return this.read(call, id, 200, 'voucher.credentialpools.close');
  }
  async get(call: Parameters<CredentialPoolRepository['get']>[0]) {
    return this.read(call, path(call, 'poolid'), 200, 'voucher.credentialpools.get');
  }
  async list(call: Parameters<CredentialPoolRepository['list']>[0]) {
    const database = this.transactions.database(call.context.transaction);
    const filter = query(call);
    const fetch = limit(filter.limit);
    const rows = await database.query(
      `${POOL} where pool.scope_id=$1 and ($2::text is null or pool.product_id=$2) and ($3::text is null or pool.state=$3)
      and ($4::text is null or pool.id>$4) group by pool.id order by pool.id limit $5`,
      [call.scope, optionalText(filter.product), optionalText(filter.state), cursor(filter.cursor), fetch + 1]
    );
    return page<'voucher.credentialpools.list'>(rows.rows, fetch);
  }
  private async read(call: Parameters<CredentialPoolRepository[keyof CredentialPoolRepository]>[0], id: string, status: number, operation: 'voucher.credentialpools.create' | 'voucher.credentialpools.close' | 'voucher.credentialpools.get') {
    const row = await this.transactions.database(call.context.transaction).query(`${POOL} where pool.id=$1 and pool.scope_id=$2 group by pool.id`, [id, call.scope]);
    return one<typeof operation>(status, row.rows[0]);
  }
}
async function conflict(database: ReturnType<PgTransactionAccess['database']>, id: string, scope: string): Promise<never> {
  const exists = await database.query(`select 1 from voucher.credentialpool where id=$1 and scope_id=$2`, [id, scope]);
  throw new DomainError(exists.rows[0] ? 'VERSION_CONFLICT' : 'RESOURCE_NOT_FOUND');
}
