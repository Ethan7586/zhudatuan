import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import type { FinanceSection } from '../model/Finance';
import { financeSectionOperation } from '../model/FinanceOperation';
import type { FinancePort } from '../public';

export class ReadSection {
  constructor(private readonly port: Pick<FinancePort, 'section'>) {}
  execute(context: ConsoleContext, section: FinanceSection, cursor: string | undefined, signal: AbortSignal) {
    assertOperationAccess(context, financeSectionOperation(section));
    return this.port.section(context, section, cursor, signal);
  }
}
