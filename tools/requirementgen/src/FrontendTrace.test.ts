import { describe, expect, it } from 'vitest';

import { executionTrace } from './FrontendTrace';

describe('frontend execution trace', () => {
  it.each([
    ['GROUP', 'reporting', 'console', 'enterprise/reporting'],
    ['STORE', 'verification', 'store', 'store/verification'],
    ['SUPPLY', 'catalog', 'supplier', 'supplier/catalog'],
  ] as const)('maps %s ownership without claiming evidence', (prefix, module, client, feature) => {
    const trace = executionTrace({
      prefix,
      module,
      route: '/target',
      operation: 'domain.operation.read',
      test: 'tests/journeys/target.spec.ts',
    });

    expect(trace).toMatchObject({
      client,
      feature,
      route: '/target',
      operation: 'domain.operation.read',
      status: 'Missing',
      evidence: [],
      files: { route: `apps/${client}/src/route/routes.tsx`, feature: `apps/${client}/src/feature/${module}` },
    });
  });
});
