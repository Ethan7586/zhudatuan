import { useSettlementViewModel } from '../viewmodel/SettlementViewModel';
import { SectionRoute } from './SectionRoute';
export function Component() {
  return <SectionRoute title="结算单" useModel={useSettlementViewModel} />;
}
