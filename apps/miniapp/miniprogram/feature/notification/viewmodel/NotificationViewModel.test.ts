import { expect, it } from 'vitest';
import { notificationViewModel } from './NotificationViewModel';
it('binds the notification route', () => expect(notificationViewModel.routes).toEqual(['miniappnotifications']));
