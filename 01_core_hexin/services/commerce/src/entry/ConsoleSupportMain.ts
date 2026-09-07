import { apiAllowedOrigins, apiPort, type ApiEnvironment } from '@shop/config/server';
import type { OperationId } from '@shop/contract';
import { bootstrapApi } from '../bootstrap/ApiBootstrap';
import { createConsoleSupportRuntime } from '../bootstrap/ConsoleSupportRuntime';
import { defineModule } from '../bootstrap/DefinedModule';
import { listen } from '../foundation/interface/NodeServer';
import { consoleSupportHealth } from '../modules/support/05_interface_jieru/ConsoleSupportHealth';
import { supportRoutes } from '../modules/support/05_interface_jieru/http/SupportRoutes';

export const CONSOLE_SUPPORT_OPERATIONS = Object.freeze([
  'runtime.health.live', 'runtime.health.ready', 'runtime.health.startup',
  'support.cases.read', 'support.messages.read', 'support.messages.send',
] as const satisfies readonly OperationId[]);

const environment: ApiEnvironment = Object.freeze({
  API_PORT: requiredEnvironment('API_PORT'),
  API_ALLOWED_ORIGINS: requiredEnvironment('API_ALLOWED_ORIGINS'),
  DATABASE_API_CONNECTION_REF: requiredEnvironment('DATABASE_API_CONNECTION_REF'),
  SECRET_STORE_ENDPOINT: requiredEnvironment('SECRET_STORE_ENDPOINT'),
  SECRET_STORE_BEARER_TOKEN: requiredEnvironment('SECRET_STORE_BEARER_TOKEN'),
  KMS_ENDPOINT: requiredEnvironment('KMS_ENDPOINT'),
  KMS_BEARER_TOKEN: requiredEnvironment('KMS_BEARER_TOKEN'),
});
const runtime = await createConsoleSupportRuntime(environment);
const modules = [defineModule('runtime', [], consoleSupportHealth), defineModule('support', [], supportRoutes)];
const bootstrapped = await bootstrapApi({ modules, extensions: runtime.extensions, configure: runtime.configure,
  allowedOrigins: apiAllowedOrigins(environment), telemetry: runtime.telemetry, operationIds: CONSOLE_SUPPORT_OPERATIONS });
const ready = await bootstrapped.app.handle(new Request('http://127.0.0.1/health/ready'));
if (!ready.ok) console.warn(`CONSOLE_SUPPORT_STARTUP_WARNING:${ready.status}`);
const server = listen(bootstrapped.app, apiPort(environment), '127.0.0.1', bootstrapped.nodeContextResolver);

for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, async () => {
  await server.close();
  await runtime.close();
  process.exit(0);
});

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_MISSING`);
  return value;
}
