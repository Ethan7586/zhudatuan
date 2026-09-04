import type { FinanceDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { useSectionViewModel } from './SectionViewModel';

export function useEntryViewModel(context: ConsoleContext, dependencies: FinanceDependencies, requestStepup: () => void) {
  return useSectionViewModel(context, dependencies, 'entries', requestStepup);
}
export type EntryViewModel = ReturnType<typeof useEntryViewModel>;
