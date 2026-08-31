import { OperationCatalog, type OperationId, type OperationInputFor, type OperationOutputFor } from '@shop/contract';
import type { OperationContext } from '../foundation/application/OperationContext';
import type { OperationUsecase as OperationExecutor } from '../foundation/application/OperationExecution';
import type { OperationReply, TypedOperationUsecase } from '../foundation/application/OperationHandler';
import { HANDLER_TYPES } from '../generated/HandlerCatalog';
import type { CommerceModule, ModuleContext, ModuleManifest, PublicPortBinding } from './ModuleRegistry';

export type OperationFactory = (context: ModuleContext) => OperationExecutor;
export type PortFactory = (context: ModuleContext) => readonly PublicPortBinding[];

export function defineModule(manifest: ModuleManifest, factory?: OperationFactory, ports: readonly PublicPortBinding[] | PortFactory = []): CommerceModule {
  const { id, dependencies, services } = manifest;
  return Object.freeze({
    id,
    dependencies: Object.freeze([...dependencies]),
    services: Object.freeze([...services]),
    bind(context: ModuleContext): readonly PublicPortBinding[] {
      return Object.freeze([...(typeof ports === 'function' ? ports(context) : ports)]);
    },
    register(context: ModuleContext): void {
      if (context.workload !== 'api') return;
      const operations = OperationCatalog.all().filter((candidate) => candidate.module === id);
      if (operations.length === 0) return;
      if (!factory) throw new Error(`MODULE_OPERATION_FACTORY_MISSING:${id}`);
      const executor = factory(context);
      for (const operation of operations) registerHandler(id, operation.id, executor, context);
    },
  });
}

function registerHandler<TKey extends OperationId>(owner: string, operation: TKey, executor: OperationExecutor, context: ModuleContext): void {
  const Handler = HANDLER_TYPES.get(operation);
  if (!Handler) throw new Error(`HANDLER_TYPE_MISSING:${operation}`);
  const usecase: TypedOperationUsecase<TKey> = {
    async execute(input: OperationInputFor<TKey>, operationContext: OperationContext): Promise<OperationReply<OperationOutputFor<TKey>>> {
      const wire = input as Readonly<{ path?: Readonly<Record<string, string>>; query?: Readonly<Record<string, string | readonly string[]>>; body?: unknown }>;
      const result = await executor.invoke({
        type: operation,
        input: {
          path: wire.path ?? {},
          query: wire.query ?? {},
          headers: operationContext.headers,
          body: wire.body,
          rawBody: operationContext.rawBody,
          deadline: operationContext.deadline,
          signal: operationContext.signal,
          ...(operationContext.publicActor === undefined ? {} : { publicActor: operationContext.publicActor }),
          ...(operationContext.idempotencyKey === undefined ? {} : { idempotency: operationContext.idempotencyKey }),
          ...(operationContext.expectedVersion === undefined ? {} : { expectedVersion: operationContext.expectedVersion }),
        },
        security: operationContext.security,
      });
      return {
        status: result.status,
        body: result.body as OperationOutputFor<TKey>,
        ...(result.headers === undefined ? {} : { headers: result.headers }),
      };
    },
  };
  context.handlers.add(owner, operation, new Handler(usecase as TypedOperationUsecase<OperationId>));
}
