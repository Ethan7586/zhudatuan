import type { NavigationInvalidationPort } from '../../application/port/NavigationCacheRepository';

export interface NavigationEventEnvelope {
  readonly id: string;
  readonly type: string;
  readonly scope: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export class NavigationEventHandler {
  constructor(private readonly invalidator: NavigationInvalidationPort) {}

  handle(event: NavigationEventEnvelope): Promise<boolean> {
    const payloadScopes = values(event.payload, ['scopeId', 'scope']);
    if (payloadScopes.some((scope) => scope !== event.scope)) throw new Error('NAVIGATION_EVENT_SCOPE_MISMATCH');
    const principals = values(event.payload, ['principalId']);
    const memberships = values(event.payload, ['membershipId', 'membership', 'previousMembership', 'targetMembership']);
    const scopes = payloadScopes;
    if (scopes.length === 0 && event.type !== 'navigation.catalog.changed') scopes.push(event.scope);
    const targets = values(event.payload, ['target']);
    return this.invalidator.invalidate({
      event: event.id,
      ...(principals.length === 0 ? {} : { principals: Object.freeze(principals) }),
      ...(memberships.length === 0 ? {} : { memberships: Object.freeze(memberships) }),
      ...(scopes.length === 0 ? {} : { scopes: Object.freeze(scopes) }),
      ...(targets.length === 0 ? {} : { targets: Object.freeze(targets) }),
      ...(event.type === 'navigation.catalog.changed' ? { catalog: true } : {}),
    });
  }
}

function values(payload: Readonly<Record<string, unknown>>, fields: readonly string[]): string[] {
  return [...new Set(fields.flatMap((field) => (text(payload[field]) ? [text(payload[field])!] : [])))];
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
