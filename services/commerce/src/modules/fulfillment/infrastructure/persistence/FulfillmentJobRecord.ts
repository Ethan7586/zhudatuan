import { FulfillmentOrder } from '../../domain/model/FulfillmentOrder';
import type { FulfillmentRow } from './FulfillmentJobContext';
import { requiredJobText as text } from './FulfillmentJobValue';

export function fulfillmentLines(loaded: FulfillmentRow): readonly Readonly<{ line: string; quantity: number }>[] {
  return loaded.lines.map((value) => {
    const line = text(value.line, 'FULFILLMENT_LINE_REQUIRED');
    const quantity = Number(value.quantity);
    if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('FULFILLMENT_QUANTITY_INVALID');
    return Object.freeze({ line, quantity });
  });
}

export function fulfillment(loaded: FulfillmentRow): FulfillmentOrder {
  return FulfillmentOrder.load({
    id: loaded.id,
    order: loaded.order_id,
    route: loaded.route,
    kind: loaded.kind,
    state: loaded.state as Parameters<typeof FulfillmentOrder.load>[0]['state'],
    lines: fulfillmentLines(loaded),
    version: loaded.version,
  });
}

type TrackingState = 'created' | 'accepted' | 'ready' | 'shipped' | 'intransit' | 'outfordelivery' | 'delivered' | 'pickedup' | 'completed' | 'exception' | 'returned';
export function trackingState(value: string): TrackingState {
  const normalized = value.toLowerCase().replace(/[^a-z]/g, '');
  if ((['created', 'accepted', 'ready', 'shipped', 'intransit', 'outfordelivery', 'delivered', 'pickedup', 'completed', 'exception', 'returned'] as readonly string[]).includes(normalized)) {
    return normalized as TrackingState;
  }
  throw new Error('TRACKING_STATE_INVALID');
}
