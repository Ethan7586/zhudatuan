import { z } from 'zod';
import { DatabaseIntegerSchema } from '../../shared/schema/DatabaseInteger';
import { pageEnvelope } from '../../shared/schema/PageEnvelope';

export const NotificationTemplateSchema = z.object({
  id: z.string().min(1), channel: z.string().min(1), event_type: z.string().min(1), version: DatabaseIntegerSchema,
  subject: z.string().nullable(), status: z.string().min(1), created_at: z.string().min(1),
}).passthrough();
export const AnnouncementSchema = z.object({
  id: z.string().min(1), title: z.string().min(1), state: z.string().min(1), starts_at: z.string().min(1),
  ends_at: z.string().nullable(), version: DatabaseIntegerSchema, updated_at: z.string().min(1),
}).passthrough();
export const NotificationTemplatePageSchema = pageEnvelope(NotificationTemplateSchema);
export const AnnouncementPageSchema = pageEnvelope(AnnouncementSchema);
export type NotificationView = 'templates' | 'announcements';
export interface NotificationRecord {
  readonly id: string; readonly title: string; readonly channel: string; readonly state: string;
  readonly startsAt: string; readonly endsAt: string | null; readonly version: number;
}
export interface NotificationRecordPage { readonly items: readonly NotificationRecord[]; readonly count: number; readonly nextCursor?: string }
