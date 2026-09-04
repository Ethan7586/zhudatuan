import { randomUUID } from 'node:crypto';
import type { OperationRequest, OperationResult } from '../../../../foundation/application/OperationHandler';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { bodyRecord } from '../../../../foundation/interface/Validation';
import { domainEvent } from '../../../../foundation/domain/DomainEvent';
import { appendOutbox } from '../../../../foundation/infrastructure/OutboxStore';
import { CheckoutPort, type CheckoutQuote } from '../../../checkout_jiesuan';
import { checkoutSessionPort } from '../../../checkout_jiesuan';
import { InventoryPort } from '../../../inventory/InventoryPort';
import { PaymentPort } from '../../../payment/PaymentPort';
import type { BenefitGateway } from '../../../benefit/application/port/BenefitPort';
import { marketingPort } from '../../../marketing/MarketingPort';
import { cartPort } from '../../../cart/CartPort';
import type { OrderQuoteStore, StoredQuote } from '../../01_public_gongkai/contracts_qiyue/OrderContractModule';

export interface OrderVoucherGateway {
  reserve(database: OperationDatabase, order: string, member: string, scope: string,
    tenders: readonly Readonly<{ reference: string; amountMinor: number }>[]): Promise<void>;
}

export class DirectOrderQuoteStore implements OrderQuoteStore {
  async load(database: OperationDatabase, quote: string, membership: string): Promise<StoredQuote> {
    const result = await database.query<StoredQuote>(`select session.id checkout,session.cart_id,session.member_id,session.mall_id,session.application_id,
      session.quote_id,session.quote_hash,session.input,session.version::float8 version,quote.signed_payload,quote.signature
      from checkout.session session join pricing.quote quote on quote.id=session.quote_id
      join access.membership membership on membership.member_id=session.member_id and membership.organization_id=session.mall_id
      join cart.cart cart on cart.id=session.cart_id and cart.member_id=session.member_id and cart.mall_id=session.mall_id
      where session.quote_id=$1 and membership.id=$2 and session.state='quoted' and cart.state='active'
        and session.expires_at>clock_timestamp() and quote.expires_at>clock_timestamp()
      for update of session,cart`, [quote, membership]);
    const row = result.rows[0];
    if (!row) throw new Error('QUOTE_EXPIRED_OR_CONFLICT');
    return row;
  }
}

export class PlaceOrder {
  constructor(
    private readonly checkout: CheckoutPort,
    private readonly benefit: BenefitGateway,
    private readonly voucher: OrderVoucherGateway,
    private readonly quotes: OrderQuoteStore = new DirectOrderQuoteStore(),
    private readonly inventory = new InventoryPort(),
    private readonly payment = new PaymentPort(),
  ) {}

  async execute(request: OperationRequest, database: OperationDatabase): Promise<OperationResult> {
    const access = request.access;
    if (!access) throw new Error('AUTHENTICATION_REQUIRED');
    if (access.assurance.level < 2) throw new Error('MOBILE_ASSURANCE_REQUIRED');
    const quoteid = text(bodyRecord(request).quote, 'quote');
    const stored = await this.quotes.load(database, quoteid, access.membership.id);
    if (!this.checkout.verify(stored.signed_payload, stored.signature) || stored.signature !== stored.quote_hash) throw new Error('QUOTE_SIGNATURE_INVALID');
    const selection = this.checkout.selection(stored.input);
    const current = await this.checkout.read(database, access.membership.id, selection);
    if (current.cart.id !== stored.cart_id || this.checkout.sign(current) !== stored.signature) throw new Error('PRICE_QUOTE_EXPIRED');
    if (current.rejections.length > 0) throw new Error(`CHECKOUT_REJECTED:${current.rejections.map(({ listing, reasons }) => `${listing}:${reasons.join(',')}`).join(';')}`);
    const order = `order:${randomUUID()}`;
    await this.inventory.reserve(database, order, current.cart.mall, current.lines);
    await this.reserveVouchers(database, order, current);
    await this.reserveBenefits(database, order, current);
    await this.reserveMarketing(database, order, current);
    const number = await orderNumber(database);
    const snapshots = await this.snapshots(database, current);
    const saved = await database.query(`insert into ordering.orderrecord(id,order_number,scope_id,member_id,mall_id,checkout_id,currency,total_minor,
      payment_state,fulfillment_state,aftersale_state,lifecycle_state,evidence,address_snapshot,invoice_snapshot,delivery_snapshot,experience_version,
      created_at,updated_at,version) values($1,$2,$3,$4,$3,$5,$6,$7,'unpaid','unallocated','none','created',$8::jsonb,$9::jsonb,$10::jsonb,
      $11::jsonb,$12,clock_timestamp(),clock_timestamp(),0) returning *`, [order, number, current.cart.mall, current.cart.member, stored.checkout,
      current.currency, current.payableMinor, JSON.stringify({ quote: stored.quote_id, signature: stored.signature, dependencies: current.evidence,
        selection: current.selection, tenders: current.tenders }), JSON.stringify(snapshots.address), JSON.stringify(snapshots.invoice),
      JSON.stringify(current.selection.delivery), experienceVersion(current)]);
    await this.saveLines(database, order, current);
    await this.saveSuborders(database, order);
    const intent = await this.paymentPlan(database, request, order, number, current);
    await checkoutSessionPort.confirm(database, stored.checkout);
    await cartPort.convert(database, stored.cart_id);
    await database.query(`insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
      values($1,'orderexpiry','order',$2,jsonb_build_object('order',$3::text),'queued',10,clock_timestamp()+interval '30 minutes',clock_timestamp(),clock_timestamp())`,
    [`job:expiry:${order}`, current.cart.mall, order]);
    await this.events(database, request, stored, current, order, number, intent);
    return { status: 201, body: { ...saved.rows[0], payment: { intent, personalMinor: current.personalMinor,
      action: 'payment.intents.create' } }, headers: { etag: '"0"' } };
  }

