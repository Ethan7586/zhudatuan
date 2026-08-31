import { DomainError } from '../../../../foundation/domain/DomainError';
import type { OperationActions } from '../../../../foundation/application/ModuleOperations';
import { requireAccess, rowResult } from '../../../../foundation/application/ModuleOperations';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import { Announcement } from '../../domain/model/Announcement';
import type { NotificationRepositoryFactory } from './ChangePreference';

export function saveAnnouncementOperations(repositories: NotificationRepositoryFactory): OperationActions {
  return {
    'notification.announcements.manage': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const expected = request.input.expectedVersion ?? null;
      const announcement = new Announcement(
        request.input.path.announcementid!,
        access.scope.id,
        textField(body, 'title', 500),
        textField(body, 'body', 20_000),
        object(body.audience),
        date(body.startsAt),
        nullableDate(body.endsAt),
        state(body.state),
        expected ?? 0
      );
      const result = await repositories(database).saveAnnouncement({
        id: announcement.id,
        scope: announcement.scope,
        title: announcement.title,
        body: announcement.body,
        audience: announcement.audience,
        state: announcement.state,
        startsAt: announcement.startsAt,
        endsAt: announcement.endsAt,
        expected,
      });
      if (!result.rows[0]) throw new DomainError('VERSION_CONFLICT');
      return rowResult(result, expected === null ? 201 : 200);
    },
  };
}

function object(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JSON_OBJECT_REQUIRED');
  return value as Record<string, unknown>;
}
function date(value: unknown): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new Error('DATE_REQUIRED');
  return value;
}
function nullableDate(value: unknown): string | null {
  return value === undefined || value === null ? null : date(value);
}
function state(value: unknown): 'draft' | 'published' | 'retired' {
  if (!['draft', 'published', 'retired'].includes(String(value))) throw new Error('NOTIFICATION_ANNOUNCEMENT_STATE_INVALID');
  return value as 'draft' | 'published' | 'retired';
}
