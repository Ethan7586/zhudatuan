export const DELIVERY_CHANNELS = ['sms', 'email', 'wechat', 'inapp'] as const;
export type DeliveryChannelId = (typeof DELIVERY_CHANNELS)[number];
export type VariableType = 'string' | 'number' | 'boolean' | 'date' | 'money';
export type VariableSchema = Readonly<Record<string, VariableType>>;
export type DeliveryVariables = Readonly<Record<string, string | number | boolean>>;
export type NotificationPurpose = 'transactional' | 'marketing';

export interface TemplateSnapshot {
  readonly id: string;
  readonly version: number;
  readonly channel: DeliveryChannelId;
  readonly event: string;
  readonly variables: VariableSchema;
  readonly providerTemplate: string | null;
  readonly subject: string | null;
  readonly body: string;
  readonly purpose: NotificationPurpose;
  readonly mandatory: boolean;
}

export class Template {
  readonly variables: VariableSchema;

  constructor(
    readonly id: string,
    readonly scope: string,
    readonly channel: DeliveryChannelId,
    readonly event: string,
    readonly version: number,
    variables: Readonly<Record<string, unknown>>,
    readonly providerTemplate: string | null,
    readonly subject: string | null,
    readonly body: string,
    readonly state: 'draft' | 'active' | 'retired',
    readonly purpose: NotificationPurpose = 'transactional',
    readonly mandatory = false
  ) {
    if (!id || !scope || !DELIVERY_CHANNELS.includes(channel)) throw new Error('NOTIFICATION_TEMPLATE_INVALID');
    if (!/^[a-z][a-z0-9.]{1,127}$/.test(event) || !Number.isSafeInteger(version) || version < 1) {
      throw new Error('NOTIFICATION_TEMPLATE_INVALID');
    }
    if (!body.trim() || body.length > 10_000 || (subject !== null && subject.length > 500)) throw new Error('NOTIFICATION_TEMPLATE_INVALID');
    if (channel !== 'inapp' && !providerTemplate?.trim()) throw new Error('NOTIFICATION_PROVIDER_TEMPLATE_REQUIRED');
    if (!['transactional', 'marketing'].includes(purpose) || (mandatory && purpose !== 'transactional')) throw new Error('NOTIFICATION_TEMPLATE_PURPOSE_INVALID');
    this.variables = variableSchema(variables);
    assertPlaceholders(subject ?? '', this.variables);
    assertPlaceholders(body, this.variables);
    Object.freeze(this);
  }

  select(source: Readonly<Record<string, unknown>>): DeliveryVariables {
    const selected: Record<string, string | number | boolean> = {};
    for (const [name, type] of Object.entries(this.variables)) selected[name] = variable(source[name], type, name);
    return Object.freeze(selected);
  }

  render(value: string | null, variables: DeliveryVariables): string | null {
    if (value === null) return null;
    return value.replace(/\{\{([a-z][a-zA-Z0-9]{0,63})\}\}/g, (_match, key: string) => String(variables[key]));
  }

  snapshot(): TemplateSnapshot {
    return Object.freeze({
      id: this.id,
      version: this.version,
      channel: this.channel,
      event: this.event,
      variables: this.variables,
      providerTemplate: this.providerTemplate,
      subject: this.subject,
      body: this.body,
      purpose: this.purpose,
      mandatory: this.mandatory,
    });
  }
}

export function variableSchema(value: Readonly<Record<string, unknown>>): VariableSchema {
  const entries = Object.entries(value);
  if (entries.length > 64) throw new Error('NOTIFICATION_VARIABLE_SCHEMA_INVALID');
  const result: Record<string, VariableType> = {};
  for (const [name, type] of entries) {
    if (!/^[a-z][a-zA-Z0-9]{0,63}$/.test(name) || !['string', 'number', 'boolean', 'date', 'money'].includes(String(type))) {
      throw new Error('NOTIFICATION_VARIABLE_SCHEMA_INVALID');
    }
    result[name] = type as VariableType;
  }
  return Object.freeze(result);
}

function variable(value: unknown, type: VariableType, name: string): string | number | boolean {
  if ((type === 'string' || type === 'money') && typeof value === 'string' && value.length <= 2_000) return value;
  if (type === 'date' && typeof value === 'string' && !Number.isNaN(Date.parse(value)) && value.length <= 64) return value;
  if (type === 'number' && typeof value === 'number' && Number.isFinite(value)) return value;
  if (type === 'boolean' && typeof value === 'boolean') return value;
  throw new Error(`NOTIFICATION_VARIABLE_INVALID:${name}`);
}

function assertPlaceholders(value: string, schema: VariableSchema): void {
  for (const match of value.matchAll(/\{\{([^{}]+)\}\}/g)) {
    if (!Object.hasOwn(schema, match[1]!)) throw new Error(`NOTIFICATION_PLACEHOLDER_UNDECLARED:${match[1]}`);
  }
  if (value.replace(/\{\{[^{}]+\}\}/g, '').includes('{{') || value.replace(/\{\{[^{}]+\}\}/g, '').includes('}}')) {
    throw new Error('NOTIFICATION_PLACEHOLDER_INVALID');
  }
}
