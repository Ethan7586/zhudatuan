import { CAPABILITY_CODES_BY_OWNER, OperationCatalog } from '@shop/contract';
import { describe, expect, it } from 'vitest';
import type { RegisteredOperationHandler } from '../../../pipeline/OperationHandler';
import { Manifest, NotificationCapabilities } from '../Manifest';
import { NotificationModule } from '../Module';

describe('notification module assembly', () => {
  it('registers every canonical notification operation and owns its capabilities', () => {
    const operations = OperationCatalog.all().filter(({ module }) => module === 'notification');
    const registered: string[] = [];
    NotificationModule.register({
      workload: 'api',
      handlers: { add: (_owner: string, handler: RegisteredOperationHandler) => registered.push(handler.operation) } as never,
      events: { add: () => undefined },
      ports: { get: () => ({}) as never },
      service: () => ({}) as never,
    });

    expect(NotificationCapabilities).toBe(CAPABILITY_CODES_BY_OWNER.notification);
    expect(NotificationModule.capabilities).toEqual(NotificationCapabilities);
    expect(new Set(registered)).toEqual(new Set(operations.map(({ id }) => id)));
  });

  it('keeps API and job dependencies explicit and workload-local', () => {
    expect(Manifest.workloads.api.dependencies).toEqual(['access', 'identity', 'organization']);
    expect(Manifest.workloads.api.services).toEqual(['kms.client']);
    expect(Manifest.workloads.jobs.dependencies).toEqual(['identity', 'organization']);
    expect(Manifest.workloads.jobs.services).toEqual(['database.pool', 'kms.client', 'notification.deliveries']);
  });
});
