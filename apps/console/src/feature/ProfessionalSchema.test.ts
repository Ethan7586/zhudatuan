// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { AccessPageSchema } from './settings/access/AccessSchema';
import { ExperiencePageSchema } from './experience/infrastructure/ExperienceSchema';
import { ChannelConnectionPageSchema, ChannelOperationPageSchema, ChannelSyncPageSchema } from './channel/infrastructure/ChannelSchema';
import { EntryPageSchema, InvoicePageSchema, ReconciliationPageSchema, SettlementPageSchema, StatementPageSchema, WithdrawalPageSchema } from './finance/infrastructure/SectionSchema';
import { ImportJobSchema } from './product/importing/ImportSchema';
import { MemberPageSchema } from './settings/member/MemberSchema';
import { AnnouncementPageSchema, NotificationTemplatePageSchema } from './settings/notification/NotificationSchema';
import { QualificationPageSchema } from './settings/qualification/QualificationSchema';
import { ReportPageSchema } from './reporting/infrastructure/ReportingSchema';
import { CardLibraryPageSchema, IssueBatchPageSchema, ReservePageSchema, VoucherProgramPageSchema } from './voucher/infrastructure/VoucherSchema';

const pageSchemas = [
  AccessPageSchema,
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
  MemberPageSchema,
  AnnouncementPageSchema,
  NotificationTemplatePageSchema,
  QualificationPageSchema,
  ReportPageSchema,
  CardLibraryPageSchema,
  IssueBatchPageSchema,
  ReservePageSchema,
  VoucherProgramPageSchema,
] as const;

describe('Console professional response schemas', () => {
  it('rejects an unvalidated structural record in every professional read model', () => {
    for (const schema of pageSchemas) expect(() => schema.parse({ items: [{}], count: 1 })).toThrow();
    expect(() => ImportJobSchema.parse({ id: 'job:1', state: 'completed' })).toThrow();
  });

  it('normalizes database integers for finance and import evidence', () => {
    const entries = EntryPageSchema.parse({
      count: 1,
      items: [{ id: 'entry:1', side: 'debit', amount_minor: '31500', code: 'cash', currency: 'CNY', reference_type: 'order', reference_id: 'order:1', description: '订单', posted_at: null }],
    });
    const imported = ImportJobSchema.parse({
      id: 'job:1',
      state: 'completed',
      total_count: '5000',
      cursor_value: '5000',
      success_count: '4999',
      failure_count: '1',
      created_at: '2026-08-26T00:00:00Z',
      updated_at: '2026-08-26T00:01:00Z',
      errors: [{ row_number: '32', reason_code: 'SKU_INVALID' }],
    });
    expect(entries.items[0]?.amount_minor).toBe(31500);
    expect(imported.total_count).toBe(5000);
    expect(imported.errors[0]?.row_number).toBe(32);
  });
});
