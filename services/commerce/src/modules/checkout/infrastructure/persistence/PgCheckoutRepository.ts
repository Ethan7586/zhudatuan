import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { CheckoutRepository, StoredCurrentQuote } from '../../application/port/CheckoutRepository';
import type { StoredCheckoutQuote } from '../../public/CheckoutWritePort';

export class PgCheckoutRepository implements CheckoutRepository {
  async lockQuote(database: OperationDatabase, quote: string, member: string, mall: string): Promise<StoredCheckoutQuote> {
    const locked = await database.query<StoredCheckoutQuote>(
      `select session.id checkout,session.cart_id,session.member_id,session.mall_id,session.application_id,
      session.quote_id,session.quote_hash,session.input,session.version::integer version
      from checkout.session session where session.quote_id=$1 and session.member_id=$2 and session.mall_id=$3
      and session.state='quoted' and session.expires_at>clock_timestamp() for update`,
      [quote, member, mall]
    );
    const selected = locked.rows[0];
    if (!selected) throw new Error('QUOTE_EXPIRED_OR_CONFLICT');
    return selected;
  }

  async confirm(database: OperationDatabase, checkout: string): Promise<void> {
    const changed = await database.query(`update checkout.session set state='confirmed',version=version+1 where id=$1 and state='quoted' returning id`, [checkout]);
    if (!changed.rows[0]) throw new Error('CHECKOUT_CONFIRMATION_CONFLICT');
  }

  expire(database: OperationDatabase, checkout: string | null) {
    return database.query<{ id: string }>(
      `update checkout.session set state='expired',version=version+1
      where state in('draft','quoted') and expires_at<=clock_timestamp() and ($1::text is null or id=$1) returning id`,
      [checkout]
    );
  }

  async purge(database: OperationDatabase): Promise<readonly string[]> {
    await database.query(`delete from checkout.session where expires_at<clock_timestamp()-interval '7 days' and state='expired'`);
    const retained = await database.query<{ quote_id: string }>(`select quote_id from checkout.session order by quote_id`);
    return Object.freeze(retained.rows.map(({ quote_id }) => quote_id));
  }
  async replaceCurrent(
    database: OperationDatabase,
    input: Readonly<{ checkoutId: string; quoteId: string; signature: string; cartId: string; memberId: string; mallId: string; applicationId: string; addressId: string | null; selection: unknown; expiresAt: string }>
  ): Promise<StoredCurrentQuote> {
    await database.query(`update checkout.session set state='expired',version=version+1 where cart_id=$1 and state='quoted'`, [input.cartId]);
    const created = await database.query<{ checkoutId: string; quoteId: string; signature: string; expiresAt: Date | string; quoteVersion: number }>(
      `insert into checkout.session(id,cart_id,member_id,mall_id,application_id,quote_id,quote_hash,address_id,input,state,expires_at,created_at,version)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,'quoted',$10,clock_timestamp(),0)
      returning id "checkoutId",quote_id "quoteId",quote_hash signature,expires_at "expiresAt",version::integer "quoteVersion"`,
      [input.checkoutId, input.cartId, input.memberId, input.mallId, input.applicationId, input.quoteId, input.signature, input.addressId, JSON.stringify(input.selection), input.expiresAt]
    );
    const row = created.rows[0];
    if (!row) throw new Error('CHECKOUT_SESSION_CREATE_FAILED');
    return Object.freeze({ ...row, payload: null });
  }

  async current(database: OperationDatabase, member: string, mall: string): Promise<StoredCurrentQuote | null> {
    const result = await database.query<StoredCurrentQuote>(
      `select session.id "checkoutId",session.quote_id "quoteId",session.quote_hash signature,session.expires_at "expiresAt",
      session.version::integer "quoteVersion",null::jsonb payload from checkout.session session
      where session.member_id=$1 and session.mall_id=$2 and session.state='quoted' and session.expires_at>clock_timestamp()
      order by session.created_at desc,session.id desc limit 1`,
      [member, mall]
    );
    return result.rows[0] ? Object.freeze(result.rows[0]) : null;
  }

  async saveEvidence(database: OperationDatabase, checkout: string, entries: readonly Readonly<{ kind: string; reference: string; version: string; hash: string }>[], expiresAt: string): Promise<void> {
    if (entries.length === 0) return;
    await database.query(
      `insert into checkout.evidence(checkout_id,kind,reference_id,version,payload_hash,expires_at)
      select $1,item.kind,item.reference,item.version,item.hash,$3::timestamptz
      from jsonb_to_recordset($2::jsonb) as item(kind text,reference text,version text,hash text)`,
      [checkout, JSON.stringify(entries), expiresAt]
    );
  }
}
