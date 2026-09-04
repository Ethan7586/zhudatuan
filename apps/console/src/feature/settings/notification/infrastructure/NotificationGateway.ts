import { createIdempotencyKey } from '@shop/sdk/context';
import { createFetchNotification, type NotificationOperations } from '@shop/sdk/notification';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { consoleCommand, consoleRequest } from '../../../../shared/api/RequestContext';
import { announcementInput, templateInput } from '../model/Command';
import type { AnnouncementChange } from '../model/Announcement';
import type { NotificationChannel, TemplateChange } from '../model/Template';
import type { NotificationPort } from '../public';
import { NotificationMapper } from './NotificationMapper';

export class NotificationGateway implements NotificationPort {
  private readonly client: NotificationOperations;
  private readonly mapper = new NotificationMapper();
  constructor(baseUrl: string) {
    this.client = createFetchNotification(baseUrl);
  }

  async readTemplates(context: ConsoleContext, channel?: NotificationChannel, cursor?: string, signal?: AbortSignal) {
    const value = await this.client.templatesRead({ query: { limit: 50, ...(channel === undefined ? {} : { channel }), ...(cursor === undefined ? {} : { cursor }) } }, consoleRequest(context.scope, signal, context.session.accessVersion));
    return this.mapper.templates(value);
  }

  async readAnnouncements(context: ConsoleContext, cursor?: string, signal?: AbortSignal) {
    const value = await this.client.announcementsRead({ query: { limit: 50, ...(cursor === undefined ? {} : { cursor }) } }, consoleRequest(context.scope, signal, context.session.accessVersion));
    return this.mapper.announcements(value);
  }

  async manageTemplate(context: ConsoleContext, change: TemplateChange, proof: string, identity: string, signal?: AbortSignal) {
    const value = await this.client.templatesManage(templateInput(change), command(context, change.expectedVersion, proof, identity, signal));
    return this.mapper.templateReceipt(value);
  }

  async manageAnnouncement(context: ConsoleContext, change: AnnouncementChange, proof: string, identity: string, signal?: AbortSignal) {
    const value = await this.client.announcementsManage(announcementInput(change), command(context, change.expectedVersion, proof, identity, signal));
    return this.mapper.announcement(value);
  }

  createIdentity(): string {
    return createIdempotencyKey();
  }
  createReference(kind: 'template' | 'announcement'): string {
    return `${kind}:${crypto.randomUUID()}`;
  }
}

function command(context: ConsoleContext, expectedVersion: number, proof: string, identity: string, signal?: AbortSignal) {
  return consoleCommand(context.scope, {
    accessVersion: context.session.accessVersion,
    expectedVersion,
    proof,
    idempotencyKey: identity,
    ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
    ...(signal === undefined ? {} : { signal }),
  });
}
