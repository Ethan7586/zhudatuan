import { DomainError } from '../../../../foundation/domain/DomainError';

export type ConfigurableFinancePolicyKind = 'field-definition' | 'tax';

const appliesToValues = Object.freeze(new Set(['tax_rule', 'invoice', 'settlement', 'reconciliation', 'journal', 'accounts_receivable', 'accounts_payable', 'channel_clearing', 'distributor_commission', 'withdrawal', 'period_close']));
const calculationMethods = Object.freeze(new Set(['exclusive', 'inclusive', 'compound']));
const fieldTypes = Object.freeze(new Set(['text', 'integer', 'decimal', 'date', 'datetime', 'boolean', 'select', 'multiselect', 'country', 'region', 'currency', 'money', 'percentage', 'reference']));
const roundingModes = Object.freeze(new Set(['line', 'order', 'invoice']));
const taxTypes = Object.freeze(new Set(['vat', 'gst', 'sales_tax', 'excise', 'customs']));

export class ConfigFieldPolicy {
  validate(kind: string, value: unknown): Readonly<Record<string, unknown>> {
    if (kind === 'field-definition') return fieldDefinition(value);
    if (kind === 'tax') return taxRule(value);
    throw new DomainError('FINANCE_CONFIG_POLICY_KIND_INVALID');
  }

  effectiveRange(rule: Readonly<Record<string, unknown>>): Readonly<{ from: string; to: string | null }> {
    const from = isoDate(rule.effectiveFrom, 'FINANCE_CONFIG_POLICY_EFFECTIVE_FROM_INVALID');
    const to = rule.effectiveTo === undefined ? null : isoDate(rule.effectiveTo, 'FINANCE_CONFIG_POLICY_EFFECTIVE_TO_INVALID');
    if (to !== null && to < from) throw new DomainError('FINANCE_CONFIG_POLICY_EFFECTIVE_RANGE_INVALID');
    return Object.freeze({ from, to });
  }
}

function fieldDefinition(value: unknown): Readonly<Record<string, unknown>> {
  const field = record(value, 'FINANCE_FIELD_DEFINITION_INVALID');
  exact(field, new Set(['code', 'label', 'appliesTo', 'dataType', 'required', 'unit', 'options', 'description', 'effectiveFrom', 'effectiveTo']), 'FINANCE_FIELD_DEFINITION_INVALID');
  const code = text(field.code, 64, 'FINANCE_FIELD_CODE_INVALID');
  if (!/^[a-z][a-z0-9_.-]{1,63}$/.test(code)) throw new DomainError('FINANCE_FIELD_CODE_INVALID');
  const label = text(field.label, 80, 'FINANCE_FIELD_LABEL_INVALID');
  const appliesTo = choice(field.appliesTo, appliesToValues, 'FINANCE_FIELD_APPLIES_TO_INVALID');
  const dataType = choice(field.dataType, fieldTypes, 'FINANCE_FIELD_TYPE_INVALID');
  if (typeof field.required !== 'boolean') throw new DomainError('FINANCE_FIELD_REQUIRED_INVALID');
  const unit = optionalBoundedText(field.unit, 24, 'FINANCE_FIELD_UNIT_INVALID');
  const description = optionalBoundedText(field.description, 240, 'FINANCE_FIELD_DESCRIPTION_INVALID');
  const options = stringOptions(field.options);
  if ((dataType === 'select' || dataType === 'multiselect') !== options.length > 0) throw new DomainError('FINANCE_FIELD_OPTIONS_INVALID');
  const effectiveFrom = isoDate(field.effectiveFrom, 'FINANCE_FIELD_EFFECTIVE_FROM_INVALID');
  const effectiveTo = field.effectiveTo === undefined ? undefined : isoDate(field.effectiveTo, 'FINANCE_FIELD_EFFECTIVE_TO_INVALID');
  if (effectiveTo !== undefined && effectiveTo < effectiveFrom) throw new DomainError('FINANCE_FIELD_EFFECTIVE_RANGE_INVALID');
  return Object.freeze({
    code,
    label,
    appliesTo,
    dataType,
    required: field.required,
    ...(unit === null ? {} : { unit }),
    options,
    ...(description === null ? {} : { description }),
    effectiveFrom,
    ...(effectiveTo === undefined ? {} : { effectiveTo }),
  });
}

