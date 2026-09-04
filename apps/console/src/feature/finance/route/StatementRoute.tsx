import { useStatementViewModel } from '../viewmodel/StatementViewModel';
import { SectionRoute } from './SectionRoute';
export function Component() {
  return <SectionRoute title="账单" useModel={useStatementViewModel} />;
}
