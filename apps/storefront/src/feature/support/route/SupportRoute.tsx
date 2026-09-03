import { SupportPage } from '../view/SupportPage';
import { useSupportViewModel } from '../viewmodel/SupportViewModel';
export function Component() { return <SupportPage viewmodel={useSupportViewModel()} />; }
