import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { AfterSalePage, AfterSaleQuery } from '../model/AfterSale';
import type { AfterSaleRecord } from '../model/AfterSale';
import type { OrderAfterSaleDecision, OrderCommandReceipt, OrderDetail, OrderExportTask, OrderFulfillment, OrderImportSource, OrderImportTask, OrderOperationReceipt, OrderPage, OrderRecovery, OrderRecoveryAction, OrderRecoveryPage, OrderReturn, OrderSupportCase } from '../model/Order';
import type { OrderListFilter } from '../model/OrderFilter';
import type { OrderQuery } from '../model/OrderQuery';

export interface OrderPort {
  orders(context: ConsoleContext, filter: OrderQuery, signal?: AbortSignal): Promise<OrderPage>;
  order(context: ConsoleContext, reference: string, signal?: AbortSignal): Promise<OrderDetail>;
  support(context: ConsoleContext, reference: string, signal?: AbortSignal): Promise<readonly OrderSupportCase[]>;
  recoveries(context: ConsoleContext, reference?: string, signal?: AbortSignal): Promise<OrderRecoveryPage>;
  aftersales(context: ConsoleContext, filter: AfterSaleQuery, signal?: AbortSignal): Promise<AfterSalePage>;
  createImport(context: ConsoleContext, source: OrderImportSource, identity: string, signal?: AbortSignal): Promise<OrderImportTask>;
  createExport(context: ConsoleContext, filter: OrderListFilter, identity: string, signal?: AbortSignal): Promise<OrderExportTask>;
  cancel(context: ConsoleContext, order: OrderDetail, reason: string, identity: string, signal?: AbortSignal): Promise<OrderCommandReceipt>;
  receive(context: ConsoleContext, order: OrderDetail, reason: string, identity: string, signal?: AbortSignal): Promise<OrderCommandReceipt>;
  remind(context: ConsoleContext, order: OrderDetail, identity: string, signal?: AbortSignal): Promise<OrderCommandReceipt>;
  decideAftersale(context: ConsoleContext, sale: AfterSaleRecord, decision: OrderAfterSaleDecision, reason: string, identity: string, signal?: AbortSignal): Promise<OrderCommandReceipt>;
  ship(context: ConsoleContext, target: OrderFulfillment, tracking: string, carrier: string, identity: string, signal?: AbortSignal): Promise<OrderOperationReceipt>;
  receiveReturn(context: ConsoleContext, target: OrderReturn, tracking: string, identity: string, signal?: AbortSignal): Promise<OrderOperationReceipt>;
  inspectReturn(context: ConsoleContext, target: OrderReturn, accepted: boolean, note: string, identity: string, signal?: AbortSignal): Promise<OrderOperationReceipt>;
  refund(context: ConsoleContext, order: OrderDetail, amountMinor: number, reason: string, proof: string, identity: string, signal?: AbortSignal): Promise<OrderOperationReceipt>;
  resolveRecovery(context: ConsoleContext, recovery: OrderRecovery, action: OrderRecoveryAction, reason: string, proof: string, identity: string, signal?: AbortSignal): Promise<OrderOperationReceipt>;
}
