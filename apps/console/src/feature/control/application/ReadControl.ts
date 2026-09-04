import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { controlKind, type ControlData } from '../model/Control';
import type { ControlPort } from '../public';

export class ReadControl {
  constructor(private readonly port: ControlPort) {}
  async execute(context: ConsoleContext, cursor: string | undefined, signal?: AbortSignal): Promise<ControlData> {
    const kind = controlKind(context.scope.kind);
    if (kind === 'platform') return Object.freeze({ kind, page: await this.port.platform(context, cursor, signal) });
    if (kind === 'distribution') return Object.freeze({ kind, page: await this.port.distribution(context, cursor, signal) });
    return Object.freeze({ kind, health: await this.port.runtime(context, signal) });
  }
}
