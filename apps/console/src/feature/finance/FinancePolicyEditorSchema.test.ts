import { describe, expect, it } from 'vitest';
import { FinanceFieldPolicySchema, FinanceTaxPolicySchema, fieldOptions } from './FinancePolicyEditorSchema';

describe('Finance policy editor schemas', () => {
  it('parses a typed tax rule and normalizes database versions', () => {
    const policy = FinanceTaxPolicySchema.parse({
      id: 'finance.policy.tax.cn.food',
      scope_id: 'platform:preview',
      kind: 'tax',
      state: 'active',
      version: '7',
      rule: {
        name: '食品优惠税率',
        countryCode: 'CN',
        taxType: 'vat',
        productTaxCategory: 'food',
        ratePpm: 90_000,
        priceInclusive: true,
        calculationMethod: 'inclusive',
        roundingMode: 'line',
        priority: 100,
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-12-31',
        sourceReference: 'TAX-NOTICE-2026',
      },
    });
    expect(policy.version).toBe(7);
    expect(policy.rule.ratePpm).toBe(90_000);
  });

  it.each([
    ['floating rate', { ratePpm: 90_000.5 }],
    ['unsafe country', { countryCode: 'China' }],
    ['reversed effective range', { effectiveFrom: '2026-12-31', effectiveTo: '2026-01-01' }],
  ])('rejects %s', (_name, patch) => {
    expect(() => FinanceTaxPolicySchema.parse(taxPolicy(patch))).toThrow();
  });

  it('requires allowlisted options only for single- and multi-select fields', () => {
    expect(() => FinanceFieldPolicySchema.parse(fieldPolicy({ dataType: 'select', options: [] }))).toThrow(/SELECT_OPTIONS_REQUIRED/);
    expect(FinanceFieldPolicySchema.parse(fieldPolicy({ appliesTo: 'accounts_payable', dataType: 'multiselect', options: ['invoice', 'receipt'] })).rule).toMatchObject({
      appliesTo: 'accounts_payable',
      dataType: 'multiselect',
      options: ['invoice', 'receipt'],
    });
    expect(() => FinanceFieldPolicySchema.parse(fieldPolicy({ dataType: 'text', options: ['unexpected'] }))).toThrow(/OPTIONS_ONLY_ALLOWED_FOR_SELECT/);
    expect(fieldOptions('A, B\nA')).toEqual(['A', 'B']);
  });
});

function taxPolicy(patch: Readonly<Record<string, unknown>> = {}) {
  return {
    id: 'finance.policy.tax.cn.standard',
    scope_id: 'platform:preview',
    kind: 'tax',
    state: 'active',
    version: 1,
    rule: {
      name: '标准税率',
      countryCode: 'CN',
      taxType: 'vat',
      productTaxCategory: 'standard_goods',
      ratePpm: 130_000,
      priceInclusive: true,
      calculationMethod: 'inclusive',
      roundingMode: 'line',
      priority: 100,
      effectiveFrom: '2026-01-01',
      sourceReference: 'TAX-NOTICE',
      ...patch,
    },
  };
}

function fieldPolicy(patch: Readonly<Record<string, unknown>> = {}) {
  return {
    id: 'finance.policy.field.exemption',
    scope_id: 'platform:preview',
    kind: 'field-definition',
    state: 'active',
    version: 1,
    rule: { code: 'tax.exemption_code', label: '免税原因', appliesTo: 'tax_rule', dataType: 'select', required: false, options: ['public_welfare'], effectiveFrom: '2026-01-01', ...patch },
  };
}
