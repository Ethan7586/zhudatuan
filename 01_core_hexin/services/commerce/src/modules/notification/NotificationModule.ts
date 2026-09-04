import { defineModule } from '../../bootstrap/DefinedModule';
import { notificationRoutes } from './interface/http/NotificationRoutes';
export const NotificationModule = defineModule('notification', ['identity', 'order', 'support'], notificationRoutes);
