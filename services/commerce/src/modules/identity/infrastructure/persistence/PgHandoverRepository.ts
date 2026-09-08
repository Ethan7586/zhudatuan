import { randomUUID } from 'node:crypto';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { HandoverRecord, HandoverRepository } from '../../application/port/HandoverRepository';

export class PgHandoverRepository implements HandoverRepository {
  constructor(private readonly transactions = new PgTransactionAccess()) {}

  async create(context: Parameters<HandoverRepository['create']>[0], input: Parameters<HandoverRepository['create']>[1]): Promise<HandoverRecord> {
    const result = await this.transactions.database(context).query<HandoverRecord>(
      `insert into identity.storehandover(id,tenant_id,scope_id,principal_id,membership_id,session_id,note,handed_over_at,version)
      values($1,$2,$3,$4,$5,$6,$7,clock_timestamp(),1)
      returning id,scope_id "scopeId",membership_id "membershipId",note,handed_over_at "handedOverAt",version::float8 version`,
      [`storehandover:${randomUUID()}`, context.tenant, input.scope, input.principal, input.membership, input.session, input.note]
    );
    return Object.freeze(result.rows[0]!);
  }

  async read(context: Parameters<HandoverRepository['read']>[0], scope: string, page: Parameters<HandoverRepository['read']>[2]): Promise<readonly HandoverRecord[]> {
    const result = await this.transactions.database(context).query<HandoverRecord>(
      `select id,scope_id "scopeId",membership_id "membershipId",note,handed_over_at "handedOverAt",version::float8 version
      from identity.storehandover where scope_id=$1 and ($2::timestamptz is null or (handed_over_at,id)<($2::timestamptz,$3))
      order by handed_over_at desc,id desc limit $4`,
      [scope, page.sort, page.id, page.fetch]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze(row)));
  }
}
