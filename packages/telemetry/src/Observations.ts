export interface TelemetryObservation {
  readonly observedAt: string;
  readonly record: Readonly<Record<string, unknown>>;
}

export interface ObservationReader {
  read(since: string, limit: number): readonly TelemetryObservation[];
}

export class ObservationBuffer implements ObservationReader {
  private readonly items: TelemetryObservation[] = [];

  constructor(
    private readonly capacity: number,
    private readonly retentionMilliseconds: number,
    private readonly maximumRead: number,
    private readonly now = () => Date.now()
  ) {
    if (!Number.isSafeInteger(capacity) || capacity < 1 || !Number.isSafeInteger(retentionMilliseconds) || retentionMilliseconds < 1 || !Number.isSafeInteger(maximumRead) || maximumRead < 1 || maximumRead > capacity) {
      throw new Error('OBSERVATION_BUFFER_CONFIG_INVALID');
    }
  }

  record(value: Readonly<Record<string, unknown>>): void {
    const timestamp = this.now();
    this.prune(timestamp);
    this.items.push(Object.freeze({ observedAt: new Date(timestamp).toISOString(), record: value }));
    if (this.items.length > this.capacity) this.items.splice(0, this.items.length - this.capacity);
  }

  read(since: string, limit: number): readonly TelemetryObservation[] {
    const boundary = Date.parse(since);
    if (!Number.isFinite(boundary) || !Number.isSafeInteger(limit) || limit < 1 || limit > this.maximumRead) throw new Error('OBSERVATION_QUERY_INVALID');
    this.prune(this.now());
    return Object.freeze(this.items.filter((item) => Date.parse(item.observedAt) >= boundary).slice(-limit).map((item) => Object.freeze({ ...item })));
  }

  private prune(timestamp: number): void {
    const boundary = timestamp - this.retentionMilliseconds;
    const first = this.items.findIndex((item) => Date.parse(item.observedAt) >= boundary);
    if (first === -1) this.items.splice(0);
    else if (first > 0) this.items.splice(0, first);
  }
}
