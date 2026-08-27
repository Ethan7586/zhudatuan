import type { Handler } from './Handler';
import type { Query } from './Query';

export class QueryBus {
  private readonly handlers = new Map<string, Handler<Query, unknown>>();
  private frozen = false;

  register<T extends Query, R>(type: T['type'], handler: Handler<T, R>): void {
    if (this.frozen) throw new Error('QUERY_BUS_FROZEN');
    if (this.handlers.has(type)) throw new Error(`QUERY_HANDLER_DUPLICATE:${type}`);
    this.handlers.set(type, handler as Handler<Query, unknown>);
  }

  freeze(): void {
    this.frozen = true;
  }

  execute<R>(query: Query): Promise<R> {
    const handler = this.handlers.get(query.type);
    if (!handler) return Promise.reject(new Error(`QUERY_HANDLER_MISSING:${query.type}`));
    return handler.handle(query) as Promise<R>;
  }
}
