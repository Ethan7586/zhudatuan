export type FrontendClient = 'console' | 'auth' | 'storefront';

export interface FrontendExecutionTrace {
  readonly client: FrontendClient;
  readonly route: string;
  readonly feature: string;
  readonly operation: string;
  readonly test: string;
  readonly files: Readonly<{
    route: string;
    feature: string;
    sdk: string;
  }>;
  readonly callers: readonly string[];
  readonly callees: readonly string[];
  readonly evidence: readonly string[];
  readonly status: 'Missing' | 'Designed' | 'Implemented' | 'Integrated' | 'Accepted' | 'Released';
}

export function clientFor(prefix: string): FrontendClient {
  return 'console';
}

export function featureFor(prefix: string, module: string): string {
  const area = prefix === 'STORE' ? 'store' : prefix === 'SUPPLY' ? 'supplier' : prefix === 'GROUP' ? 'enterprise' : prefix === 'MALL' ? 'mall' : prefix === 'DIST' ? 'distribution' : 'platform';
  return area + '/' + module;
}

export function executionTrace(
  input: Readonly<{
    prefix: string;
    module: string;
    route: string;
    operation: string;
    test: string;
  }>
): FrontendExecutionTrace {
  const client = clientFor(input.prefix);
  const feature = featureFor(input.prefix, input.module);
  return Object.freeze({
    client,
    route: input.route,
    feature,
    operation: input.operation,
    test: input.test,
    files: Object.freeze({
      route: 'apps/console/src/route/Router.tsx',
      feature: `apps/${client}/src/feature/${input.module}`,
      sdk: 'packages/sdk/src/operations/CommerceClient.ts',
    }),
    callers: Object.freeze([`${client}:${input.route}`, feature]),
    callees: Object.freeze([`sdk:${input.operation}`, `operation:${input.operation}`]),
    evidence: Object.freeze([]),
    status: 'Designed',
  });
}
