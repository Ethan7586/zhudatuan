import { useWithdrawalViewModel } from '../viewmodel/WithdrawalViewModel';
import { SectionRoute } from './SectionRoute';
export function Component() { return <SectionRoute title="提现" useModel={useWithdrawalViewModel} />; }
