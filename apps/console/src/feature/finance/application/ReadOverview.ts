import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { FinancePort } from '../public';

export class ReadOverview {
  constructor(private readonly port: Pick<FinancePort, 'overview'>) {}
  execute(context: ConsoleContext, signal: AbortSignal) { return this.port.overview(context, signal); }
}
