import { useDependencies } from '../../../app/DependencyContext';
import { useConsoleContext } from '../../../entity/session/ConsoleContext';
import { useStepup } from '../../../entity/session/StepupContext';
import { useRouteTitle } from '../../../shared/ui/RouteTitle';
import { VoucherPage } from '../view/VoucherPage';
import { useVoucherViewModel } from '../viewmodel/VoucherViewModel';
import '../view/Workspace.css';
import '../view/Filters.css';
import '../view/Lifecycle.css';
import '../view/Table.css';
import '../view/TableState.css';
import '../view/Dialogs.css';
import '../view/CreatorDialog.css';
import '../view/DialogFooter.css';
import '../view/Responsive.css';

export function Component() {
  useRouteTitle('卡券中心');
  const context = useConsoleContext();
  const dependencies = useDependencies();
  return <VoucherPage model={useVoucherViewModel(context, dependencies.voucher, useStepup().request)} />;
}
