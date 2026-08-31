import { createFetchChannelDistributorsRead } from '@shop/sdk/channel';
import { createFetchRuntimeHealthDependency } from '@shop/sdk/runtime';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleRequest, organizationLayersRead } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { DistributorPageSchema, LayerPageSchema, RuntimeControlSchema } from './ControlSchema';

const distributorsRead = createFetchChannelDistributorsRead(appConfig.apiBaseUrl);
const healthDependency = createFetchRuntimeHealthDependency(appConfig.apiBaseUrl);

export const controlKey = (context: ConsoleContext, cursor: string | undefined) =>
  Object.freeze([
    'console',
    context.scope.kind,
    context.scope.id,
    context.session.accessVersion,
    context.scope.kind === 'distributor' ? 'channel.distributors.read' : context.scope.kind === 'platform' ? 'organization.layers.read' : 'runtime.health.dependency',
    cursor ?? 'first',
  ] as const);

export async function readControl(context: ConsoleContext, cursor: string | undefined, signal: AbortSignal) {
  const request = consoleRequest(context.scope, signal, context.session.accessVersion);
  const input = { query: { limit: 50, ...(cursor === undefined ? {} : { cursor }) } };
  if (context.scope.kind === 'distributor') {
    return { kind: 'distributor' as const, page: DistributorPageSchema.parse(await distributorsRead(input, request)) };
  }
  if (context.scope.kind === 'platform') return { kind: 'platform' as const, page: LayerPageSchema.parse(await organizationLayersRead(input, request)) };
  return { kind: 'runtime' as const, health: RuntimeControlSchema.parse(await healthDependency({}, request)) };
}
