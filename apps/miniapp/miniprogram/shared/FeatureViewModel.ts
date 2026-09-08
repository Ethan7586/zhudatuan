import type { MiniappSurfaceClient, OperationExecutor, RequestContext } from '@shop/sdk';
import type { RouteId, RouteMatch } from '../generated/RouteBinding';
import type { MiniappAction, MiniappActionInput, MiniappCommandResult } from '@shop/presentation/actions';

export interface MiniappFeatureViewModel {
  readonly defaultRoute: RouteId;
  readonly routes: readonly RouteId[];
  readonly title: string;
  readonly description: string;
  readonly bootstrap?: true;
  connect(executor: OperationExecutor): MiniappSurfaceClient;
  read?(client: MiniappSurfaceClient, context: RequestContext, route: RouteMatch): Promise<unknown>;
  project?(value: unknown, route: RouteMatch): unknown;
  actions?(value: unknown, route: RouteMatch): readonly MiniappAction[];
  execute?(client: MiniappSurfaceClient, context: RequestContext, route: RouteMatch, value: unknown, action: MiniappAction, input: MiniappActionInput): Promise<MiniappCommandResult>;
  destination?(value: unknown, route: RouteMatch, record: string): string | undefined;
}

type MiniappClientSlice = { readonly [TDomain in keyof MiniappSurfaceClient]?: Partial<MiniappSurfaceClient[TDomain]> };

export function connectMiniappClient(slice: MiniappClientSlice): MiniappSurfaceClient {
  return Object.freeze(Object.fromEntries(Object.entries(slice).map(([domain, operations]) => [domain, Object.freeze(operations)]))) as unknown as MiniappSurfaceClient;
}

export function defineMiniappFeature(definition: MiniappFeatureViewModel): MiniappFeatureViewModel {
  if (definition.routes.length === 0 || !definition.routes.includes(definition.defaultRoute)) throw new Error('MINIAPP_FEATURE_ROUTE_INVALID');
  if (definition.bootstrap !== true && definition.read === undefined) throw new Error('MINIAPP_FEATURE_READER_REQUIRED');
  return Object.freeze({ ...definition, routes: Object.freeze([...definition.routes]) });
}
