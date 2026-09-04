import type { FinanceDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { useSectionViewModel } from './SectionViewModel';

export function useStatementViewModel(context: ConsoleContext, dependencies: FinanceDependencies, requestStepup: () => void) {
  return useSectionViewModel(context, dependencies, 'statements', requestStepup);
}
export type StatementViewModel = ReturnType<typeof useStatementViewModel>;
