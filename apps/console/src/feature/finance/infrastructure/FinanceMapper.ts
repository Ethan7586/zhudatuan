import { deepFreeze } from '../../../shared/model/Immutable';
import type { FinanceOverview, FinanceRecord, FinanceRecordPage, FinanceReconciliationPage, FinanceSection } from '../model/Finance';
import { FinanceOverviewSchema } from './OverviewSchema';
import { FinanceReconciliationPageSchema } from './ReconciliationSchema';
import { EntryPageSchema, InvoicePageSchema, ReconciliationPageSchema, SettlementPageSchema, StatementPageSchema, WithdrawalPageSchema } from './SectionSchema';

export class FinanceMapper {
  overview(value: unknown): FinanceOverview {
    const result = FinanceOverviewSchema.parse(value);
    return deepFreeze({
      items: result.items.map((item) => ({
        currency: item.currency,
        balanceMinor: item.balance_minor,
        liabilityMinor: item.liability_minor,
        incomeMinor: item.income_minor,
        expenseMinor: item.expense_minor,
        cashMinor: item.cash_minor,
        journalCount: item.journal_count,
        watermark: item.watermark,
      })),
    });
  }

  section(section: FinanceSection, value: unknown): FinanceRecordPage {
    switch (section) {
      case 'entries': {
        const page = EntryPageSchema.parse(value);
        return this.page(page, (row) => ({ id: row.id, label: row.code, reference: `${row.reference_type}:${row.reference_id}`, amountMinor: row.amount_minor, currency: row.currency, state: row.side, occurredAt: row.posted_at ?? null, version: null }));
      }
      case 'statements': {
        const page = StatementPageSchema.parse(value);
        return this.page(page, (row) => ({ id: row.id, label: `${row.period_start} – ${row.period_end}`, reference: row.id, amountMinor: row.closing_minor, currency: row.currency, state: row.state, occurredAt: row.generated_at, version: null }));
      }
      case 'reconciliations': {
        const page = ReconciliationPageSchema.parse(value);
        return this.page(page, (row) => ({ id: row.id, label: `${row.provider} · ${row.period}`, reference: row.partner_id, amountMinor: row.difference_minor, currency: 'CNY', state: row.state, occurredAt: row.updated_at, version: null }));
      }
      case 'settlements': {
        const page = SettlementPageSchema.parse(value);
        return this.page(page, (row) => ({ id: row.id, label: `${row.partner_id} · ${row.period}`, reference: row.reconciliation_id, amountMinor: row.amount_minor, currency: row.currency, state: row.state, occurredAt: null, version: row.version }));
      }
      case 'withdrawals': {
        const page = WithdrawalPageSchema.parse(value);
        return this.page(page, (row) => ({ id: row.id, label: row.id, reference: row.settlement_id, amountMinor: row.amount_minor, currency: row.currency, state: row.state, occurredAt: row.created_at, version: row.version }));
      }
      case 'invoices': {
        const page = InvoicePageSchema.parse(value);
        return this.page(page, (row) => ({ id: row.id, label: row.id, reference: row.settlement_id ?? row.profile_id, amountMinor: row.amount_minor, currency: row.currency, state: row.state, occurredAt: row.issued_at ?? row.created_at, version: row.version }));
      }
    }
  }

  reconciliations(value: unknown): FinanceReconciliationPage {
    const page = FinanceReconciliationPageSchema.parse(value);
    return deepFreeze({
      items: page.items.map((row) => ({
        id: row.id,
        ...(row.scope_id === undefined ? {} : { scopeId: row.scope_id }),
        provider: row.provider,
        partnerId: row.partner_id,
        period: row.period,
        ...(row.statement_ref === undefined ? {} : { statementRef: row.statement_ref }),
        ...(row.statement_hash === undefined ? {} : { statementHash: row.statement_hash }),
        debitMinor: row.debit_minor,
        creditMinor: row.credit_minor,
        differenceMinor: row.difference_minor,
        state: row.state,
        evidence: row.evidence,
        ...(row.approved_by === undefined ? {} : { approvedBy: row.approved_by }),
        updatedAt: row.updated_at,
        version: row.version,
        itemCounts: row.item_counts,
        items: row.items.map((item) => ({
          id: item.id,
          externalMinor: item.externalMinor,
          internalMinor: item.internalMinor,
          differenceMinor: item.differenceMinor,
          state: item.state,
          ...(item.reasonCode === undefined ? {} : { reasonCode: item.reasonCode }),
          evidence: item.evidence,
          ...(item.resolution === undefined ? {} : { resolution: item.resolution }),
          ...(item.resolvedBy === undefined ? {} : { resolvedBy: item.resolvedBy }),
          ...(item.approvedBy === undefined ? {} : { approvedBy: item.approvedBy }),
        })),
      })),
      count: page.count,
      ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
    });
  }

  private page<T>(page: Readonly<{ items: readonly T[]; count: number; nextCursor?: string | undefined }>, map: (item: T) => FinanceRecord): FinanceRecordPage {
    return deepFreeze({ items: page.items.map(map), count: page.count, ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }) });
  }
}
