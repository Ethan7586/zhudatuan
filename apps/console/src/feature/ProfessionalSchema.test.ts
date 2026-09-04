// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { AccessPageDtoSchema } from './settings/access/infrastructure/AccessSchema';
import { ExperiencePageSchema } from './experience/infrastructure/ExperienceSchema';
import { ChannelConnectionPageSchema, ChannelOperationPageSchema, ChannelSyncPageSchema } from './channel/infrastructure/ChannelSchema';
import { EntryPageSchema, InvoicePageSchema, ReconciliationPageSchema, SettlementPageSchema, StatementPageSchema, WithdrawalPageSchema } from './finance/infrastructure/SectionSchema';
import { RuntimeTaskDtoSchema, RuntimeTaskPageDtoSchema } from './task/infrastructure/TaskSchema';
import { MemberPageDtoSchema } from './settings/member/infrastructure/MemberSchema';
import { AnnouncementPageDtoSchema, TemplatePageDtoSchema } from './settings/notification/infrastructure/NotificationSchema';
import { QualificationPageSchema } from './settings/qualification/infrastructure/QualificationSchema';
import { ReportPageSchema } from './reporting/infrastructure/ReportingSchema';
import { exactOperationOutput } from '@shop/contract/schema';

const VoucherProductPageSchema = exactOperationOutput('VoucherProductsListOutput');
const VoucherPoolPageSchema = exactOperationOutput('VoucherCredentialpoolsListOutput');
const VoucherStockPageSchema = exactOperationOutput('VoucherStockrequestsListOutput');
const VoucherIssuePageSchema = exactOperationOutput('VoucherIssueordersListOutput');

const pageSchemas = [
  AccessPageDtoSchema,
  ExperiencePageSchema,
  ChannelConnectionPageSchema,
  ChannelOperationPageSchema,
  ChannelSyncPageSchema,
  EntryPageSchema,
  InvoicePageSchema,
  ReconciliationPageSchema,
  SettlementPageSchema,
  StatementPageSchema,
  WithdrawalPageSchema,
  MemberPageDtoSchema,
  AnnouncementPageDtoSchema,
  TemplatePageDtoSchema,
  QualificationPageSchema,
  ReportPageSchema,
  VoucherProductPageSchema,
  VoucherPoolPageSchema,
  VoucherStockPageSchema,
  VoucherIssuePageSchema,
  RuntimeTaskDtoSchema,
  RuntimeTaskPageDtoSchema,
] as const;

describe('Console professional response schemas', () => {
  it('rejects an unvalidated structural record in every professional read model', () => {
    for (const schema of pageSchemas) expect(() => schema.parse({ items: [{}], count: 1 })).toThrow();
  });

  it('rejects legacy finance coercions and keeps import contracts exact', () => {
    expect(() => EntryPageSchema.parse({
      count: 1,
      items: [{ id: 'entry:1', side: 'debit', amount_minor: '31500', code: 'cash', currency: 'CNY', reference_type: 'order', reference_id: 'order:1', description: '订单', posted_at: null }],
    })).toThrow();
    const entries = EntryPageSchema.parse({
      count: 1,
      items: [{ id: 'entry:1', side: 'debit', amount_minor: 31500, code: 'cash', currency: 'CNY', reference_type: 'order', reference_id: 'order:1', description: '订单', posted_at: '2026-08-26T00:00:00Z' }],
    });
    const imported = RuntimeTaskDtoSchema.parse({
      id: 'job:1',
      type: 'import',
      owner: 'member',
      kind: 'member',
      title: '成员导入',
      state: 'completed',
      total: 5000,
      processed: 5000,
      succeeded: 4999,
      failed: 1,
      retryableItems: 1,
      cancellable: false,
      retryable: true,
      version: 2,
      createdAt: '2026-08-26T00:00:00Z',
      updatedAt: '2026-08-26T00:01:00Z',
      expiresAt: null,
      fileName: 'member.csv',
      downloadAvailable: true,
      confirmationRequired: true,
      previewHash: 'b'.repeat(64),
      columns: ['employeeNo', 'displayName'],
      validationErrors: 1,
    });
    expect(entries.items[0]?.amount_minor).toBe(31500);
    expect(imported.total).toBe(5000);
    expect(imported.retryableItems).toBe(1);
  });
});
