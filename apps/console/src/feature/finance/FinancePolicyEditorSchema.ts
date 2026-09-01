import { z } from 'zod';
import { DatabaseIntegerSchema } from '../../shared/schema/DatabaseInteger';

const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'INVALID_EFFECTIVE_DATE');
const OptionalCodeSchema = z.string().trim().max(64).optional();
const PolicyStateSchema = z.enum(['draft', 'pending_review', 'active', 'retired']);
const TaxTypeSchema = z.enum(['vat', 'gst', 'sales_tax', 'excise', 'customs']);
const CalculationMethodSchema = z.enum(['exclusive', 'inclusive', 'compound']);
const RoundingModeSchema = z.enum(['line', 'order', 'invoice']);
const FieldCodeSchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9_.-]{1,63}$/, 'INVALID_FIELD_CODE');
const FieldLabelSchema = z.string().trim().min(1).max(80);
const FieldAppliesToSchema = z.enum(['tax_rule', 'invoice', 'settlement', 'reconciliation', 'journal', 'accounts_receivable', 'accounts_payable', 'channel_clearing', 'distributor_commission', 'withdrawal', 'period_close']);
const FieldDataTypeSchema = z.enum(['text', 'integer', 'decimal', 'date', 'datetime', 'boolean', 'select', 'multiselect', 'country', 'region', 'currency', 'money', 'percentage', 'reference']);

export const FinanceRuleKindSchema = z.enum(['reconciliation', 'tax', 'fields']);
export const FinancePolicyEditorModeSchema = z.enum(['view', 'create', 'edit']);

export const FinanceTaxRuleSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    countryCode: z
      .string()
      .trim()
      .regex(/^[A-Z]{2}$/, 'INVALID_COUNTRY_CODE'),
    regionCode: OptionalCodeSchema,
    taxType: TaxTypeSchema,
    productTaxCategory: z.string().trim().min(1).max(80),
    hsCode: OptionalCodeSchema,
    ratePpm: z.number().int().min(0).max(1_000_000),
    priceInclusive: z.boolean(),
    calculationMethod: CalculationMethodSchema,
    roundingMode: RoundingModeSchema,
    priority: z.number().int().min(0).max(10_000),
    effectiveFrom: IsoDateSchema,
    effectiveTo: IsoDateSchema.optional(),
    sourceReference: z.string().trim().min(1).max(500),
  })
  .strict()
  .superRefine((rule, context) => {
    if (rule.effectiveTo !== undefined && rule.effectiveTo < rule.effectiveFrom) {
      context.addIssue({ code: 'custom', path: ['effectiveTo'], message: 'EFFECTIVE_RANGE_INVALID' });
    }
  });

export const FinanceFieldDefinitionSchema = z
  .object({
    code: FieldCodeSchema,
    label: FieldLabelSchema,
    appliesTo: FieldAppliesToSchema,
    dataType: FieldDataTypeSchema,
    required: z.boolean(),
    unit: z.string().trim().max(24).optional(),
    options: z.array(z.string().trim().min(1).max(80)).max(100),
    description: z.string().trim().max(240).optional(),
    effectiveFrom: IsoDateSchema,
    effectiveTo: IsoDateSchema.optional(),
  })
  .strict()
  .superRefine((field, context) => {
    if (field.effectiveTo !== undefined && field.effectiveTo < field.effectiveFrom) {
      context.addIssue({ code: 'custom', path: ['effectiveTo'], message: 'EFFECTIVE_RANGE_INVALID' });
    }
    const selectable = field.dataType === 'select' || field.dataType === 'multiselect';
    if (selectable && field.options.length === 0) {
      context.addIssue({ code: 'custom', path: ['options'], message: 'SELECT_OPTIONS_REQUIRED' });
    }
    if (!selectable && field.options.length > 0) {
      context.addIssue({ code: 'custom', path: ['options'], message: 'OPTIONS_ONLY_ALLOWED_FOR_SELECT' });
    }
  });

