import type { FinanceDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { useSectionViewModel } from './SectionViewModel';

export function useStatementViewModel(context: ConsoleContext, dependencies: FinanceDependencies) { return useSectionViewModel(context, dependencies, 'statements'); }
export type StatementViewModel = ReturnType<typeof useStatementViewModel>;
