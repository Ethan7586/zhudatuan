import type { Command } from './Command';
import type { Handler } from './Handler';

export class CommandBus {
  private readonly handlers = new Map<string, Handler<Command, unknown>>();
  private frozen = false;

  register<T extends Command, R>(type: T['type'], handler: Handler<T, R>): void {
    if (this.frozen) throw new Error('COMMAND_BUS_FROZEN');
    if (this.handlers.has(type)) throw new Error(`COMMAND_HANDLER_DUPLICATE:${type}`);
    this.handlers.set(type, handler as Handler<Command, unknown>);
  }

  freeze(): void {
    this.frozen = true;
  }

  execute<R>(command: Command): Promise<R> {
    const handler = this.handlers.get(command.type);
    if (!handler) return Promise.reject(new Error(`COMMAND_HANDLER_MISSING:${command.type}`));
    return handler.handle(command) as Promise<R>;
  }
}
