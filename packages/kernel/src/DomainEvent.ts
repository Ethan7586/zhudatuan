export interface DomainEvent<TPayload extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>> {
  readonly event: string;
  readonly type: string;
  readonly version: number;
  readonly aggregate: Readonly<{ type: string; id: string; version: number }>;
  readonly tenant: string;
  readonly occurred: string;
  readonly trace: string;
  readonly actor: string;
  readonly correlation: string;
  readonly causation: string;
  readonly payloadVersion: number;
  readonly payload: TPayload;
}

type DomainEventDraft<TPayload extends Readonly<Record<string, unknown>>> = Omit<DomainEvent<TPayload>, 'actor' | 'correlation' | 'causation' | 'payloadVersion'> &
  Partial<Pick<DomainEvent<TPayload>, 'actor' | 'correlation' | 'causation' | 'payloadVersion'>>;

export function domainEvent<TPayload extends Readonly<Record<string, unknown>>>(draft: DomainEventDraft<TPayload>): DomainEvent<TPayload> {
  const value: DomainEvent<TPayload> = {
    ...draft,
    actor: draft.actor ?? `system:${draft.aggregate.type}`,
    correlation: draft.correlation ?? draft.trace,
    causation: draft.causation ?? draft.trace,
    payloadVersion: draft.payloadVersion ?? draft.version,
  };
  if (
    !value.event ||
    !/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/.test(value.type) ||
    !Number.isSafeInteger(value.version) ||
    value.version < 1 ||
    !value.aggregate.type ||
    !value.aggregate.id ||
    !Number.isSafeInteger(value.aggregate.version) ||
    value.aggregate.version < 1 ||
    !value.tenant ||
    !value.trace ||
    !value.actor ||
    !value.correlation ||
    !value.causation ||
    !Number.isSafeInteger(value.payloadVersion) ||
    value.payloadVersion < 1 ||
    Number.isNaN(Date.parse(value.occurred))
  ) {
    throw new Error('DOMAIN_EVENT_INVALID');
  }
  return Object.freeze({ ...value, aggregate: Object.freeze({ ...value.aggregate }), payload: Object.freeze({ ...value.payload }) });
}