function taxRule(value: unknown): Readonly<Record<string, unknown>> {
  const rule = record(value, 'FINANCE_TAX_RULE_INVALID');
  exact(
    rule,
    new Set(['name', 'countryCode', 'regionCode', 'taxType', 'productTaxCategory', 'hsCode', 'ratePpm', 'priceInclusive', 'calculationMethod', 'roundingMode', 'priority', 'effectiveFrom', 'effectiveTo', 'sourceReference']),
    'FINANCE_TAX_RULE_INVALID'
  );
  const name = text(rule.name, 120, 'FINANCE_TAX_NAME_INVALID');
  const countryCode = text(rule.countryCode, 2, 'FINANCE_TAX_COUNTRY_INVALID');
  if (!/^[A-Z]{2}$/.test(countryCode)) throw new DomainError('FINANCE_TAX_COUNTRY_INVALID');
  const regionCode = optionalBoundedText(rule.regionCode, 64, 'FINANCE_TAX_REGION_INVALID');
  const taxType = choice(rule.taxType, taxTypes, 'FINANCE_TAX_TYPE_INVALID');
  const productTaxCategory = text(rule.productTaxCategory, 80, 'FINANCE_TAX_CATEGORY_INVALID');
  const hsCode = optionalBoundedText(rule.hsCode, 64, 'FINANCE_TAX_HS_CODE_INVALID');
  const ratePpm = safeInteger(rule.ratePpm, 0, 1_000_000, 'FINANCE_TAX_RATE_INVALID');
  if (typeof rule.priceInclusive !== 'boolean') throw new DomainError('FINANCE_TAX_PRICE_BASIS_INVALID');
  const calculationMethod = choice(rule.calculationMethod, calculationMethods, 'FINANCE_TAX_CALCULATION_INVALID');
  const roundingMode = choice(rule.roundingMode, roundingModes, 'FINANCE_TAX_ROUNDING_INVALID');
  const priority = safeInteger(rule.priority, 0, 10_000, 'FINANCE_TAX_PRIORITY_INVALID');
  const effectiveFrom = isoDate(rule.effectiveFrom, 'FINANCE_TAX_EFFECTIVE_FROM_INVALID');
  const effectiveTo = rule.effectiveTo === undefined ? undefined : isoDate(rule.effectiveTo, 'FINANCE_TAX_EFFECTIVE_TO_INVALID');
  if (effectiveTo !== undefined && effectiveTo < effectiveFrom) throw new DomainError('FINANCE_TAX_EFFECTIVE_RANGE_INVALID');
  const sourceReference = text(rule.sourceReference, 500, 'FINANCE_TAX_SOURCE_INVALID');
  return Object.freeze({
    name,
    countryCode,
    ...(regionCode === null ? {} : { regionCode }),
    taxType,
    productTaxCategory,
    ...(hsCode === null ? {} : { hsCode }),
    ratePpm,
    priceInclusive: rule.priceInclusive,
    calculationMethod,
    roundingMode,
    priority,
    effectiveFrom,
    ...(effectiveTo === undefined ? {} : { effectiveTo }),
    sourceReference,
  });
}

function stringOptions(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length > 100) throw new DomainError('FINANCE_FIELD_OPTIONS_INVALID');
  const options = value.map((item) => text(item, 80, 'FINANCE_FIELD_OPTIONS_INVALID'));
  if (new Set(options).size !== options.length) throw new DomainError('FINANCE_FIELD_OPTIONS_INVALID');
  return Object.freeze(options);
}

function record(value: unknown, code: string): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new DomainError(code);
  return value as Readonly<Record<string, unknown>>;
}

function exact(value: Readonly<Record<string, unknown>>, allowed: ReadonlySet<string>, code: string): void {
  if (Object.keys(value).some((key) => !allowed.has(key))) throw new DomainError(code);
}

function text(value: unknown, maximum: number, code: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum || value.trim() !== value) throw new DomainError(code);
  return value;
}

function optionalBoundedText(value: unknown, maximum: number, code: string): string | null {
  if (value === undefined) return null;
  if (typeof value !== 'string' || value.length > maximum || value.trim() !== value) throw new DomainError(code);
  return value;
}

function choice(value: unknown, values: ReadonlySet<string>, code: string): string {
  if (typeof value !== 'string' || !values.has(value)) throw new DomainError(code);
  return value;
}

function safeInteger(value: unknown, minimum: number, maximum: number, code: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) throw new DomainError(code);
  return value as number;
}

function isoDate(value: unknown, code: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new DomainError(code);
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month! - 1 || date.getUTCDate() !== day) throw new DomainError(code);
  return value;
}
