import { deepFreeze } from '../../../../shared/model/Immutable';
import type { Announcement, AnnouncementPage } from '../model/Announcement';
import type { NotificationTemplate, TemplatePage, TemplateReceipt } from '../model/Template';
import { AnnouncementDtoSchema, AnnouncementPageDtoSchema, TemplatePageDtoSchema, TemplateReceiptDtoSchema, type AnnouncementDto, type TemplateDto } from './NotificationSchema';

export class NotificationMapper {
  templates(value: unknown): TemplatePage {
    const page = TemplatePageDtoSchema.parse(value) as Readonly<{ items: readonly TemplateDto[]; count: number; nextCursor?: string }>;
    return deepFreeze({ items: page.items.map(template), count: page.count, ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }) });
  }

  announcements(value: unknown): AnnouncementPage {
    const page = AnnouncementPageDtoSchema.parse(value) as Readonly<{ items: readonly AnnouncementDto[]; count: number; nextCursor?: string }>;
    return deepFreeze({ items: page.items.map(announcement), count: page.count, ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }) });
  }

  templateReceipt(value: unknown): TemplateReceipt {
    const item = TemplateReceiptDtoSchema.parse(value) as TemplateDto & Readonly<{ inserted: boolean }>;
    return deepFreeze({ ...template(item), inserted: item.inserted });
  }

  announcement(value: unknown): Announcement {
    return deepFreeze(announcement(AnnouncementDtoSchema.parse(value) as AnnouncementDto));
  }
}

function template(item: TemplateDto): NotificationTemplate {
  return {
    id: item.id,
    scopeId: item.scope_id,
    channel: item.channel,
    eventType: item.event_type,
    version: item.version,
    variables: item.variable_schema,
    providerTemplate: item.provider_template,
    subject: item.subject,
    body: item.body,
    purpose: item.purpose,
    mandatory: item.mandatory,
    status: item.status,
    createdAt: item.created_at,
  };
}

function announcement(item: AnnouncementDto): Announcement {
  return { id: item.id, title: item.title, body: item.body, audience: item.audience, state: item.state, startsAt: item.starts_at, endsAt: item.ends_at, version: item.version, createdAt: item.created_at, updatedAt: item.updated_at };
}
