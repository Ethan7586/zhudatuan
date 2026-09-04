import type { FinanceDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { useSectionViewModel } from './SectionViewModel';

export function useSettlementViewModel(context: ConsoleContext, dependencies: FinanceDependencies, requestStepup: () => void) {
  return useSectionViewModel(context, dependencies, 'settlements', requestStepup);
}
export type SettlementViewModel = ReturnType<typeof useSettlementViewModel>;
