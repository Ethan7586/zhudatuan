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
    const text = (name: string): string | undefined => (typeof event.payload[name] === 'string' ? event.payload[name] : undefined);
    const principal = text('principalId');
    const membership = text('membershipId');
    const payloadScope = text('scopeId');
    if (payloadScope !== undefined && payloadScope !== event.scope) throw new Error('NAVIGATION_EVENT_SCOPE_MISMATCH');
    const catalog = event.type === 'navigation.catalog.changed';
    return this.invalidator.invalidate({
      event: event.id,
      ...(principal === undefined ? {} : { principal }),
      ...(membership === undefined ? {} : { membership }),
      scope: event.scope,
      ...(catalog ? { catalog: true } : {}),
    });
  }
}
