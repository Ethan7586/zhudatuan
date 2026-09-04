import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { bodyRecord, textField } from '../../../../foundation/application/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import { Announcement } from '../../domain/model/Announcement';
import type { NotificationRepository } from '../port/NotificationRepository';

export class AnnouncementsManageHandler implements OperationHandler<'notification.announcements.manage', 'write'> {
  readonly operation = 'notification.announcements.manage' as const;
  readonly mode = 'write' as const;
  constructor(private readonly notifications: NotificationRepository) {}
  async execute(input: OperationInputFor<'notification.announcements.manage'>, context: WriteHandlerContext<'notification.announcements.manage'>): Promise<OperationReply<OperationOutputFor<'notification.announcements.manage'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const expected = context.expectedVersion ?? null;
    const announcement = new Announcement(
      input.path.announcementid,
      access.scope.id,
      textField(body, 'title', 500),
      textField(body, 'body', 20_000),
      object(body.audience),
      date(body.startsAt),
      nullableDate(body.endsAt),
      state(body.state),
      expected ?? 0
    );
    const saved = await this.notifications.saveAnnouncement(context.transaction, {
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
    if (!saved) throw new DomainError('VERSION_CONFLICT');
    return { status: expected === null ? 201 : 200, body: saved as OperationOutputFor<'notification.announcements.manage'> };
  }
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
