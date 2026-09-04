export const notificationChannels = ['sms', 'email', 'wechat', 'inapp'] as const;
export const variableTypes = ['string', 'number', 'boolean', 'date', 'money'] as const;
export type NotificationChannel = (typeof notificationChannels)[number];
export type VariableType = (typeof variableTypes)[number];
export type VariableSchema = Readonly<Record<string, VariableType>>;
export type TemplateStatus = 'draft' | 'active' | 'retired';

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
  readonly status: TemplateStatus;
  readonly expectedVersion: number;
}

export interface TemplateReceipt extends NotificationTemplate {
  readonly inserted: boolean;
}
