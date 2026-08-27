import {
  createFetchFinanceEntriesRead,
  createFetchFinanceReconciliationsRead,
  createFetchFinanceSettlementsRead,
  createFetchFinanceStatementsRead,
  createFetchFinanceWithdrawalsRead,
} from '@shop/sdk/finance';
import { createFetchInvoiceRequestsRead } from '@shop/sdk/invoice';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import {
  EntryPageSchema, InvoicePageSchema, ReconciliationPageSchema, SettlementPageSchema, StatementPageSchema,
  WithdrawalPageSchema, type FinanceRecord, type FinanceRecordPage, type FinanceSection,
} from './FinanceProfessionalSchema';

const entriesRead = createFetchFinanceEntriesRead(appConfig.apiBaseUrl);
const statementsRead = createFetchFinanceStatementsRead(appConfig.apiBaseUrl);
const reconciliationsRead = createFetchFinanceReconciliationsRead(appConfig.apiBaseUrl);
const settlementsRead = createFetchFinanceSettlementsRead(appConfig.apiBaseUrl);
const withdrawalsRead = createFetchFinanceWithdrawalsRead(appConfig.apiBaseUrl);
const invoiceRequestsRead = createFetchInvoiceRequestsRead(appConfig.apiBaseUrl);

export const financeProfessionalKey = (context: ConsoleContext, section: FinanceSection, cursor?: string) => Object.freeze([
  'console', context.scope.kind, context.scope.id, context.session.accessVersion, financeOperation(section), cursor ?? null, 50,
] as const);

export async function readFinanceProfessional(
  context: ConsoleContext,
  section: FinanceSection,
  cursor: string | undefined,
  signal: AbortSignal,
): Promise<FinanceRecordPage> {
  const input = { query: { limit: 50, ...(cursor === undefined ? {} : { cursor }) } };
  const request = consoleRequest(context.scope, signal, context.session.accessVersion);
  switch (section) {
    case 'entries': {
      const page = EntryPageSchema.parse(await entriesRead(input, request));
      return mapPage(page, (row) => ({ id: row.id, label: row.code, reference: `${row.reference_type}:${row.reference_id}`,
        amountMinor: row.amount_minor, currency: row.currency, state: row.side, occurredAt: row.posted_at ?? null, version: null }));
    }
    case 'statements': {
      const page = StatementPageSchema.parse(await statementsRead(input, request));
      return mapPage(page, (row) => ({ id: row.id, label: `${row.period_start} – ${row.period_end}`, reference: row.id,
        amountMinor: row.closing_minor, currency: row.currency, state: row.state, occurredAt: row.generated_at, version: null }));
    }
    case 'reconciliations': {
      const page = ReconciliationPageSchema.parse(await reconciliationsRead(input, request));
      return mapPage(page, (row) => ({ id: row.id, label: `${row.provider} · ${row.period}`, reference: row.partner_id,
        amountMinor: row.difference_minor, currency: 'CNY', state: row.state, occurredAt: row.updated_at, version: null }));
    }
    case 'settlements': {
      const page = SettlementPageSchema.parse(await settlementsRead(input, request));
      return mapPage(page, (row) => ({ id: row.id, label: `${row.partner_id} · ${row.period}`, reference: row.reconciliation_id,
        amountMinor: row.amount_minor, currency: row.currency, state: row.state, occurredAt: null, version: row.version }));
    }
    case 'withdrawals': {
      const page = WithdrawalPageSchema.parse(await withdrawalsRead(input, request));
      return mapPage(page, (row) => ({ id: row.id, label: row.id, reference: row.settlement_id, amountMinor: row.amount_minor,
        currency: row.currency, state: row.state, occurredAt: row.created_at, version: row.version }));
    }
    case 'invoices': {
      const page = InvoicePageSchema.parse(await invoiceRequestsRead(input, request));
      return mapPage(page, (row) => ({ id: row.id, label: row.id, reference: row.settlement_id ?? row.profile_id,
        amountMinor: row.amount_minor, currency: row.currency, state: row.state, occurredAt: row.issued_at ?? row.created_at,
        version: row.version }));
    }
  }
}

export function financeOperation(section: FinanceSection): string {
  return section === 'entries' ? 'finance.entries.read' : section === 'statements' ? 'finance.statements.read'
    : section === 'reconciliations' ? 'finance.reconciliations.read' : section === 'settlements' ? 'finance.settlements.read'
      : section === 'withdrawals' ? 'finance.withdrawals.read' : 'invoice.requests.read';
}

function mapPage<T>(page: Readonly<{ items: readonly T[]; count: number; nextCursor?: string | undefined }>, map: (item: T) => FinanceRecord): FinanceRecordPage {
  return Object.freeze({ items: Object.freeze(page.items.map(map)), count: page.count,
    ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }) });
}
