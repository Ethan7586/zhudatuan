import { defineModule } from '../../../bootstrap/DefinedModule';
import { notificationRoutes } from './http/NotificationRoutes';
export const NotificationModule = defineModule('notification', ['identity', 'order', 'support'], notificationRoutes);
