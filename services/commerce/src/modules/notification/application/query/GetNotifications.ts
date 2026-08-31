import type { OperationActions } from '../../../../foundation/application/ModuleOperations';
import { requireAccess, rowResult } from '../../../../foundation/application/ModuleOperations';
import { keysetResult, queryPage } from '../../../../foundation/interface/Validation';
import type { NotificationRepositoryFactory } from '../command/ChangePreference';

export function getNotificationsOperations(repositories: NotificationRepositoryFactory): OperationActions {
  return {
    'notification.notifications.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const result = await repositories(database).notifications(access.membership.id, access.actor.target !== 'storefront', page.sort, page.id, page.fetch);
      return keysetResult(result, page, 'created_at');
    },
    'notification.notifications.ack': async (request, database) => {
      const access = requireAccess(request);
      return rowResult(await repositories(database).acknowledge(access.membership.id, request.input.path.notificationid!));
    },
    'notification.preferences.read': async (request, database) => {
      const access = requireAccess(request);
      const repository = repositories(database);
      const context = await repository.member(access.membership.id);
      const page = queryPage(request);
      return keysetResult(await repository.preferences(context.member, context.organization, page.id, page.fetch), page, 'cursor_id', 'cursor_id');
    },
  };
}
