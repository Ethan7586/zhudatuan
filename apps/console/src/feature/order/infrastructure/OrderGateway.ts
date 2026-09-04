import { createFetchOrder, type OrderOperations } from '@shop/sdk/order';
import { createFetchSupport, type SupportOperations } from '@shop/sdk/support';
import { createFetchFulfillment, type FulfillmentOperations } from '@shop/sdk/fulfillment';
import { createFetchPayment, type PaymentOperations } from '@shop/sdk/payment';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { consoleCommand, consoleRequest } from '../../../shared/api/RequestContext';
import type { AfterSaleRecord } from '../model/AfterSale';
import type { AfterSaleQuery } from '../model/AfterSale';
import type { OrderAfterSaleDecision, OrderDetail, OrderFulfillment, OrderImportSource, OrderRecovery, OrderRecoveryAction, OrderReturn } from '../model/Order';
import type { OrderListFilter } from '../model/OrderFilter';
import { ORDER_PAGE_LIMIT, type OrderQuery } from '../model/OrderQuery';
import type { OrderPort } from '../public';
import { OrderMapper } from './OrderMapper';
import { ImportUploadGateway } from '../../../shared/import/ImportUploadGateway';

export class OrderGateway implements OrderPort {
  private readonly operations: OrderOperations;
  private readonly supportOperations: SupportOperations;
  private readonly fulfillmentOperations: FulfillmentOperations;
  private readonly paymentOperations: PaymentOperations;
  private readonly mapper = new OrderMapper();
  private readonly uploads: ImportUploadGateway;

  constructor(baseUrl: string) {
    this.operations = createFetchOrder(baseUrl);
    this.supportOperations = createFetchSupport(baseUrl);
    this.fulfillmentOperations = createFetchFulfillment(baseUrl);
    this.paymentOperations = createFetchPayment(baseUrl);
    this.uploads = new ImportUploadGateway(baseUrl);
  }

  async orders(context: ConsoleContext, filter: OrderQuery, signal?: AbortSignal) {
    const value = await this.operations.ordersRead(
      {
        query: {
          limit: ORDER_PAGE_LIMIT,
          ...orderFilterQuery(filter),
          ...(filter.view === 'all' ? {} : { view: filter.view }),
          ...(filter.cursor === undefined ? {} : { cursor: filter.cursor }),
        },
      },
      consoleRequest(context.scope, signal, context.session.accessVersion)
    );
    return this.mapper.page(value);
  }

  async order(context: ConsoleContext, reference: string, signal?: AbortSignal) {
    return this.mapper.order(await this.operations.detailRead({ path: { orderid: reference } }, consoleRequest(context.scope, signal, context.session.accessVersion)));
  }

  async support(context: ConsoleContext, reference: string, signal?: AbortSignal) {
    const page = await this.supportOperations.casesRead(
      { query: { limit: 50, orderId: reference } },
      consoleRequest(context.scope, signal, context.session.accessVersion)
    );
    return Object.freeze(page.items.map((item) => Object.freeze({
      id: item.id,
      subject: item.subject,
      state: item.state,
      priority: item.priority,
      assignedAgentId: item.assigned_agent_id,
      unreadCount: item.unread_count,
      slaRisk: item.sla_risk,
      updatedAt: item.updated_at,
    })));
  }

  async recoveries(context: ConsoleContext, reference?: string, signal?: AbortSignal) {
    const page = await this.paymentOperations.recoveriesRead(
      { query: { limit: 50, ...(reference === undefined ? {} : { orderId: reference }) } },
      consoleRequest(context.scope, signal, context.session.accessVersion)
    );
    return this.mapper.recoveries(page);
  }

  async aftersales(context: ConsoleContext, filter: AfterSaleQuery, signal?: AbortSignal) {
    const value = await this.operations.aftersalesRead(
      { query: { limit: ORDER_PAGE_LIMIT, ...orderFilterQuery(filter), ...(filter.cursor === undefined ? {} : { cursor: filter.cursor }) } },
      consoleRequest(context.scope, signal, context.session.accessVersion)
    );
    return this.mapper.aftersales(value);
  }

  async createImport(context: ConsoleContext, source: OrderImportSource, identity: string, signal?: AbortSignal) {
    const uploaded = await this.uploads.upload(context, source.file, signal, undefined, identity);
    const value = await this.operations.importsCreate({ body: { objectRef: uploaded.objectRef, sha256: uploaded.sha256, fileName: uploaded.fileName } }, command(context, identity, signal));
    return this.mapper.importTask(value);
  }

  async createExport(context: ConsoleContext, filter: OrderListFilter, identity: string, signal?: AbortSignal) {
    const value = await this.operations.ordersExport({ body: orderFilterQuery(filter) }, command(context, identity, signal));
    return this.mapper.exportTask(value);
  }

  async receive(context: ConsoleContext, order: OrderDetail, reason: string, identity: string, signal?: AbortSignal) {
    const value = await this.operations.ordersReceive(
      { path: { orderid: order.id }, body: { expectedVersion: order.version, reason: reason.trim() } },
      command(context, identity, signal, order.version)
    );
    return this.mapper.received(value);
  }

