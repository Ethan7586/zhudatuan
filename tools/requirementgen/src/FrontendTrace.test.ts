import { describe, expect, it } from 'vitest';

import { executionTrace } from './FrontendTrace';

describe('frontend execution trace', () => {
  it.each([
    ['GROUP', 'reporting', 'enterprise/reporting'],
    ['STORE', 'verification', 'store/verification'],
    ['SUPPLY', 'catalog', 'supplier/catalog'],
  ] as const)('maps %s ownership into the canonical console without claiming evidence', (prefix, module, feature) => {
    const trace = executionTrace({
      prefix,
      module,
      route: '/target',
      operation: 'domain.operation.read',
      test: 'tests/journey/target.spec.ts',
    });

    expect(trace).toMatchObject({
      client: 'console',
      feature,
      route: '/target',
      operation: 'domain.operation.read',
      status: 'Designed',
      evidence: [],
      files: { route: 'apps/console/src/route/Router.tsx', feature: `apps/console/src/feature/${module}` },
    });
  });
});
