import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { CockpitData, CockpitFilter } from '../model/Cockpit';

export interface CockpitPort { read(context: ConsoleContext, filter: CockpitFilter, signal?: AbortSignal): Promise<CockpitData> }