  private async reserveVouchers(database: OperationDatabase, order: string, quote: CheckoutQuote): Promise<void> {
    const tenders = quote.tenders.filter((item) => item.kind === 'voucher').sort(byReference);
    await this.voucher.reserve(database, order, quote.cart.member, quote.cart.mall,
      tenders.map(({ reference, amountMinor }) => ({ reference: reference!, amountMinor })));
  }

  private async reserveBenefits(database: OperationDatabase, order: string, quote: CheckoutQuote): Promise<void> {
    const tenders = quote.tenders.filter((item) => item.kind === 'benefit').sort(byReference);
    await this.benefit.reserve(database, order, quote.cart.member, quote.cart.mall,
      tenders.map(({ reference, amountMinor }) => ({ reference: reference!, amountMinor })));
  }

  private async reserveMarketing(database: OperationDatabase, order: string, quote: CheckoutQuote): Promise<void> {
    const values = Array.isArray(quote.evidence.marketing) ? quote.evidence.marketing as readonly Readonly<Record<string, unknown>>[] : [];
    for (const value of [...values].sort((left, right) => String(left.id).localeCompare(String(right.id)))) {
      const id = text(value.id, 'campaign');
      const amount = integer(value.discount, 'campaign.discount');
      await marketingPort.reserve(database, { campaign: id, member: quote.cart.member, order, scope: quote.cart.mall, amountMinor: amount });
    }
  }

  private async snapshots(database: OperationDatabase, quote: CheckoutQuote): Promise<Readonly<{ address: unknown; invoice: unknown }>> {
    const address = quote.selection.address === null ? null : (await database.query(`select id,recipient_ciphertext,mobile_ciphertext,address_ciphertext,
      recipient_masked,mobile_masked,address_masked,region_code,version from checkout.address where id=$1 and member_id=$2 and status='active'`,
    [quote.selection.address, quote.cart.member])).rows[0];
    const invoice = quote.selection.invoice === null ? null : (await database.query(`select id,title_ciphertext,title_key_version,taxid_ciphertext,
      taxid_key_version,address_ciphertext,address_key_version,version from invoice.profile where id=$1 and owner_id=$2 and status='active'`,
    [quote.selection.invoice, quote.cart.member])).rows[0];
    if (quote.selection.address !== null && !address) throw new Error('CHECKOUT_ADDRESS_INVALID');
    if (quote.selection.invoice !== null && !invoice) throw new Error('CHECKOUT_INVOICE_INVALID');
    return Object.freeze({ address: address ?? null, invoice: invoice ?? null });
  }

