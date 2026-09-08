import { CAPABILITY_CODES_BY_OWNER, OperationCatalog } from '@shop/contract';
import { describe, expect, it } from 'vitest';
import type { RegisteredOperationHandler } from '../../../pipeline/OperationHandler';
import { Manifest, ReportingCapabilities } from '../Manifest';
import { ReportingModule } from '../Module';

describe('reporting module assembly', () => {
  it('registers every canonical reporting query and export operation', () => {
    const operations = OperationCatalog.all().filter(({ module }) => module === 'reporting');
    const registered: string[] = [];
    ReportingModule.register({
      workload: 'api',
      handlers: { add: (_owner: string, handler: RegisteredOperationHandler) => registered.push(handler.operation) } as never,
      events: { add: () => undefined },
      ports: { get: () => ({}) as never },
      service: () => ({}) as never,
    });

    expect(ReportingCapabilities).toBe(CAPABILITY_CODES_BY_OWNER.reporting);
    expect(ReportingModule.capabilities).toEqual(ReportingCapabilities);
    expect(new Set(registered)).toEqual(new Set(operations.map(({ id }) => id)));
  });

  it('keeps API and job resources workload-local', () => {
    expect(Manifest.workloads.api.dependencies).toEqual(['runtime']);
    expect(Manifest.workloads.api.services).toEqual(['database.pool', 'audit.sink', 'cache', 'object.store']);
    expect(Manifest.workloads.jobs.dependencies).toEqual(['runtime']);
    expect(Manifest.workloads.jobs.services).toEqual(['database.pool', 'cache']);
  });
});
