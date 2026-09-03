import { useNotificationViewModel } from '../viewmodel/NotificationViewModel';
import { NotificationPage } from '../view/NotificationPage';
export function Component() { return <NotificationPage viewmodel={useNotificationViewModel()} />; }
