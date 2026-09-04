import { NOTIFICATION_CHANNELS, NOTIFICATION_VARIABLE_TYPES, type OperationOutputFor } from '@shop/contract';

export const notificationChannels = NOTIFICATION_CHANNELS;
export const variableTypes = NOTIFICATION_VARIABLE_TYPES;
export type NotificationChannel = (typeof notificationChannels)[number];
export type VariableType = (typeof variableTypes)[number];
type TemplateDto = OperationOutputFor<'notification.templates.read'>['items'][number];
export type VariableSchema = Readonly<TemplateDto['variable_schema']>;
export type TemplateStatus = TemplateDto['status'];
export type NotificationPurpose = TemplateDto['purpose'];

export interface NotificationTemplate {
  readonly id: string;
  readonly scopeId: string;
  readonly channel: NotificationChannel;
  readonly eventType: string;
  readonly version: number;
  readonly variables: VariableSchema;
  readonly providerTemplate: string | null;
  readonly subject: string | null;
  readonly body: string;
  readonly purpose: NotificationPurpose;
  readonly mandatory: boolean;
  readonly status: TemplateStatus;
  readonly createdAt: string;
}

export interface TemplatePage {
  readonly items: readonly NotificationTemplate[];
  readonly count: number;
  readonly nextCursor?: string;
}

export interface TemplateChange {
  readonly id: string;
  readonly channel: NotificationChannel;
  readonly eventType: string;
  readonly version: number;
  readonly variables: VariableSchema;
  readonly providerTemplate: string | null;
  readonly subject: string | null;
  readonly body: string;
  readonly purpose: NotificationPurpose;
  readonly mandatory: boolean;
  readonly status: TemplateStatus;
  readonly expectedVersion: number;
}

export interface TemplateReceipt extends NotificationTemplate {
  readonly inserted: boolean;
}
