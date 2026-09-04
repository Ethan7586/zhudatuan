// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { AccessPageDtoSchema } from './settings/access/infrastructure/AccessSchema';
import { ExperiencePageSchema } from './experience/infrastructure/ExperienceSchema';
import { ChannelConnectionPageSchema, ChannelOperationPageSchema, ChannelSyncPageSchema } from './channel/infrastructure/ChannelSchema';
import { EntryPageSchema, InvoicePageSchema, ReconciliationPageSchema, SettlementPageSchema, StatementPageSchema, WithdrawalPageSchema } from './finance/infrastructure/SectionSchema';
import { CatalogImportDtoSchema, MemberImportDtoSchema, VoucherImportDtoSchema } from './task/infrastructure/TaskSchema';
import { MemberPageDtoSchema } from './settings/member/infrastructure/MemberSchema';
import { AnnouncementPageDtoSchema, TemplatePageDtoSchema } from './settings/notification/infrastructure/NotificationSchema';
import { QualificationPageSchema } from './settings/qualification/infrastructure/QualificationSchema';
import { ReportPageSchema } from './reporting/infrastructure/ReportingSchema';
import { CardLibraryPageSchema, IssueBatchPageSchema, ReservePageSchema, VoucherProgramPageSchema } from './voucher/infrastructure/VoucherSchema';

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
  CardLibraryPageSchema,
  IssueBatchPageSchema,
  ReservePageSchema,
  VoucherProgramPageSchema,
  CatalogImportDtoSchema,
  MemberImportDtoSchema,
  VoucherImportDtoSchema,
] as const;

describe('Console professional response schemas', () => {
  it('rejects an unvalidated structural record in every professional read model', () => {
    for (const schema of pageSchemas) expect(() => schema.parse({ items: [{}], count: 1 })).toThrow();
  });

  it('normalizes database integers only at legacy finance boundaries and keeps import contracts exact', () => {
    const entries = EntryPageSchema.parse({
      count: 1,
      items: [{ id: 'entry:1', side: 'debit', amount_minor: '31500', code: 'cash', currency: 'CNY', reference_type: 'order', reference_id: 'order:1', description: '订单', posted_at: null }],
    });
    const imported = MemberImportDtoSchema.parse({
      id: 'job:1',
      state: 'completed',
      total_count: 5000,
      cursor_value: 5000,
      success_count: 4999,
      failure_count: 1,
      created_at: '2026-08-26T00:00:00Z',
      updated_at: '2026-08-26T00:01:00Z',
      validation_summary: {},
      last_error: null,
      errors: [{ row_number: 32, reason_code: 'SKU_INVALID', field: null, detail: null }],
    });
    expect(entries.items[0]?.amount_minor).toBe(31500);
    expect(imported.total_count).toBe(5000);
    expect(imported.errors[0]?.row_number).toBe(32);
  });
});
