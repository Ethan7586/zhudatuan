import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { ControlPage, Distributor, PlatformLayer, RuntimeControl } from '../model/Control';

export interface ControlPort {
  platform(context: ConsoleContext, cursor?: string, signal?: AbortSignal): Promise<ControlPage<PlatformLayer>>;
  distribution(context: ConsoleContext, cursor?: string, signal?: AbortSignal): Promise<ControlPage<Distributor>>;
  runtime(context: ConsoleContext, signal?: AbortSignal): Promise<RuntimeControl>;
}
