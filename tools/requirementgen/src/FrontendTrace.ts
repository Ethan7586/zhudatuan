import type { RouteTrace } from './RouteTrace';
import type { DeliveryStatus } from './DeliveryStatus';

export type FrontendClient = RouteTrace['surface'];

export interface FrontendExecutionTrace {
  readonly routeid: string;
  readonly client: FrontendClient;
  readonly route: string;
  readonly feature: string;
  readonly operation: string;
  readonly test: string;
  readonly files: Readonly<{
    route: string;
    manifest: string;
    viewmodel: string;
    sdk: string;
  }>;
  readonly callers: readonly string[];
  readonly callees: readonly string[];
  readonly evidence: readonly string[];
  readonly status: DeliveryStatus;
}

export function executionTraces(input: Readonly<{ route: string; operation: string; test: string }>, routes: readonly RouteTrace[]): readonly FrontendExecutionTrace[] {
  const matches = routes.filter(({ path }) => path === input.route);
  if (matches.length === 0) throw new Error(`FRONTEND_ROUTE_TRACE_MISSING:${input.route}`);
  return Object.freeze(
    matches.map((route) =>
      Object.freeze({
        routeid: route.id,
        client: route.surface,
        route: route.path,
        feature: route.feature,
        operation: input.operation,
        test: input.test,
        files: Object.freeze({
          route: route.source,
          manifest: route.manifest,
          viewmodel: route.viewmodel,
          sdk: 'packages/sdk/src/operations/CommerceClient.ts',
        }),
        callers: Object.freeze([`route:${route.id}`, `feature:${route.surface}/${route.feature}`]),
        callees: Object.freeze([`viewmodel:${route.surface}/${route.feature}`, `sdk:${input.operation}`, `operation:${input.operation}`]),
        evidence: Object.freeze([route.source, route.manifest, route.viewmodel, route.test]),
        status: 'Implemented' as const,
      })
    )
  );
}