  private async saveLines(database: OperationDatabase, order: string, quote: CheckoutQuote): Promise<void> {
    await database.query(`insert into ordering.line(id,order_id,sku_id,listing_id,title_snapshot,quantity,unit_minor,total_minor,discount_minor,
      qualification_evidence_id,provider,partner_id,evidence) select 'line:'||gen_random_uuid()::text,$1,line.sku,line.listing,line.title,
      line.quantity,line."unitMinor",line."totalMinor",line."discountMinor",null,line.provider,line.partner,line.versions
      from jsonb_to_recordset($2::jsonb) as line(sku text,listing text,title text,quantity bigint,"unitMinor" bigint,
      "totalMinor" bigint,"discountMinor" bigint,provider text,partner text,versions jsonb,accepted boolean) where line.accepted`, [order, JSON.stringify(quote.lines)]);
  }

  private async saveSuborders(database: OperationDatabase, order: string): Promise<void> {
    await database.query(`insert into ordering.suborder(id,order_id,partner_id,provider,state,version)
      select 'suborder:'||md5($1||':'||coalesce(line.provider,'internal')||':'||coalesce(line.partner_id,'internal')),
        $1,line.partner_id,line.provider,'pending',0 from ordering.line line
      where line.order_id=$1 group by line.provider,line.partner_id`, [order]);
  }

  private async paymentPlan(database: OperationDatabase, request: OperationRequest, order: string, number: string, quote: CheckoutQuote): Promise<string> {
    return this.payment.plan(database, { mall: quote.cart.mall, order, orderNumber: number, member: quote.cart.member, currency: quote.currency,
      amountMinor: quote.payableMinor, idempotency: request.input.idempotency!, tenders: quote.tenders });
  }

  private async events(database: OperationDatabase, request: OperationRequest, stored: StoredQuote, quote: CheckoutQuote, order: string, number: string, intent: string): Promise<void> {
    const access = request.access!;
    const scopes = await database.query<{ ids: readonly string[] }>('select jsonb_agg(ancestor_id order by depth) ids from organization.unitclosure where descendant_id=$1', [quote.cart.mall]);
    const timezone = await database.query<{ timezone: string }>('select timezone from organization.organization where id=$1', [quote.cart.mall]);
    const base = { tenant: quote.cart.mall, occurred: new Date().toISOString(), trace: access.trace } as const;
    await appendOutbox(database, domainEvent({ event: `event:${randomUUID()}`, type: 'checkout.quote.confirmed', version: 1,
      aggregate: { type: 'checkout', id: stored.checkout }, ...base, payload: { checkout: stored.checkout, quote: stored.quote_id, order, intent } }));
    await appendOutbox(database, domainEvent({ event: `event:${randomUUID()}`, type: 'inventory.stock.reserved', version: 1,
      aggregate: { type: 'order', id: order }, ...base, payload: { order, lines: quote.lines.map(({ sku, stockitem, quantity }) => ({ sku, stockitem, quantity })) } }));
    await appendOutbox(database, domainEvent({ event: `event:${randomUUID()}`, type: 'order.placed', version: 1,
      aggregate: { type: 'order', id: order }, ...base, payload: { order, number, mall: quote.cart.mall, application: quote.cart.application,
        scopes: scopes.rows[0]?.ids, timezone: timezone.rows[0]?.timezone, totalMinor: quote.payableMinor, currency: quote.currency,
        evidenceHash: this.checkout.digest(quote.evidence), tenders: quote.tenders,
        lines: quote.lines.map(({ sku, product, category, provider, partner, totalMinor, discountMinor, payableMinor }) =>
          ({ sku, product, category, powderclass: category, provider, partner, totalMinor, discountMinor, payableMinor })) } }));
  }
}

function experienceVersion(quote: CheckoutQuote): string | null {
  const value = quote.evidence.experience;
  return value !== null && typeof value === 'object' && !Array.isArray(value) && typeof (value as Record<string, unknown>).version === 'string'
    ? (value as Record<string, string>).version ?? null : null;
}
function text(value: unknown, field: string): string { if (typeof value !== 'string' || value.length === 0 || value.length > 255) throw new Error(`VALIDATION_FAILED:${field}`); return value; }
function integer(value: unknown, field: string): number { if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error(`VALIDATION_FAILED:${field}`); return value as number; }
function byReference(left: Readonly<{ reference: string | null }>, right: Readonly<{ reference: string | null }>): number { return (left.reference ?? '').localeCompare(right.reference ?? ''); }
async function orderNumber(database: OperationDatabase): Promise<string> {
  const row = (await database.query<{ number: string }>(`select 'SW'||to_char(clock_timestamp(),'YYYYMMDD')||lpad(nextval('ordering.order_number_seq')::text,12,'0') number`)).rows[0];
  if (!row) throw new Error('ORDER_NUMBER_GENERATION_FAILED');
  return row.number;
}
