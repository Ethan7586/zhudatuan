import { defineModule } from '../../bootstrap/DefinedModule';
import { notificationRoutes } from './interface/http/NotificationRoutes';
import { Manifest } from './Manifest';
export const NotificationModule = defineModule(Manifest, notificationRoutes);
