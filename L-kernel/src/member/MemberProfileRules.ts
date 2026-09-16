type Field = Readonly<{ type: string; options: readonly string[] }>;

export function validateMemberProfileConfig(config: Readonly<{ fields: readonly Field[] }>): void {
  for (const field of config.fields) {
    if ((field.type === 'select' || field.type === 'multiselect') !== (field.options.length > 0)) {
      throw new Error('CUSTOM_FIELD_OPTIONS_INVALID');
    }
  }
}

export function validateMemberCustomFieldValue(field: Field | undefined, value: unknown): void {
  if (!field) throw new Error('CUSTOM_PROFILE_CONFIGURATION_STALE');
  const matches =
    value === null ||
    ((field.type === 'text' || field.type === 'date' || field.type === 'remark') && typeof value === 'string') ||
    (field.type === 'number' && typeof value === 'number' && Number.isFinite(value)) ||
    (field.type === 'switch' && typeof value === 'boolean') ||
    (field.type === 'select' && typeof value === 'string' && field.options.includes(value)) ||
    (field.type === 'multiselect' && Array.isArray(value) && value.every((item) => typeof item === 'string' && field.options.includes(item)));
  if (!matches) throw new Error('CUSTOM_FIELD_VALUE_INVALID');
}
