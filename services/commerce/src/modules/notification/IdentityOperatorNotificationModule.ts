import { defineSelectedModule } from '../../bootstrap/DefinedModule';
import { NOTIFICATION_OPERATOR_READ_OPERATION_IDS, notificationOperatorReadOperations } from './NotificationReadOperations';

export const IdentityOperatorNotificationModule = defineSelectedModule(
  'notification', NOTIFICATION_OPERATOR_READ_OPERATION_IDS, notificationOperatorReadOperations, ['identity'],
);
