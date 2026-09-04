import { useEntryViewModel } from '../viewmodel/EntryViewModel';
import { SectionRoute } from './SectionRoute';
export function Component() {
  return <SectionRoute title="账本分录" useModel={useEntryViewModel} />;
}
