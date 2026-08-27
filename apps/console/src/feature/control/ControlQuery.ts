import { createFetchRuntimeHealthDependency } from '@shop/sdk/runtime';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { ControlSchema } from './ControlSchema';

const healthDependency = createFetchRuntimeHealthDependency(appConfig.apiBaseUrl);

export const controlKey = (context: ConsoleContext) => Object.freeze([
  'console', context.scope.kind, context.scope.id, context.session.accessVersion, 'runtime.health.dependency',
] as const);

export async function readControl(context: ConsoleContext, signal: AbortSignal) {
  const value = await healthDependency(
    {},
    consoleRequest(context.scope, signal, context.session.accessVersion),
  );
  return ControlSchema.parse(value);
}
