import { useDependencies } from '../../../app/DependencyContext';
import { useConsoleContext } from '../../../entity/session/ConsoleContext';
import { useRouteTitle } from '../../../shared/ui/RouteTitle';
import { VoucherPage } from '../view/VoucherPage';
import { useVoucherViewModel } from '../viewmodel/VoucherViewModel';
import '../view/Workspace.css';
import '../view/Table.css';
import '../view/Dialogs.css';
import '../view/DialogFooter.css';
import '../view/Responsive.css';

export function Component() {
  useRouteTitle('卡券中心');
  const context = useConsoleContext();
  const dependencies = useDependencies();
  return <VoucherPage model={useVoucherViewModel(context, dependencies.voucher)} />;
}
