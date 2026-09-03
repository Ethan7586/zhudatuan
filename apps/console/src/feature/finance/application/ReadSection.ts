import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { FinanceSection } from '../model/Finance';
import type { FinancePort } from '../public';

export class ReadSection {
  constructor(private readonly port: Pick<FinancePort, 'section'>) {}
  execute(context: ConsoleContext, section: FinanceSection, cursor: string | undefined, signal: AbortSignal) { return this.port.section(context, section, cursor, signal); }
}
