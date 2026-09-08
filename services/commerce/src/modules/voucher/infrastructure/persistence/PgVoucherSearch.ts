import { createHash, randomUUID } from 'node:crypto';
import { CAPACITY_MODEL, RUNTIME_LIMITS } from '@shop/config/runtime';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { DomainError } from '../../../../platform/error/DomainError';
import type { SearchFilter } from '../../application/port/SearchFilter';
import type { VoucherSearch } from '../../application/port/VoucherSearch';
import { cursor, limit, normalize, page, query, type RecordValue, VOUCHER } from './VoucherSupport';

export class PgVoucherSearch implements VoucherSearch {
  constructor(private readonly transactions = new PgTransactionAccess()) {}
  async read(call: Parameters<VoucherSearch['read']>[0], prepared: SearchFilter) {
    const database = this.transactions.database(call.context.transaction);
    const filter = query(call);
    const fetch = limit(filter.limit);
    const built = this.filter(call, prepared);
    const rows = await database.query(
      `${VOUCHER} join voucher.credential searchcredential on searchcredential.id=voucher.credential_id
      ${built.where} and ($${built.values.length + 1}::text is null or voucher.id>$${built.values.length + 1}) order by voucher.id limit $${built.values.length + 2}`,
      [...built.values, cursor(filter.cursor), fetch + 1]
    );
    return page<'voucher.search.read'>(rows.rows, fetch);
  }
  async facets(call: Parameters<VoucherSearch['facets']>[0], prepared: SearchFilter) {
    const database = this.transactions.database(call.context.transaction);
    const built = this.filter(call, prepared);
    const rows = await database.query<{ states: unknown; products: unknown; pools: unknown }>(
      `with filtered as materialized(
      select voucher.state,voucher.product_id,searchcredential.pool_id from voucher.voucher voucher
      left join voucher.holder holder on holder.id=voucher.holder_id and holder.state='bound'
      join voucher.credential searchcredential on searchcredential.id=voucher.credential_id ${built.where}
    ) select
      coalesce((select jsonb_agg(jsonb_build_object('value',state,'count',count) order by state) from(select state,count(*)::integer count from filtered group by state) item),'[]') states,
      coalesce((select jsonb_agg(jsonb_build_object('value',product_id,'count',count) order by product_id) from(select product_id,count(*)::integer count from filtered group by product_id) item),'[]') products,
      coalesce((select jsonb_agg(jsonb_build_object('value',pool_id,'count',count) order by pool_id) from(select pool_id,count(*)::integer count from filtered group by pool_id) item),'[]') pools`,
      built.values
    );
    return { status: 200, body: normalize({ ...(rows.rows[0] ?? { states: [], products: [], pools: [] }), watermark: call.now.toISOString() }) } as Awaited<ReturnType<VoucherSearch['facets']>>;
  }
  async snapshot(call: Parameters<VoucherSearch['snapshot']>[0], prepared: SearchFilter) {
    const database = this.transactions.database(call.context.transaction);
    const filter = { ...prepared.criteria, query: prepared.fingerprint ? null : prepared.query, fingerprint: prepared.fingerprint };
    const built = this.filter(call, prepared);
    const id = `searchsnapshot:${randomUUID()}`;
    const filterHash = createHash('sha256').update(canonical(filter)).digest('hex');
    const expiresAt = new Date(call.now.getTime() + RUNTIME_LIMITS.voucherExport.snapshotTtlSeconds * 1000);
    await database.query(`insert into voucher.searchsnapshot(id,scope_id,filter,filter_hash,watermark,result_count,expires_at,created_by,created_at) values($1,$2,$3::jsonb,$4,$5,0,$6,$7,$5)`, [
      id,
      call.scope,
      JSON.stringify(filter),
      filterHash,
      call.now,
      expiresAt,
      call.actor,
    ]);
    // Copy inside PostgreSQL under the same transaction snapshot; do not transfer a
    // million IDs or read mutable voucher fields later when rendering the export.
    const selected = await database.query(
      `insert into voucher.searchsnapshotitem(snapshot_id,scope_id,voucher_id,ordinal,
      number_masked,product_id,member_id,remaining_minor,currency,state,starts_at,expires_at,voucher_version)
      select $${built.values.length + 2},$1,item.id,row_number() over(order by item.id),item.number_masked,item.product_id,item.member_id,
        item.remaining_minor,item.currency,item.state,item.starts_at,item.expires_at,item.version
      from (select voucher.id,voucher.number_masked,voucher.product_id,holder.member_id,voucher.remaining_minor,voucher.currency,
        voucher.state,voucher.starts_at,voucher.expires_at,voucher.version from voucher.voucher voucher
        left join voucher.holder holder on holder.id=voucher.holder_id and holder.state='bound'
        join voucher.credential searchcredential on searchcredential.id=voucher.credential_id
        ${built.where} and voucher.updated_at<=$${built.values.length + 1} order by voucher.id limit $${built.values.length + 3}) item`,
      [...built.values, call.now, id, CAPACITY_MODEL.voucherBatch + 1]
    );
    const count = selected.rowCount;
    if (count === null || count > CAPACITY_MODEL.voucherBatch) throw new DomainError('VALIDATION_FAILED', { field: 'filter', reason: 'snapshotlimit' });
    await database.query(`update voucher.searchsnapshot set result_count=$3 where id=$1 and scope_id=$2`, [id, call.scope, count]);
    return { status: 201, body: { id, filterHash, watermark: call.now.toISOString(), count, expiresAt: expiresAt.toISOString(), createdAt: call.now.toISOString() } };
  }
  private filter(call: SearchCall, prepared: SearchFilter) {
    const source = prepared.criteria;
    const values: unknown[] = [call.scope];
    const terms = ['voucher.scope_id=$1'];
    if (ownOnly(call.target)) {
      values.push(call.member);
      terms.push(`holder.member_id=$${values.length}`);
    }
    const add = (column: string, value: unknown) => {
      if (typeof value === 'string' && value !== '') {
        values.push(value);
        terms.push(`${column}=$${values.length}`);
      }
    };
    add('voucher.product_id', source.product);
    add('searchcredential.pool_id', source.pool);
    add('holder.member_id', source.holder);
    add('voucher.state', source.state);
    if (typeof source.customer === 'string' && source.customer !== '') {
      values.push(source.customer);
      terms.push(`exists(select 1 from voucher.product product where product.id=voucher.product_id and product.customer_id=$${values.length})`);
    }
    if (typeof source.expiresBefore === 'string') {
      values.push(source.expiresBefore);
      terms.push(`voucher.expires_at<$${values.length}::timestamptz`);
    }
    if (typeof source.expiresAfter === 'string') {
      values.push(source.expiresAfter);
      terms.push(`voucher.expires_at>$${values.length}::timestamptz`);
    }
    if (prepared.query) {
      values.push(prepared.query, prepared.query.replace(/[!%_]/gu, '!$&'), prepared.fingerprint);
      terms.push(`(voucher.id=$${values.length - 2} or voucher.number_masked ilike '%'||$${values.length - 1}||'%' escape '!' or ($${values.length}::text is not null and voucher.number_fingerprint=$${values.length}))`);
    }
    return { where: `where ${terms.join(' and ')}`, values };
  }
}
function canonical(value: RecordValue): string {
  return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))));
}
function ownOnly(target: string): boolean {
  return target === 'storefront' || target === 'miniapp';
}
type SearchCall = Parameters<VoucherSearch['read']>[0] | Parameters<VoucherSearch['facets']>[0] | Parameters<VoucherSearch['snapshot']>[0];
