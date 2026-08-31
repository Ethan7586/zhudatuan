import { z } from 'zod';
import { DatabaseIntegerSchema } from '../../shared/schema/DatabaseInteger';

const OptionalText = z.string().min(1).nullable();
const HashSchema = z.string().regex(/^[a-f0-9]{64}$/i);
const OptionalHashSchema = HashSchema.nullable();
const OptionalPolicyDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional();

const FinanceAuthorityPreviewSchema = z.object({
  source: z.literal('local-preview'),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  previousCursor: z.string().min(1).optional(),
});

export const FinancePolicySchema = z.object({
  id: z.string().min(1),
  scope_id: z.string().min(1),
  kind: z.string().min(1),
  rule: z.record(z.string(), z.unknown()),
  state: z.string().min(1),
  version: DatabaseIntegerSchema,
  desired_state: z.enum(['active', 'retired']).optional(),
  effective_from: OptionalPolicyDateSchema,
  effective_to: OptionalPolicyDateSchema,
  revision_hash: OptionalHashSchema.optional(),
  preview_hash: OptionalHashSchema.optional(),
  proposed_by: OptionalText.optional(),
  submitted_by: OptionalText.optional(),
  approved_by: OptionalText.optional(),
  rejected_by: OptionalText.optional(),
});

export const FinanceAuditRecordSchema = z.object({
  id: z.string().min(1),
  scope_id: z.string().min(1),
  actor_id: OptionalText,
  actor_type: z.string().min(1),
  action: z.string().min(1),
  resource_type: z.string().min(1),
  resource_id: OptionalText,
  before_hash: OptionalHashSchema,
  after_hash: OptionalHashSchema,
  evidence: z.record(z.string(), z.unknown()),
  trace_id: z.string().min(1),
  previous_hash: OptionalHashSchema,
  record_hash: HashSchema,
  recorded_at: z.string().min(1),
});

export const FinancePolicyPageSchema = authorityPage(FinancePolicySchema, 100);
export const FinanceAuditPageSchema = authorityPage(FinanceAuditRecordSchema, 200);

function authorityPage<TItem extends z.ZodType>(item: TItem, maximum: number) {
  return z
    .object({
      items: z.array(item).max(maximum),
      count: z.number().int().nonnegative(),
      nextCursor: z.string().min(1).optional(),
      preview: FinanceAuthorityPreviewSchema.optional(),
    })
    .superRefine((page, context) => {
      if (page.count !== page.items.length) context.addIssue({ code: 'custom', message: 'FINANCE_AUTHORITY_PAGE_COUNT_MISMATCH' });
      if (page.preview !== undefined && page.preview.total < page.count) context.addIssue({ code: 'custom', message: 'FINANCE_AUTHORITY_PREVIEW_TOTAL_INVALID' });
    });
}

export type FinancePolicy = z.infer<typeof FinancePolicySchema>;
export type FinanceAuditRecord = z.infer<typeof FinanceAuditRecordSchema>;
export type FinancePolicyPage = z.infer<typeof FinancePolicyPageSchema>;
export type FinanceAuditPage = z.infer<typeof FinanceAuditPageSchema>;
