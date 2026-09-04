import type { FinanceDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { useSectionViewModel } from './SectionViewModel';

export function useWithdrawalViewModel(context: ConsoleContext, dependencies: FinanceDependencies, requestStepup: () => void) {
  return useSectionViewModel(context, dependencies, 'withdrawals', requestStepup);
}
export type WithdrawalViewModel = ReturnType<typeof useWithdrawalViewModel>;
