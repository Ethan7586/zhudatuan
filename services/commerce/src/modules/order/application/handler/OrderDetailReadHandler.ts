import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { DomainError } from '../../../../platform/error/DomainError';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { AuditReadPort } from '../../../audit/public';
import { OrderVisibility, type OrderSection } from '../../domain/policy/OrderVisibility';
import type { OrderDetailRepository } from '../port/OrderDetailRepository';
import { orderTime } from '../model/OrderTime';
import { OrderLabels, type ResolvedOrderLabels } from '../service/OrderLabels';

type Detail = OperationOutputFor<'order.detail.read'>;
type Section = Exclude<OrderSection, 'summary'>;

export class OrderDetailReadHandler implements OperationHandler<'order.detail.read', 'read'> {
  readonly operation = 'order.detail.read' as const;
  readonly mode = 'read' as const;
  constructor(
    private readonly orders: OrderDetailRepository,
    private readonly audit: AuditReadPort,
    private readonly labels: OrderLabels,
    private readonly visibility = new OrderVisibility()
  ) {}

  async execute(input: OperationInputFor<'order.detail.read'>, context: HandlerContext<'order.detail.read'>): Promise<OperationReply<Detail>> {
    const access = requireSession(context.security);
    const summary = await this.orders.summary(context.transaction, input.path.orderid, context);
    if (!summary) throw new DomainError('RESOURCE_NOT_FOUND');
    const visible = this.visibility.sections(access.scope.kind);
    const partner = ['supplier', 'store'].includes(access.scope.kind) ? access.scope.id : null;
    const [products, payment, fulfillment, aftersale, finance, auditRecords] = await Promise.all([
      this.section('products', visible, context, () => this.orders.products(context.transaction, summary.id, partner)),
      this.section('payment', visible, context, () => this.orders.payment(context.transaction, summary.id)),
      this.section('fulfillment', visible, context, () => this.orders.fulfillment(context.transaction, summary.id, partner)),
      this.section('aftersale', visible, context, () => this.orders.aftersale(context.transaction, summary.id)),
      this.section('finance', visible, context, async () => {
        const value = await this.orders.finance(context.transaction, summary.id);
        return Object.freeze({ ...value, watermark: orderTime(value.watermark) });
      }),
      this.section('audit', visible, context, () =>
        this.audit.records(context.transaction, {
          scopes: [summary.scopeId],
          references: [{ kind: 'object', id: summary.id }],
          limit: 100,
        })
      ),
    ]);
    const resolved = await this.labels.resolve(context.transaction, access.scope.id, {
      members: [summary.memberId],
      organizations: [summary.scopeId, summary.mallId],
      partners: sectionValues(products, 'partner').concat(sectionValues(fulfillment, 'partner')),
      principals: auditRecords.state === 'ready' ? auditRecords.data.flatMap((record) => (record.actor.id === null ? [] : [record.actor.id])) : [],
      privateMembers: partner !== null,
    });
    const productDetails = withPartnerNames(products, resolved);
    const fulfillmentDetails = withPartnerNames(fulfillment, resolved);
    const audit =
      auditRecords.state === 'ready'
        ? Object.freeze({
            state: 'ready' as const,
            data: Object.freeze(
              auditRecords.data.map((record) =>
                Object.freeze({
                  id: record.id,
                  action: record.operation,
                  resourceType: record.object.type,
                  resourceMasked: record.object.id === null ? null : `${record.object.type} ····${record.object.id.slice(-4)}`,
                  actorName: resolved.actor(record.actor.id, record.actor.type),
                  occurredAt: record.occurredAt,
                  traceMasked: `追踪 ····${record.trace.slice(-4)}`,
                })
              )
            ),
          })
        : auditRecords;
    return {
      status: 200,
      body: Object.freeze({
        summary: Object.freeze({
          ...summary,
          memberName: resolved.member(summary.memberId),
          scopeName: resolved.organization(summary.scopeId, 'scope'),
          mallName: resolved.organization(summary.mallId, 'mall'),
          orderedAt: orderTime(summary.orderedAt),
          receivedAt: orderTime(summary.receivedAt),
          createdAt: orderTime(summary.createdAt),
          updatedAt: orderTime(summary.updatedAt),
        }),
        products: productDetails,
        payment,
        fulfillment: fulfillmentDetails,
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

function sectionValues(section: Readonly<{ state: string; data?: readonly Readonly<Record<string, unknown>>[] }>, key: string): string[] {
  return section.state === 'ready' && section.data ? section.data.flatMap((item) => (typeof item[key] === 'string' && item[key].length > 0 ? [item[key]] : [])) : [];
}

function withPartnerNames<T extends Readonly<{ state: string; data?: readonly Readonly<Record<string, unknown>>[] }>>(section: T, labels: ResolvedOrderLabels): T {
  if (section.state !== 'ready' || section.data === undefined) return section;
  return Object.freeze({ ...section, data: Object.freeze(section.data.map((item) => Object.freeze({ ...item, partnerName: labels.partner(item.partner) }))) }) as T;
}

function label(section: Section): string {
  return ({ products: '商品明细', payment: '支付信息', fulfillment: '履约信息', aftersale: '售后信息', finance: '财务摘要', audit: '操作记录' } as const)[section];
}
