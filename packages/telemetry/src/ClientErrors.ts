import { Redactor } from './Redactor';

export interface TelemetryScope {
  readonly kind: string;
  readonly id: string;
  readonly tenant?: string;
  readonly path: readonly Readonly<{ kind: string; id: string }>[];
}

export interface ClientErrorInput {
  readonly scope: TelemetryScope;
  readonly surface: string;
  readonly route: string;
  readonly operation: string | null;
  readonly release: string;
  readonly message: string;
  readonly stack: string | null;
  readonly componentStack: string | null;
  readonly traceId: string;
  readonly actorId: string;
  readonly membershipId: string;
}

export interface ClientErrorRecord extends ClientErrorInput {
  readonly fingerprint: string;
  readonly faultCode: string;
  readonly occurrences: number;
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
}

export interface ClientErrorTelemetry {
  record(input: ClientErrorInput): ClientErrorRecord;
  list(scope: TelemetryScope, limit: number): readonly ClientErrorRecord[];
}

export type ClientErrorWriter = (record: Readonly<Record<string, unknown>>) => void | Promise<void>;

export class ClientErrorBuffer implements ClientErrorTelemetry {
  private readonly records = new Map<string, ClientErrorRecord>();
  private readonly redactor = new Redactor();

  constructor(
    private readonly writer: ClientErrorWriter,
    private readonly capacity = 2_000,
    private readonly retentionMs = 7 * 24 * 60 * 60 * 1_000,
    private readonly now = () => Date.now(),
    private readonly sampleRate = 1
  ) {
    if (!Number.isSafeInteger(capacity) || capacity < 1 || retentionMs < 1 || !Number.isFinite(sampleRate) || sampleRate < 0 || sampleRate > 1) throw new Error('TELEMETRY_BUFFER_CONFIG_INVALID');
  }

  record(input: ClientErrorInput): ClientErrorRecord {
    const timestamp = this.now();
    this.prune(timestamp);
    const safe = this.redactor.redact(input) as ClientErrorInput;
    const fingerprint = fingerprintOf(`${safe.scope.id}\n${safe.surface}\n${safe.release}\n${safe.route}\n${safe.operation ?? ''}\n${safe.message}\n${safe.stack ?? ''}`);
    const current = this.records.get(fingerprint);
    const observedAt = new Date(timestamp).toISOString();
    const record = Object.freeze({ ...safe, fingerprint, faultCode: faultCode(fingerprint), occurrences: (current?.occurrences ?? 0) + 1, firstSeenAt: current?.firstSeenAt ?? observedAt, lastSeenAt: observedAt });
    this.records.delete(fingerprint);
    this.records.set(fingerprint, record);
    this.trim();
    if (sampled(fingerprint, this.sampleRate) && aggregateBoundary(record.occurrences)) {
      const { message, stack, componentStack, ...attributes } = record;
      void this.writer(Object.freeze({
        kind: 'clienterror', event: 'client.error', sampleRate: this.sampleRate, ...attributes,
        detailReference: `clienterror:${fingerprint}`,
        detail: Object.freeze({ message, stack, componentStack }),
      }));
    }
    return record;
  }

  list(scope: TelemetryScope, limit: number): readonly ClientErrorRecord[] {
    this.prune(this.now());
    return Object.freeze(
      [...this.records.values()]
        .reverse()
        .filter((record) => contains(scope, record.scope))
        .slice(0, limit)
    );
  }

  private prune(timestamp: number): void {
    const earliest = timestamp - this.retentionMs;
    for (const [key, record] of this.records) if (Date.parse(record.lastSeenAt) < earliest) this.records.delete(key);
  }

  private trim(): void {
    while (this.records.size > this.capacity) {
      const oldest = this.records.keys().next().value;
      if (oldest === undefined) return;
      this.records.delete(oldest);
    }
  }
}

function aggregateBoundary(occurrences: number): boolean {
  return (occurrences & (occurrences - 1)) === 0;
}

function sampled(fingerprint: string, rate: number): boolean {
  if (rate === 1) return true;
  if (rate === 0) return false;
  return Number.parseInt(fingerprint.slice(0, 8), 16) / 0x1_0000_0000 < rate;
}

function contains(grant: TelemetryScope, resource: TelemetryScope): boolean {
  if (grant.kind === 'platform') return true;
  if (grant.tenant !== undefined && resource.tenant !== grant.tenant) return false;
  return grant.id === resource.id || resource.path.some((ancestor) => ancestor.kind === grant.kind && ancestor.id === grant.id);
}

function fingerprintOf(value: string): string {
  return [0x811c9dc5, 0x9e3779b1, 0x85ebca6b, 0xc2b2ae35].map((seed) => hash(value, seed).toString(16).padStart(8, '0')).join('');
}

function hash(value: string, seed: number): number {
  let result = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 0x01000193) >>> 0;
  }
  return result;
}

function faultCode(fingerprint: string): string {
  return `SW-${fingerprint.slice(0, 4).toUpperCase()}-${fingerprint.slice(4, 8).toUpperCase()}`;
}
