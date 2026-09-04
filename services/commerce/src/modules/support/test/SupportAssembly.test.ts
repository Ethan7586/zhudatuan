import { CAPABILITY_CODES_BY_OWNER, OperationCatalog } from '@shop/contract';
import { describe, expect, it } from 'vitest';
import type { RegisteredOperationHandler } from '../../../foundation/application/OperationHandler';
import { Manifest, SupportCapabilities } from '../Manifest';
import { SupportModule } from '../Module';

describe('support module assembly', () => {
  it('registers every canonical Support operation without preview-only handlers', () => {
    const operations = OperationCatalog.all().filter(({ module }) => module === 'support');
    const registered: string[] = [];
    SupportModule.register({
      workload: 'api',
      handlers: { add: (_owner: string, handler: RegisteredOperationHandler) => registered.push(handler.operation) } as never,
      events: { add: () => undefined },
      ports: { get: () => ({}) as never },
      service: () => ({}) as never,
    });
    expect(SupportCapabilities).toBe(CAPABILITY_CODES_BY_OWNER.support);
    expect(SupportModule.capabilities).toEqual(SupportCapabilities);
    expect(new Set(registered)).toEqual(new Set(operations.map(({ id }) => id)));
  });

  it('keeps API and job dependencies explicit and workload-local', () => {
    expect(Manifest.workloads.api.dependencies).toEqual(['access', 'order', 'benefit', 'organization', 'member']);
    expect(Manifest.workloads.api.services).toEqual(['event.stream', 'kms.client', 'object.store', 'secret.store']);
    expect(Manifest.workloads.jobs.dependencies).toEqual(['runtime']);
    expect(Manifest.workloads.jobs.services).toEqual(['database.pool', 'object.store', 'event.stream']);
  });
});
