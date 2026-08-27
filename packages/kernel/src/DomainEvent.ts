export interface DomainEvent<TPayload extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>> {
  readonly event: string;
  readonly type: string;
  readonly version: number;
  readonly aggregate: Readonly<{ type: string; id: string }>;
  readonly tenant: string;
  readonly occurred: string;
  readonly trace: string;
  readonly payload: TPayload;
}

export function domainEvent<TPayload extends Readonly<Record<string, unknown>>>(value: DomainEvent<TPayload>): DomainEvent<TPayload> {
  if (!value.event || !/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/.test(value.type) || !Number.isSafeInteger(value.version) || value.version < 1
    || !value.aggregate.type || !value.aggregate.id || !value.tenant || !value.trace || Number.isNaN(Date.parse(value.occurred))) {
    throw new Error('DOMAIN_EVENT_INVALID');
  }
  return Object.freeze({ ...value, aggregate: Object.freeze({ ...value.aggregate }), payload: Object.freeze({ ...value.payload }) });
}
