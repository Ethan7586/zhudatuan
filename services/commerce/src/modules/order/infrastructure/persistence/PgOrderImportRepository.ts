import { createHash } from 'node:crypto';
import { PgTransactionAccess, type SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { OrderImportFinancePort } from '../../../finance/public';
import type { MemberReadPort } from '../../../member/public';
import type { OrganizationReadPort } from '../../../organization/public';
import type { OrderImportPaymentPort } from '../../../payment/public';
import type { OrderImportRepository } from '../../application/port/OrderImportRepository';
import { nextOrderNumber } from './OrderNumber';
import { orderImportValue, type OrderImportValue } from './OrderImportRow';
import { PgRuntimeWriter } from '../../../../platform/database/PgRuntimeWriter';
import { Order, type AftersaleState, type CommerceState, type FulfillmentState, type PaymentState } from '../../domain/model/Order';
import { DomainError } from '../../../../platform/error/DomainError';

interface Dependencies {
  readonly organizations: Pick<OrganizationReadPort, 'activeMalls'>;
  readonly members: Pick<MemberReadPort, 'summary'>;
  readonly payments: OrderImportPaymentPort;
  readonly finance: OrderImportFinancePort;
}

export class PgOrderImportRepository implements OrderImportRepository {
  constructor(
    private readonly dependencies: Dependencies,
    private readonly transactions = new PgTransactionAccess()
  ) {}

  async import(context: WriteTransactionContext, target: Readonly<{ id: string; scope: string }>, row: number, source: Readonly<Record<string, string>>): Promise<void> {
    const database = this.transactions.database(context);
    const repeated = await database.query(`select 1 from ordering.importreceipt where import_id=$1 and row_number=$2`, [target.id, row]);
    if (repeated.rows[0]) return;
    const value = orderImportValue(source);
    await this.assertMapping(context, target.scope, value);
    const evidence = await this.evidence(context, target.scope, value);
    const prior = await database.query(`select 1 from ordering.orderrecord where source_channel=$1 and external_reference=$2`, [value.source, value.externalOrderNo]);
    if (prior.rows[0]) throw new DomainError('ORDER_IMPORT_DUPLICATE');
    const identity = createHash('sha256').update(`${target.scope}:${value.source}:${value.externalOrderNo}`).digest('hex');
    const sourceHash = createHash('sha256').update(JSON.stringify(source)).digest('hex');
    const order = `order:import:${identity}`;
    const number = await nextOrderNumber(database);
    const states = importedStates(value.state, evidence.verified);
    const snapshot = Order.freezeSnapshot({
      lines: value.lines.map((line, index) => ({ ...line, id: importedLineId(order, index + 1) })),
      address: value.address,
      payment: {
        state: states.payment,
        currency: value.currency,
        payableMinor: value.totalMinor,
        capturedMinor: states.payment === 'paid' ? value.totalMinor : 0,
        refundedMinor: 0,
        evidence,
      },
      fulfillment: {
        state: states.fulfillment,
        addressHash: value.address?.hash ?? null,
        route: value.lines.map((line, index) => ({
          line: importedLineId(order, index + 1),
          quantity: line.quantity,
          kind: line.productType === 'physical' ? 'shipment' : line.productType === 'voucher' ? 'voucher' : 'digital',
          provider: line.provider,
          partner: line.partner,
        })),
      },
    });
    await database.query(
      `insert into ordering.orderrecord(id,order_number,scope_id,member_id,mall_id,checkout_id,currency,total_minor,
      payment_state,fulfillment_state,aftersale_state,lifecycle_state,evidence,address_snapshot,invoice_snapshot,delivery_snapshot,
      experience_version,external_reference,source_channel,source_state,verification_state,ordered_at,import_id,amount_snapshot,
      created_at,updated_at,version)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,'null'::jsonb,$15::jsonb,$16,$17,$18,$19,$20,$21,$22,$23::jsonb,
      $21,$21,0)`,
      [
        order,
        number,
        target.scope,
        value.member,
        value.mall,
        `checkout:import:${identity}`,
        value.currency,
        value.totalMinor,
        states.payment,
        states.fulfillment,
        states.aftersale,
        states.lifecycle,
        JSON.stringify({
          source: value.source,
          externalOrderNo: value.externalOrderNo,
          importedBy: context.actor,
          import: target.id,
          row,
          paymentReference: value.paymentReference,
          statementReference: value.statementReference,
          verification: evidence,
          paymentSnapshot: snapshot.payment,
        }),
        JSON.stringify(snapshot.address),
        JSON.stringify({ mode: 'external', source: value.source, ...snapshot.fulfillment }),
        `external:${value.source}`,
        value.externalOrderNo,
        value.source,
        value.state,
        evidence.verified ? 'verified' : 'pending',
        value.orderedAt,
        target.id,
        JSON.stringify({
          subtotalMinor: value.lines.reduce((sum, line) => sum + line.totalMinor, 0),
          discountMinor: value.lines.reduce((sum, line) => sum + line.discountMinor, 0),
          shippingMinor: 0,
          taxMinor: 0,
          payableMinor: value.totalMinor,
          currency: value.currency,
        }),
      ]
    );
    await insertLines(database, order, value);
    await database.query(
      `insert into ordering.suborder(id,order_id,partner_id,provider,state,version)
      select 'suborder:'||encode(public.digest($1||':'||coalesce(line.provider,'internal')||':'||coalesce(line.partner_id,'internal'),'sha256'),'hex'),
      $1,line.partner_id,line.provider,$2,0 from ordering.line line where line.order_id=$1 group by line.provider,line.partner_id`,
      [order, states.fulfillment === 'cancelled' ? 'cancelled' : states.fulfillment === 'unallocated' ? 'pending' : 'active']
    );
    await database.query(
      `insert into ordering.importreceipt(import_id,row_number,order_id,source_channel,external_reference,payment_reference,statement_reference,source_hash,created_at)
      values($1,$2,$3,$4,$5,$6,$7,$8,clock_timestamp())`,
      [target.id, row, order, value.source, value.externalOrderNo, value.paymentReference, value.statementReference, sourceHash]
    );
    await new PgRuntimeWriter(database).append({
      id: `event:orderimport:${identity}`,
      type: 'order.placed',
      aggregateType: 'order',
      aggregate: order,
      scope: target.scope,
      aggregateVersion: 1,
      actor: context.actor,
      correlation: target.id,
      causation: target.id,
      trace: context.trace,
      payload: {
        order,
        number,
        member: value.member,
        mall: value.mall,
        application: `external:${value.source}`,
        scopes: [...new Set([target.scope, value.mall])],
        timezone: 'UTC',
        totalMinor: value.totalMinor,
        currency: value.currency,
        evidenceHash: sourceHash,
        tenders: [],
        lines: value.lines.map((line, index) => ({
          line: importedLineId(order, index + 1),
          sku: line.sku,
          product: line.product,
          category: line.category,
          provider: line.provider,
          partner: line.partner,
          totalMinor: line.totalMinor,
          discountMinor: line.discountMinor,
          payableMinor: line.payableMinor,
        })),
        paymentState: states.payment,
        fulfillmentState: states.fulfillment,
        aftersaleState: states.aftersale,
        lifecycleState: states.lifecycle,
        verificationState: evidence.verified ? 'verified' : 'pending',
        sourceChannel: value.source,
        externalOrderNo: value.externalOrderNo,
        orderedAt: value.orderedAt,
      },
    });
  }

  private async assertMapping(context: WriteTransactionContext, scope: string, value: OrderImportValue): Promise<void> {
    const [malls, member] = await Promise.all([this.dependencies.organizations.activeMalls(context, scope), this.dependencies.members.summary(context, value.member, scope)]);
    if (!malls.includes(value.mall) || !member || member.status !== 'active') throw new DomainError('ORDER_IMPORT_MAPPING_INVALID');
  }

  private async evidence(context: WriteTransactionContext, scope: string, value: OrderImportValue) {
    const requiresFunds = ['paid', 'fulfilled', 'completed', 'refunded'].includes(value.state);
    if (!requiresFunds) return Object.freeze({ verified: true, method: 'notrequired', reason: null });
    const [payment, statement] = await Promise.all([
      value.paymentReference ? this.dependencies.payments.verifyImportEvidence(context, value.paymentReference, scope, value.totalMinor, value.currency) : Promise.resolve(false),
      value.statementReference ? this.dependencies.finance.verifyStatementEvidence(context, value.statementReference, scope, value.totalMinor, value.currency) : Promise.resolve(false),
    ]);
    if (value.state === 'refunded') return Object.freeze({ verified: false, method: payment ? 'payment' : statement ? 'statement' : 'none', reason: 'REFUND_EVIDENCE_REQUIRED' });
    return Object.freeze({ verified: payment || statement, method: payment ? 'payment' : statement ? 'statement' : 'none', reason: payment || statement ? null : 'FUNDS_UNVERIFIED' });
  }
}

function importedStates(source: string, verified: boolean): Readonly<{ payment: PaymentState; fulfillment: FulfillmentState; aftersale: AftersaleState; lifecycle: CommerceState }> {
  if (source === 'cancelled') return Object.freeze({ payment: 'unpaid', fulfillment: 'cancelled', aftersale: 'none', lifecycle: 'cancelled' });
  if (source === 'unpaid' || !verified) return Object.freeze({ payment: 'unpaid', fulfillment: 'unallocated', aftersale: 'none', lifecycle: 'awaitingpayment' });
  if (source === 'paid') return Object.freeze({ payment: 'paid', fulfillment: 'allocated', aftersale: 'none', lifecycle: 'paid' });
  if (source === 'fulfilled') return Object.freeze({ payment: 'paid', fulfillment: 'delivered', aftersale: 'none', lifecycle: 'shipped' });
  return Object.freeze({ payment: 'paid', fulfillment: 'received', aftersale: 'none', lifecycle: 'completed' });
}

async function insertLines(database: SqlExecutor, order: string, value: OrderImportValue): Promise<void> {
  await database.query(
    `insert into ordering.line(id,order_id,sku_id,listing_id,title_snapshot,quantity,unit_minor,total_minor,discount_minor,
    qualification_evidence_id,provider,partner_id,evidence)
    select 'line:'||encode(public.digest($1||':'||record.sequence::text,'sha256'),'hex'),$1,record.sku,record.listing,record.title,
    record.quantity,record."unitMinor",record."totalMinor",record."discountMinor",null,record.provider,record.partner,
    jsonb_build_object('product',record.product,'productType',record."productType",'category',record.category,'versions',record.versions,
      'sourceChannel',$3,'sourceExternalOrder',$4,'sourceSequence',record.sequence)
    from jsonb_to_recordset($2::jsonb) record(sequence integer,sku text,listing text,product text,"productType" text,category text,
      title text,quantity bigint,"unitMinor" bigint,"totalMinor" bigint,"discountMinor" bigint,provider text,partner text,versions jsonb)`,
    [order, JSON.stringify(value.lines.map((line, index) => ({ ...line, sequence: index + 1 }))), value.source, value.externalOrderNo]
  );
}

function importedLineId(order: string, sequence: number): string {
  return `line:${createHash('sha256').update(`${order}:${sequence}`).digest('hex')}`;
}