  async cancel(context: ConsoleContext, order: OrderDetail, reason: string, identity: string, signal?: AbortSignal) {
    const value = await this.operations.ordersCancel(
      { path: { orderid: order.id }, body: { expectedVersion: order.version, reason: reason.trim() } },
      command(context, identity, signal, order.version)
    );
    return this.mapper.cancelled(value);
  }

  async remind(context: ConsoleContext, order: OrderDetail, identity: string, signal?: AbortSignal) {
    const value = await this.operations.remindersCreate({ path: { orderid: order.id }, body: {} }, command(context, identity, signal));
    return this.mapper.reminder(value);
  }

  async decideAftersale(context: ConsoleContext, sale: AfterSaleRecord, decision: OrderAfterSaleDecision, reason: string, identity: string, signal?: AbortSignal) {
    const input = { path: { aftersaleid: sale.id }, body: { reason: reason.trim() } };
    const request = command(context, identity, signal, sale.version);
    const value = decision === 'approve' ? await this.operations.aftersalesApprove(input, request) : await this.operations.aftersalesReject(input, request);
    return this.mapper.aftersale(value, decision);
  }


  async ship(context: ConsoleContext, target: OrderFulfillment, tracking: string, carrier: string, identity: string, signal?: AbortSignal) {
    const value = await this.fulfillmentOperations.shipmentsCreate(
      { path: { fulfillmentid: target.id }, body: { tracking: tracking.trim(), ...(carrier.trim() === '' ? {} : { carrier: carrier.trim() }) } },
      command(context, identity, signal, target.version)
    );
    return this.mapper.shipment(value);
  }

  async receiveReturn(context: ConsoleContext, target: OrderReturn, tracking: string, identity: string, signal?: AbortSignal) {
    const value = await this.fulfillmentOperations.returnsReceive(
      { path: { returnid: target.id }, body: { ...(tracking.trim() === '' ? {} : { tracking: tracking.trim() }) } },
      command(context, identity, signal, target.version)
    );
    return this.mapper.returned(value, false);
  }

  async inspectReturn(context: ConsoleContext, target: OrderReturn, accepted: boolean, note: string, identity: string, signal?: AbortSignal) {
    const value = await this.fulfillmentOperations.returnsInspect(
      { path: { returnid: target.id }, body: { accepted, ...(note.trim() === '' ? {} : { inspection: { note: note.trim() } }) } },
      command(context, identity, signal, target.version)
    );
    return this.mapper.returned(value, true);
  }

  async refund(context: ConsoleContext, order: OrderDetail, amountMinor: number, reason: string, proof: string, identity: string, signal?: AbortSignal) {
    if (!order.payment.paymentId) throw new Error('PAYMENT_NOT_REFUNDABLE');
    const value = await this.paymentOperations.refundsRequest(
      { body: { payment: order.payment.paymentId, amountMinor, reason: reason.trim() } },
      command(context, identity, signal, order.payment.version, proof)
    );
    return this.mapper.refund(value);
  }

  async resolveRecovery(context: ConsoleContext, recovery: OrderRecovery, action: OrderRecoveryAction, reason: string, proof: string, identity: string, signal?: AbortSignal) {
    const value = await this.paymentOperations.recoveriesResolve(
      { path: { caseid: recovery.id }, body: { action, reason: reason.trim() } },
      command(context, identity, signal, recovery.version, proof)
    );
    return this.mapper.recovery(value);
  }
}

function orderFilterQuery(filter: OrderListFilter) {
  return {
    ...(filter.search === '' ? {} : { search: filter.search }),
    ...(filter.placed === '' ? {} : { placed: filter.placed as never }),
    ...(filter.from === '' ? {} : { from: instant(filter.from, false) }),
    ...(filter.to === '' ? {} : { to: instant(filter.to, true) }),
    ...(filter.lifecycle === '' ? {} : { lifecycle: filter.lifecycle as never }),
    ...(filter.payment === '' ? {} : { payment: filter.payment as never }),
    ...(filter.fulfillment === '' ? {} : { fulfillment: filter.fulfillment as never }),
    ...(filter.mall === '' ? {} : { mall: filter.mall }),
    ...(filter.channel === '' ? {} : { channel: filter.channel }),
    ...(filter.product === '' ? {} : { product: filter.product }),
    ...(filter.member === '' ? {} : { member: filter.member }),
    ...(filter.minimumMinor === '' ? {} : { minimumMinor: Number(filter.minimumMinor) }),
    ...(filter.maximumMinor === '' ? {} : { maximumMinor: Number(filter.maximumMinor) }),
  } as const;
}

function command(context: ConsoleContext, identity: string, signal?: AbortSignal, expectedVersion?: number, proof?: string) {
  return consoleCommand(context.scope, {
    accessVersion: context.session.accessVersion,
    idempotencyKey: identity,
    ...(expectedVersion === undefined ? {} : { expectedVersion }),
    ...(proof === undefined ? {} : { proof }),
    ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
    ...(signal === undefined ? {} : { signal }),
  });
}

function instant(value: string, end: boolean): string {
  const source = value.includes('T') ? value : `${value}T${end ? '23:59:59.999' : '00:00:00.000'}`;
  return new Date(source).toISOString();
}
