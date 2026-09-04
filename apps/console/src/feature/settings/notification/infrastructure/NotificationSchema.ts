import { exactOperationOutput } from '@shop/contract/schema';
import type { OperationOutputFor } from '@shop/contract';

export const TemplatePageDtoSchema = exactOperationOutput('NotificationTemplatesReadOutput');
export const TemplateReceiptDtoSchema = exactOperationOutput('NotificationTemplatesManageOutput');
export const AnnouncementPageDtoSchema = exactOperationOutput('NotificationAnnouncementsReadOutput');
export const AnnouncementDtoSchema = exactOperationOutput('NotificationAnnouncementsManageOutput');

export type TemplateDto = OperationOutputFor<'notification.templates.read'>['items'][number];
export type AnnouncementDto = OperationOutputFor<'notification.announcements.read'>['items'][number];
