import { OperationCatalog, type OperationId } from '@shop/contract';
import type { RegisteredOperationHandler } from './OperationHandler';

export class HandlerRegistry {
  private readonly handlers = new Map<OperationId, RegisteredOperationHandler>();
  private frozen = false;

  add<TKey extends OperationId>(owner: string, handler: RegisteredOperationHandler<TKey>): void {
    if (this.frozen) throw new Error('HANDLER_REGISTRY_FROZEN');
    const operation = handler.operation;
    if (OperationCatalog.get(operation).module !== owner) throw new Error(`HANDLER_OWNER_MISMATCH:${operation}:${owner}`);
    if (handler.operation !== operation) throw new Error(`HANDLER_OPERATION_MISMATCH:${operation}`);
    if (this.handlers.has(operation)) throw new Error(`HANDLER_DUPLICATE:${operation}`);
    this.handlers.set(operation, handler as RegisteredOperationHandler);
  }

  get<TKey extends OperationId>(operation: TKey): RegisteredOperationHandler<TKey> {
    if (!this.frozen) throw new Error('HANDLER_REGISTRY_NOT_FROZEN');
    const handler = this.handlers.get(operation);
    if (!handler) throw new Error(`HANDLER_MISSING:${operation}`);
    return handler as RegisteredOperationHandler<TKey>;
  }

  freeze(expected: readonly OperationId[]): void {
    const missing = expected.filter((operation) => !this.handlers.has(operation));
    const unexpected = [...this.handlers.keys()].filter((operation) => !expected.includes(operation));
    if (missing.length > 0) throw new Error(`HANDLER_MISSING:${missing.join(',')}`);
    if (unexpected.length > 0) throw new Error(`HANDLER_UNEXPECTED:${unexpected.join(',')}`);
    this.frozen = true;
  }
}
