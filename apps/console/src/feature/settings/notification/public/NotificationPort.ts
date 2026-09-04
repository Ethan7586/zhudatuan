import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import type { Announcement, AnnouncementChange, AnnouncementPage } from '../model/Announcement';
import type { NotificationChannel, TemplateChange, TemplatePage, TemplateReceipt } from '../model/Template';

export interface NotificationPort {
  readTemplates(context: ConsoleContext, channel?: NotificationChannel, cursor?: string, signal?: AbortSignal): Promise<TemplatePage>;
  readAnnouncements(context: ConsoleContext, cursor?: string, signal?: AbortSignal): Promise<AnnouncementPage>;
  manageTemplate(context: ConsoleContext, change: TemplateChange, proof: string, identity: string, signal?: AbortSignal): Promise<TemplateReceipt>;
  manageAnnouncement(context: ConsoleContext, change: AnnouncementChange, proof: string, identity: string, signal?: AbortSignal): Promise<Announcement>;
  createIdentity(): string;
  createReference(kind: 'template' | 'announcement'): string;
}
