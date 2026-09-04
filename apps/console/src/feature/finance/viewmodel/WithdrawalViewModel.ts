import type { FinanceDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { useSectionViewModel } from './SectionViewModel';

export function useWithdrawalViewModel(context: ConsoleContext, dependencies: FinanceDependencies) {
  return useSectionViewModel(context, dependencies, 'withdrawals');
}
export type WithdrawalViewModel = ReturnType<typeof useWithdrawalViewModel>;
