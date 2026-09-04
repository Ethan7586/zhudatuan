import { describe, expect, it } from 'vitest';
import { ConfigFieldPolicy } from '../../02_domain_yewu/policy/ConfigFieldPolicy';

const policy = new ConfigFieldPolicy();

describe('configurable finance field policy', () => {
  it('accepts the Console field-definition shape', () => {
    expect(
      policy.validate('field-definition', {
        code: 'tax.exemption_code',
        label: '免税原因',
        appliesTo: 'tax_rule',
        dataType: 'select',
        required: false,
        options: ['public_welfare', 'diplomatic'],
        description: '法定免税依据',
        effectiveFrom: '2026-01-01',
      })
    ).toEqual({
      code: 'tax.exemption_code',
      label: '免税原因',
      appliesTo: 'tax_rule',
      dataType: 'select',
      required: false,
      options: ['public_welfare', 'diplomatic'],
      description: '法定免税依据',
      effectiveFrom: '2026-01-01',
    });
  });

  it('rejects arbitrary fields, duplicate options and invalid select definitions', () => {
    const valid = fieldDefinition();
    expect(() => policy.validate('field-definition', { ...valid, fallback: true })).toThrow('FINANCE_FIELD_DEFINITION_INVALID');
    expect(() => policy.validate('field-definition', { ...valid, options: ['one', 'one'] })).toThrow('FINANCE_FIELD_OPTIONS_INVALID');
    expect(() => policy.validate('field-definition', { ...valid, dataType: 'select', options: [] })).toThrow('FINANCE_FIELD_OPTIONS_INVALID');
    expect(() => policy.validate('field-definition', { ...valid, dataType: 'multiselect', options: [] })).toThrow('FINANCE_FIELD_OPTIONS_INVALID');
  });

  it.each([
    ['accounts_receivable', 'money'],
    ['accounts_payable', 'reference'],
    ['channel_clearing', 'datetime'],
    ['distributor_commission', 'percentage'],
    ['withdrawal', 'region'],
    ['period_close', 'multiselect'],
  ])('accepts finance-only %s fields with %s values', (appliesTo, dataType) => {
    const options = dataType === 'multiselect' ? ['domestic', 'cross_border'] : [];
    expect(policy.validate('field-definition', { ...fieldDefinition(), appliesTo, dataType, options })).toEqual(expect.objectContaining({ appliesTo, dataType, options }));
  });

  it('accepts the Console tax rule shape and safe integer ppm', () => {
    expect(policy.validate('tax', taxRule()).ratePpm).toBe(130_000);
  });

  it('rejects fractional, unsafe and out-of-range ppm', () => {
    for (const ratePpm of [0.5, Number.MAX_SAFE_INTEGER + 1, 1_000_001]) {
      expect(() => policy.validate('tax', { ...taxRule(), ratePpm })).toThrow('FINANCE_TAX_RATE_INVALID');
    }
  });

  it('rejects invalid calendar dates and reversed effective ranges', () => {
    expect(() => policy.validate('tax', { ...taxRule(), effectiveFrom: '2026-02-30' })).toThrow('FINANCE_TAX_EFFECTIVE_FROM_INVALID');
    expect(() => policy.validate('tax', { ...taxRule(), effectiveFrom: '2027-01-01', effectiveTo: '2026-01-01' })).toThrow('FINANCE_TAX_EFFECTIVE_RANGE_INVALID');
  });

  it('derives the authoritative policy effective range from the typed rule', () => {
    expect(policy.effectiveRange(policy.validate('tax', { ...taxRule(), effectiveTo: '2026-12-31' }))).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });
});

function taxRule(): Readonly<Record<string, unknown>> {
  return {
    name: '中国标准商品增值税',
    countryCode: 'CN',
    taxType: 'vat',
    productTaxCategory: 'standard_goods',
    ratePpm: 130_000,
    priceInclusive: true,
    calculationMethod: 'inclusive',
    roundingMode: 'line',
    priority: 100,
    effectiveFrom: '2026-01-01',
    sourceReference: 'TAX-NOTICE-2026-01',
  };
}

function fieldDefinition(): Readonly<Record<string, unknown>> {
  return {
    code: 'tax.note',
    label: '税务备注',
    appliesTo: 'tax_rule',
    dataType: 'text',
    required: false,
    options: [],
    effectiveFrom: '2026-01-01',
  };
}
