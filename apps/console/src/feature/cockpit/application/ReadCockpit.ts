import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { CockpitFilter } from '../model/Cockpit';
import type { CockpitPort } from '../public';

export class ReadCockpit {
  constructor(private readonly port: CockpitPort) {}
  execute(context: ConsoleContext, filter: CockpitFilter, signal?: AbortSignal) { return this.port.read(context, filter, signal); }
}
