<<<<<<< HEAD
import { registerOperationRoutes, registerSelectedOperationRoutes } from '../foundation/interface/OperationController';
=======
import { registerOperationRoutes } from '../foundation/interface/OperationController';
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
import { OperationCatalog, type OperationId } from '@shop/contract';
import { OperationHandler, type OperationUsecase } from '../foundation/application/OperationHandler';
import { OPERATION_HANDLERS } from '../foundation/interface/OperationController';
import type { CommerceModule, ModuleContext } from './ModuleRegistry';

export type OperationFactory = (context: ModuleContext) => OperationUsecase;

export function defineModule(id: string, dependencies: readonly string[] = [], factory?: OperationFactory): CommerceModule {
  return Object.freeze({ id, dependencies: Object.freeze([...dependencies]), register: (context: ModuleContext) => {
    if (context.workload !== 'api') return;
    const operations = OperationCatalog.all().filter((candidate) => candidate.module === id);
    if (operations.length > 0) {
      if (!factory) throw new Error(`MODULE_OPERATION_FACTORY_MISSING:${id}`);
      const usecase = factory(context);
      const handlers = context.container.get(OPERATION_HANDLERS);
      for (const operation of operations) {
        if (handlers.has(operation.id)) throw new Error(`OPERATION_HANDLER_DUPLICATE:${operation.id}`);
        handlers.set(operation.id as OperationId, new OperationHandler(usecase));
      }
    }
    registerOperationRoutes(id, context);
  } });
}
<<<<<<< HEAD

export function defineSelectedModule(id: string, operationIds: readonly OperationId[], factory: OperationFactory,
  dependencies: readonly string[] = []): CommerceModule {
  const selected = Object.freeze([...operationIds]);
  if (new Set(selected).size !== selected.length) throw new Error(`MODULE_OPERATION_DUPLICATE:${id}`);
  for (const operation of selected.map((operationId) => OperationCatalog.get(operationId))) {
    if (operation.module !== id) throw new Error(`MODULE_OPERATION_OWNER_MISMATCH:${operation.id}`);
  }
  return Object.freeze({ id, dependencies: Object.freeze([...dependencies]), register: (context: ModuleContext) => {
    if (context.workload !== 'api') return;
    const usecase = factory(context);
    const handlers = context.container.get(OPERATION_HANDLERS);
    for (const operationId of selected) {
      if (handlers.has(operationId)) throw new Error(`OPERATION_HANDLER_DUPLICATE:${operationId}`);
      handlers.set(operationId, new OperationHandler(usecase));
    }
    registerSelectedOperationRoutes(selected, context);
  } });
}
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
