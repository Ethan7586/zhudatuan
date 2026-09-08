import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { DomainError } from '../../../../platform/error/DomainError';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { AuditReadPort } from '../../../audit/public';
import { OrderVisibility, type OrderSection } from '../../domain/policy/OrderVisibility';
import type { OrderDetailRepository } from '../port/OrderDetailRepository';

type Detail = OperationOutputFor<'order.detail.read'>;
type Section = Exclude<OrderSection, 'summary'>;

export class OrderDetailReadHandler implements OperationHandler<'order.detail.read', 'read'> {
  readonly operation = 'order.detail.read' as const;
  readonly mode = 'read' as const;
  constructor(
    private readonly orders: OrderDetailRepository,
    private readonly audit: AuditReadPort,
    private readonly visibility = new OrderVisibility()
  ) {}

  async execute(input: OperationInputFor<'order.detail.read'>, context: HandlerContext<'order.detail.read'>): Promise<OperationReply<Detail>> {
    const access = requireSession(context.security);
    const summary = await this.orders.summary(context.transaction, input.path.orderid, context);
    if (!summary) throw new DomainError('RESOURCE_NOT_FOUND');
    const visible = this.visibility.sections(access.scope.kind);
    const partner = ['supplier', 'store'].includes(access.scope.kind) ? access.scope.id : null;
    const [products, payment, fulfillment, aftersale, finance, audit] = await Promise.all([
      this.section('products', visible, context, () => this.orders.products(context.transaction, summary.id, partner)),
      this.section('payment', visible, context, () => this.orders.payment(context.transaction, summary.id)),
      this.section('fulfillment', visible, context, () => this.orders.fulfillment(context.transaction, summary.id, partner)),
      this.section('aftersale', visible, context, () => this.orders.aftersale(context.transaction, summary.id)),
      this.section('finance', visible, context, async () => {
        const value = await this.orders.finance(context.transaction, summary.id);
        return Object.freeze({ ...value, watermark: iso(value.watermark) });
      }),
      this.section('audit', visible, context, async () =>
        (
          await this.audit.records(context.transaction, {
            scopes: [summary.scopeId],
            references: [{ kind: 'object', id: summary.id }],
            limit: 100,
          })
        ).map((record) =>
          Object.freeze({
            id: record.id,
            action: record.operation,
            resourceType: record.object.type,
            resourceMasked: record.object.id === null ? null : `${record.object.type} ····${record.object.id.slice(-4)}`,
            actorMasked: `${record.actor.type} ····${record.actor.id?.slice(-4) ?? '未知'}`,
            occurredAt: record.occurredAt,
            traceMasked: `追踪 ····${record.trace.slice(-4)}`,
          })
        )
      ),
    ]);
    return {
      status: 200,
      body: Object.freeze({
        summary: Object.freeze({ ...summary, orderedAt: iso(summary.orderedAt), receivedAt: iso(summary.receivedAt), createdAt: iso(summary.createdAt), updatedAt: iso(summary.updatedAt) }),
        products,
        payment,
        fulfillment,
        aftersale,
        finance,
        audit,
      }) as Detail,
    };
  }

  private async section<T>(name: Section, visible: ReadonlySet<OrderSection>, context: HandlerContext<'order.detail.read'>, read: () => Promise<T>) {
    if (!visible.has(name)) return Object.freeze({ state: 'hidden' as const });
    try {
      return Object.freeze({ state: 'ready' as const, data: await read() });
    } catch (cause) {
      if (context.signal.aborted) throw context.signal.reason;
      return Object.freeze({ state: 'unavailable' as const, error: { code: 'ORDER_DETAIL_SECTION_UNAVAILABLE', message: `${label(name)}暂时无法读取，其他订单信息仍可使用。`, retryable: true, traceId: context.traceId } });
    }
  }
}

function iso(value: Date | null): string | null;
function iso(value: Date): string;
function iso(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}
function label(section: Section): string {
  return ({ products: '商品明细', payment: '支付信息', fulfillment: '履约信息', aftersale: '售后信息', finance: '财务摘要', audit: '操作记录' } as const)[section];
}
