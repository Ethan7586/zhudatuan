import type { OperationActions } from '../../../../foundation/application/ModuleOperations';
import { requireAccess } from '../../../../foundation/application/ModuleOperations';
import { keysetResult, queryPage } from '../../../../foundation/interface/Validation';
import type { NotificationRepositoryFactory } from '../command/ChangePreference';

export function getAnnouncementOperations(repositories: NotificationRepositoryFactory): OperationActions {
  return {
    'notification.announcements.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      return keysetResult(await repositories(database).announcements(access.scope.id, page.id, page.fetch), page, 'id');
    },
  };
}