const FinanceConfigPolicyBaseSchema = z.object({
  id: z.string().min(1),
  scope_id: z.string().min(1),
  state: PolicyStateSchema,
  version: DatabaseIntegerSchema,
  desired_state: z.enum(['active', 'retired']).optional(),
  proposed_by: z.string().min(1).nullable().optional(),
  submitted_by: z.string().min(1).nullable().optional(),
  approved_by: z.string().min(1).nullable().optional(),
  rejected_by: z.string().min(1).nullable().optional(),
  effective_from: IsoDateSchema.optional(),
  effective_to: IsoDateSchema.nullable().optional(),
  revision_hash: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .nullable()
    .optional(),
  preview_hash: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .nullable()
    .optional(),
});

export const FinanceTaxPolicySchema = FinanceConfigPolicyBaseSchema.extend({
  kind: z.literal('tax'),
  rule: FinanceTaxRuleSchema,
});

export const FinanceFieldPolicySchema = FinanceConfigPolicyBaseSchema.extend({
  kind: z.literal('field-definition'),
  rule: FinanceFieldDefinitionSchema,
});

export const FinanceConfigPolicySchema = z.discriminatedUnion('kind', [FinanceTaxPolicySchema, FinanceFieldPolicySchema]);

export const FinanceTaxRuleDraftSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    countryCode: z
      .string()
      .trim()
      .regex(/^[A-Z]{2}$/, 'INVALID_COUNTRY_CODE'),
    regionCode: z.string().trim().max(64),
    taxType: TaxTypeSchema,
    productTaxCategory: z.string().trim().min(1).max(80),
    hsCode: z.string().trim().max(64),
    ratePpm: z.number().int().min(0).max(1_000_000),
    priceInclusive: z.boolean(),
    calculationMethod: CalculationMethodSchema,
    roundingMode: RoundingModeSchema,
    priority: z.number().int().min(0).max(10_000),
    effectiveFrom: IsoDateSchema,
    effectiveTo: z.union([z.literal(''), IsoDateSchema]),
    sourceReference: z.string().trim().min(1).max(500),
  })
  .superRefine((rule, context) => {
    if (rule.effectiveTo !== '' && rule.effectiveTo < rule.effectiveFrom) {
      context.addIssue({ code: 'custom', path: ['effectiveTo'], message: 'EFFECTIVE_RANGE_INVALID' });
    }
  });

export const FinanceFieldDefinitionDraftSchema = z
  .object({
    code: FieldCodeSchema,
    label: FieldLabelSchema,
    appliesTo: FieldAppliesToSchema,
    dataType: FieldDataTypeSchema,
    required: z.boolean(),
    unit: z.string().trim().max(24),
    optionsText: z.string().trim().max(2_000),
    description: z.string().trim().max(240),
    effectiveFrom: IsoDateSchema,
    effectiveTo: z.union([z.literal(''), IsoDateSchema]),
  })
  .superRefine((field, context) => {
    const options = fieldOptions(field.optionsText);
    const selectable = field.dataType === 'select' || field.dataType === 'multiselect';
    if (selectable && options.length === 0) {
      context.addIssue({ code: 'custom', path: ['optionsText'], message: 'SELECT_OPTIONS_REQUIRED' });
    }
    if (!selectable && options.length > 0) {
      context.addIssue({ code: 'custom', path: ['optionsText'], message: 'OPTIONS_ONLY_ALLOWED_FOR_SELECT' });
    }
    if (field.effectiveTo !== '' && field.effectiveTo < field.effectiveFrom) {
      context.addIssue({ code: 'custom', path: ['effectiveTo'], message: 'EFFECTIVE_RANGE_INVALID' });
    }
  });

export function fieldOptions(value: string): readonly string[] {
  return Object.freeze(
    value
      .split(/[\n,]/)
      .map((option) => option.trim())
      .filter((option, index, options) => option !== '' && options.indexOf(option) === index)
  );
}

export type FinanceRuleKind = z.infer<typeof FinanceRuleKindSchema>;
export type FinancePolicyEditorMode = z.infer<typeof FinancePolicyEditorModeSchema>;
export type FinanceTaxPolicy = z.infer<typeof FinanceTaxPolicySchema>;
export type FinanceFieldPolicy = z.infer<typeof FinanceFieldPolicySchema>;
export type FinanceConfigPolicy = z.infer<typeof FinanceConfigPolicySchema>;
export type FinanceTaxRuleDraft = z.infer<typeof FinanceTaxRuleDraftSchema>;
export type FinanceFieldDefinitionDraft = z.infer<typeof FinanceFieldDefinitionDraftSchema>;
