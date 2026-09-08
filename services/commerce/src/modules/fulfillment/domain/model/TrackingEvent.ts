export type TrackingStatus = 'created' | 'accepted' | 'ready' | 'shipped' | 'intransit' | 'outfordelivery' | 'delivered' | 'pickedup' | 'completed' | 'exception' | 'returned';

export interface TrackingEventSnapshot {
  readonly id: string;
  readonly package: string;
  readonly external: string;
  readonly state: TrackingStatus;
  readonly description: string;
  readonly location: string | null;
  readonly occurredAt: string;
  readonly receivedAt: string;
  readonly evidence: Readonly<Record<string, unknown>>;
}

export class TrackingEvent {
  private constructor(readonly value: Readonly<TrackingEventSnapshot>) {}

  static record(value: TrackingEventSnapshot): TrackingEvent {
    if (!value.id || !value.package || !value.external || !states.has(value.state) || !instant(value.occurredAt) || !instant(value.receivedAt)) {
      throw new Error('TRACKING_EVENT_INVALID');
    }
    return new TrackingEvent(Object.freeze({ ...value, location: value.location?.trim() || null, evidence: Object.freeze({ ...value.evidence }) }));
  }

  advances(current: TrackingStatus): boolean {
    if (this.value.state === 'exception') return false;
    return rank(this.value.state) >= rank(current);
  }
}

const states = new Set<TrackingStatus>(['created', 'accepted', 'ready', 'shipped', 'intransit', 'outfordelivery', 'delivered', 'pickedup', 'completed', 'exception', 'returned']);
const ranks: Readonly<Record<Exclude<TrackingStatus, 'exception'>, number>> = Object.freeze({ created: 0, accepted: 1, ready: 2, shipped: 3, intransit: 4, outfordelivery: 5, delivered: 6, pickedup: 6, completed: 7, returned: 8 });
function rank(value: TrackingStatus): number {
  return value === 'exception' ? -1 : ranks[value];
}
function instant(value: string): boolean {
  return Number.isFinite(new Date(value).getTime());
}
