import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { CheckoutSessionStore, StoredCurrentQuote } from '../../application/port/CheckoutSessionStore';
import type { StoredCheckoutQuote } from '../../public/CheckoutWritePort';
import { quoteExpired } from '../../domain/error/CheckoutError';
export class PgCheckoutSessionStore implements CheckoutSessionStore {
  private readonly transactions = new PgTransactionAccess();
  async lockQuote(context: WriteTransactionContext, quote: string, member: string, mall: string, confirmationDigest: string): Promise<StoredCheckoutQuote> {
    const database = this.transactions.database(context);
    const locked = await database.query<StoredCheckoutQuote>(
      `select session.id checkout,session.cart_id "cartId",session.member_id "memberId",session.mall_id "mallId",session.application_id "applicationId",
      session.quote_id "quoteId",session.quote_hash "quoteHash",session.expires_at "expiresAt",session.input,session.version::integer version
      from checkout.session session where session.quote_id=$1 and session.member_id=$2 and session.mall_id=$3
      and session.confirmation_digest=$4 and session.state='quoted' and session.expires_at>clock_timestamp() for update`,
      [quote, member, mall, confirmationDigest]
    );
    const selected = locked.rows[0];
    if (!selected) return quoteExpired();
    return selected;
  }
  async confirm(context: WriteTransactionContext, checkout: string): Promise<void> {
    const database = this.transactions.database(context);
    const changed = await database.query(`update checkout.session set state='confirmed',version=version+1 where id=$1 and state='quoted' returning id`, [checkout]);
    if (!changed.rows[0]) throw new Error('CHECKOUT_CONFIRMATION_CONFLICT');
  }
  async expire(context: WriteTransactionContext, checkout: string | null) {
    const database = this.transactions.database(context);
    const result = await database.query<{
      id: string;
    }>(
      `update checkout.session set state='expired',version=version+1
      where state in('draft','quoted') and expires_at<=clock_timestamp() and ($1::text is null or id=$1) returning id`,
      [checkout]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ id: row.id })));
  }
  async purge(context: WriteTransactionContext): Promise<readonly string[]> {
    const database = this.transactions.database(context);
    await database.query(`delete from checkout.session where expires_at<clock_timestamp()-interval '7 days' and state='expired'`);
    const retained = await database.query<{
      quote_id: string;
    }>(`select quote_id from checkout.session order by quote_id`);
    return Object.freeze(retained.rows.map(({ quote_id }) => quote_id));
  }
  async replaceCurrent(
    context: WriteTransactionContext,
    input: Readonly<{
      checkoutId: string;
      quoteId: string;
      signature: string;
      confirmationDigest: string;
      cartId: string;
      memberId: string;
      mallId: string;
      applicationId: string;
      addressId: string | null;
      selection: unknown;
      expiresAt: string;
    }>
  ): Promise<StoredCurrentQuote> {
    const database = this.transactions.database(context);
    await database.query(`update checkout.session set state='expired',version=version+1 where cart_id=$1 and state='quoted'`, [input.cartId]);
    const created = await database.query<{
      checkoutId: string;
      quoteId: string;
      signature: string;
      expiresAt: Date | string;
      quoteVersion: number;
    }>(
      `insert into checkout.session(id,cart_id,member_id,mall_id,application_id,quote_id,quote_hash,confirmation_digest,address_id,input,state,expires_at,created_at,version)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,'quoted',$11,clock_timestamp(),0)
      returning id "checkoutId",quote_id "quoteId",quote_hash signature,expires_at "expiresAt",version::integer "quoteVersion"`,
      [input.checkoutId, input.cartId, input.memberId, input.mallId, input.applicationId, input.quoteId, input.signature, input.confirmationDigest, input.addressId, JSON.stringify(input.selection), input.expiresAt]
    );
    const row = created.rows[0];
    if (!row) throw new Error('CHECKOUT_SESSION_CREATE_FAILED');
    return Object.freeze({ ...row, payload: null });
  }
  async current(context: ReadTransactionContext, member: string, mall: string): Promise<StoredCurrentQuote | null> {
    const database = this.transactions.database(context);
    const result = await database.query<StoredCurrentQuote>(
      `select session.id "checkoutId",session.quote_id "quoteId",session.quote_hash signature,session.expires_at "expiresAt",
      session.version::integer "quoteVersion",null::jsonb payload from checkout.session session
      where session.member_id=$1 and session.mall_id=$2 and session.state='quoted' and session.expires_at>clock_timestamp()
      order by session.created_at desc,session.id desc limit 1`,
      [member, mall]
    );
    return result.rows[0] ? Object.freeze(result.rows[0]) : null;
  }
  async saveEvidence(
    context: WriteTransactionContext,
    checkout: string,
    entries: readonly Readonly<{
      kind: string;
      reference: string;
      version: string;
      hash: string;
    }>[],
    expiresAt: string
  ): Promise<void> {
    const database = this.transactions.database(context);
    if (entries.length === 0) return;
    await database.query(
      `insert into checkout.evidence(checkout_id,kind,reference_id,version,payload_hash,expires_at)
      select $1,item.kind,item.reference,item.version,item.hash,$3::timestamptz
      from jsonb_to_recordset($2::jsonb) as item(kind text,reference text,version text,hash text)`,
      [checkout, JSON.stringify(entries), expiresAt]
    );
  }
}
