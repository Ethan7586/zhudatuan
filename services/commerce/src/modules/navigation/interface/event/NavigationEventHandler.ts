import type { NavigationInvalidator } from '../../infrastructure/cache/NavigationInvalidator';

export interface NavigationEventEnvelope {
  readonly id: string;
  readonly type: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export class NavigationEventHandler {
  constructor(private readonly invalidator: NavigationInvalidator) {}
  handle(event: NavigationEventEnvelope): Promise<boolean> {
    const text = (name: string): string | undefined => (typeof event.payload[name] === 'string' ? event.payload[name] : undefined);
    const principal = text('principalId');
    const membership = text('membershipId');
    const scope = text('scopeId');
    const catalog = event.type === 'navigation.catalog.changed';
    return this.invalidator.invalidate({
      event: event.id,
      ...(principal === undefined ? {} : { principal }),
      ...(membership === undefined ? {} : { membership }),
      ...(scope === undefined ? {} : { scope }),
      ...(catalog ? { catalog: true } : {}),
    });
  }
}
