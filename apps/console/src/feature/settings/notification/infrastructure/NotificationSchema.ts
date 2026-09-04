import { exactOperationOutput } from '@shop/contract/schema';
import type { AnnouncementAudience, AnnouncementState } from '../model/Announcement';
import type { NotificationChannel, TemplateStatus, VariableSchema } from '../model/Template';

export const TemplatePageDtoSchema = exactOperationOutput('NotificationTemplatesReadOutput');
export const TemplateReceiptDtoSchema = exactOperationOutput('NotificationTemplatesManageOutput');
export const AnnouncementPageDtoSchema = exactOperationOutput('NotificationAnnouncementsReadOutput');
export const AnnouncementDtoSchema = exactOperationOutput('NotificationAnnouncementsManageOutput');

export interface TemplateDto {
  readonly id: string;
  readonly scope_id: string;
  readonly channel: NotificationChannel;
  readonly event_type: string;
  readonly version: number;
  readonly variable_schema: VariableSchema;
  readonly provider_template: string | null;
  readonly subject: string | null;
  readonly body: string;
  readonly status: TemplateStatus;
  readonly created_at: string;
  readonly inserted?: boolean;
}

export interface AnnouncementDto {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly audience: AnnouncementAudience;
  readonly state: AnnouncementState;
  readonly starts_at: string;
  readonly ends_at: string | null;
  readonly version: number;
  readonly created_at: string;
  readonly updated_at: string;
}
