import { describe, expect, it } from 'vitest';
import { executionTraces } from './FrontendTrace';

describe('frontend execution trace', () => {
  it('maps one operation to every explicit matching route without guessing a client', () => {
    const traces = executionTraces(
      { route: '/target', operation: 'domain.operation.read', test: 'tests/journey/target.spec.ts' },
      [
        { id: 'consolefeature', surface: 'console', path: '/target', feature: 'reporting', requirements: ['MVPGROUPREPORT'], manifest: 'apps/console/src/feature/reporting/Manifest.ts', viewmodel: 'apps/console/src/feature/reporting/viewmodel', test: 'ReportingViewModel.test.ts' },
        { id: 'storefeature', surface: 'storefront', path: '/target', feature: 'reporting', requirements: ['MVPMALLREPORT'], manifest: 'apps/storefront/src/feature/reporting/Manifest.ts', viewmodel: 'apps/storefront/src/feature/reporting/viewmodel', test: 'ReportingViewModel.test.ts' },
      ]
    );
    expect(traces.map(({ routeid, client }) => [routeid, client])).toEqual([
      ['consolefeature', 'console'],
      ['storefeature', 'storefront'],
    ]);
    expect(traces[0]).toMatchObject({ feature: 'reporting', operation: 'domain.operation.read', status: 'Designed', evidence: [] });
  });

  it('rejects a binding that is absent from the route catalog', () => {
    expect(() => executionTraces({ route: '/missing', operation: 'domain.operation.read', test: 'tests/journey/target.spec.ts' }, [])).toThrow('FRONTEND_ROUTE_TRACE_MISSING');
  });
});
