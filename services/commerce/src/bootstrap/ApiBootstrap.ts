import type { Telemetry } from '@shop/telemetry';
import { OperationCatalog } from '@shop/contract';
import { HandlerRegistry } from '../foundation/application/HandlerRegistry';
import { OperationPipeline } from '../foundation/application/OperationPipeline';
import { OPERATION_POLICY } from '../foundation/application/OperationPolicy';
import { HttpApp } from '../foundation/interface/HttpApp';
import { CSRF_PROTECTOR } from '../foundation/security/CsrfProtector';
import { OperationMetrics } from '../foundation/telemetry/OperationMetrics';
import { Container } from './Container';
import type { ExtensionRegistry } from './ExtensionRegistry';
import type { CommerceModule } from './ModuleRegistry';
import { ModuleRegistry } from './ModuleRegistry';
import { RouteRegistry } from './RouteRegistry';
import { PUBLIC_ACTOR_FINGERPRINT } from '../foundation/security/PublicActorFingerprintToken';
import { DATABASE_POOL } from '../foundation/persistence/Pool';
import { OperationExecutor } from '../foundation/application/OperationExecutor';
import { AuditDecorator } from '../foundation/application/AuditDecorator';
import { PgTransactionAccess } from '../adapter/database/PgTransactionAccess';
import { PgTransactionManager } from '../adapter/database/PgTransactionManager';
import { PgIdempotencyRepository } from '../adapter/database/PgIdempotencyRepository';
import { PgTransactionalOutbox } from '../adapter/database/PgTransactionalOutbox';
import { PgMakerCheckerGuard } from '../modules/access/infrastructure/persistence/PgMakerCheckerGuard';
import { PgAuditAppender } from '../modules/audit/infrastructure/persistence/PgAuditAppender';

export interface ApiBootstrapOptions {
  readonly modules: readonly CommerceModule[];
  readonly extensions: ExtensionRegistry;
  readonly configure?: (container: Container) => void | Promise<void>;
  readonly allowedOrigins: readonly string[];
  readonly telemetry: Telemetry;
}

export async function bootstrapApi(options: ApiBootstrapOptions): Promise<Readonly<{ app: HttpApp; modules: readonly string[]; routes: RouteRegistry }>> {
  const container = new Container();
  await options.configure?.(container);
  const expected = OperationCatalog.all().map((operation) => operation.id);
  const routes = new RouteRegistry(expected);
  const handlers = new HandlerRegistry();
  const modules = new ModuleRegistry();
  for (const module of options.modules) modules.add(module);
  await modules.load({ workload: 'api', container, handlers });
  handlers.freeze(expected);
  const transactionAccess = new PgTransactionAccess();
  const executor = new OperationExecutor(
    new PgTransactionManager(container.get(DATABASE_POOL)),
    new PgIdempotencyRepository(transactionAccess),
    new PgMakerCheckerGuard(transactionAccess),
    new AuditDecorator(new PgAuditAppender(transactionAccess)),
    new PgTransactionalOutbox(transactionAccess)
  );
  const pipeline = new OperationPipeline(handlers, container.get(OPERATION_POLICY), container.get(PUBLIC_ACTOR_FINGERPRINT), executor);
  for (const operation of expected) routes.register({ operation, handler: (request) => pipeline.execute(operation, request) });
  routes.freeze();
  options.extensions.freeze();
  container.freeze();
  return Object.freeze({ app: new HttpApp(routes, options.allowedOrigins, container.get(CSRF_PROTECTOR), undefined, undefined, new OperationMetrics(options.telemetry)), modules: modules.catalog(), routes });
}
