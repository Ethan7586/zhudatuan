import { deepFreeze } from '../../../shared/model/Immutable';
import { calendarRange } from '../../../shared/format/Date';
import type { FinanceRecord, FinanceRecordPage, FinanceSection } from '../model/Finance';
import { EntryPageSchema, ReconciliationPageSchema, SettlementPageSchema, StatementPageSchema } from './SectionSchema';

type CoreFinanceSection = Extract<FinanceSection, 'entries' | 'statements' | 'reconciliations' | 'settlements'>;

export class FinanceRecordProjection {
  map(section: CoreFinanceSection, value: unknown): FinanceRecordPage {
    switch (section) {
      case 'entries': {
        const page = EntryPageSchema.parse(value);
        return financePage(page, (row) => ({
          id: row.id,
          label: row.side === 'debit' ? '借方分录' : '贷方分录',
          reference: row.reference_id.startsWith(`${row.reference_type}:`) ? row.reference_id : `${row.reference_type}:${row.reference_id}`,
          amountMinor: row.amount_minor,
          currency: row.currency,
          state: row.side,
          occurredAt: row.posted_at ?? null,
          version: null,
          facts: [
            { label: '借贷方向', kind: 'text', value: row.side },
            { label: '分录金额', kind: 'money', minor: row.amount_minor, currency: row.currency },
            { label: '业务说明', kind: 'text', value: row.description },
            { label: '入账时间', kind: 'time', value: row.posted_at },
          ],
          technicalFacts: [
            { label: '分录编号', kind: 'reference', value: row.id },
            { label: '账户科目代码', kind: 'text', value: row.code },
          ],
        }));
      }
      case 'statements': {
        const page = StatementPageSchema.parse(value);
        return financePage(page, (row) => ({
          id: row.id,
          label: calendarRange(row.period_start, row.period_end),
          reference: row.id,
          amountMinor: row.closing_minor,
          currency: row.currency,
          state: row.state,
          occurredAt: row.generated_at,
          version: null,
          facts: [
            { label: '账期开始', kind: 'text', value: row.period_start },
            { label: '账期结束', kind: 'text', value: row.period_end },
            { label: '期初余额', kind: 'money', minor: row.opening_minor, currency: row.currency },
            { label: '借方发生额', kind: 'money', minor: row.debit_minor, currency: row.currency },
            { label: '贷方发生额', kind: 'money', minor: row.credit_minor, currency: row.currency },
            { label: '期末余额', kind: 'money', minor: row.closing_minor, currency: row.currency },
            { label: '生成时间', kind: 'time', value: row.generated_at },
          ],
          technicalFacts: [
            { label: '账单编号', kind: 'reference', value: row.id },
            { label: '文件引用', kind: 'reference', value: row.object_ref },
            { label: '文件校验值', kind: 'text', value: row.sha256 },
          ],
        }));
      }
      case 'reconciliations': {
        const page = ReconciliationPageSchema.parse(value);
        return financePage(page, (row) => ({
          id: row.id,
          label: `${row.provider} · ${row.period}`,
          reference: row.partner_id,
          amountMinor: row.difference_minor,
          currency: 'CNY',
          state: row.state,
          occurredAt: row.updated_at,
          version: row.version,
          facts: [
            { label: '渠道', kind: 'text', value: row.provider },
            { label: '账期', kind: 'text', value: row.period },
            { label: '借方金额', kind: 'money', minor: row.debit_minor, currency: 'CNY' },
            { label: '贷方金额', kind: 'money', minor: row.credit_minor, currency: 'CNY' },
            { label: '差异金额', kind: 'money', minor: row.difference_minor, currency: 'CNY' },
            { label: '更新时间', kind: 'time', value: row.updated_at },
          ],
          technicalFacts: [{ label: '账单校验值', kind: 'text', value: row.statement_hash }],
        }));
      }
      case 'settlements': {
        const page = SettlementPageSchema.parse(value);
        return financePage(page, (row) => ({
          id: row.id,
          label: `${row.partner_id} · ${row.period}`,
          reference: row.reconciliation_id,
          amountMinor: row.amount_minor,
          currency: row.currency,
          state: row.state,
          occurredAt: null,
          version: row.version,
          facts: [
            { label: '合作方', kind: 'reference', value: row.partner_id },
            { label: '账期', kind: 'text', value: row.period },
            { label: '结算总额', kind: 'money', minor: row.gross_minor, currency: row.currency },
            { label: '平台费用', kind: 'money', minor: row.fee_minor, currency: row.currency },
            { label: '应结金额', kind: 'money', minor: row.amount_minor, currency: row.currency },
            { label: '冻结时间', kind: 'time', value: row.frozen_at },
            { label: '批准时间', kind: 'time', value: row.approved_at },
            { label: '付款时间', kind: 'time', value: row.paid_at },
            { label: '结算明细', kind: 'text', value: `${row.lines.length} 条` },
            { label: '分账明细', kind: 'text', value: `${row.splits.length} 条` },
            { label: '调整记录', kind: 'text', value: `${row.adjustments.length} 条` },
          ],
          technicalFacts: [
            { label: '结算编号', kind: 'reference', value: row.id },
            { label: '输入校验值', kind: 'text', value: row.input_hash },
            { label: '输入水位', kind: 'time', value: row.input_watermark },
            { label: '计费依据', kind: 'text', value: row.invoice_basis },
          ],
        }));
      }
    }
  }
}

function financePage<T>(page: Readonly<{ items: readonly T[]; count: number; nextCursor?: string | undefined }>, map: (item: T) => FinanceRecord): FinanceRecordPage {
  return deepFreeze({ items: page.items.map(map), count: page.count, ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }) });
}
