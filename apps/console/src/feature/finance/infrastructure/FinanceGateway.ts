import { createFetchFinanceEntriesRead, createFetchFinanceOverviewRead, createFetchFinanceReconciliationsRead, createFetchFinanceSettlementsRead, createFetchFinanceStatementsRead, createFetchFinanceWithdrawalsRead } from '@shop/sdk/finance';
import { createFetchInvoiceRequestsRead } from '@shop/sdk/invoice';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { consoleRequest } from '../../../shared/api/Client';
import { FINANCE_PAGE_LIMIT, type FinanceReconciliationQuery, type FinanceSection } from '../model/Finance';
import type { FinancePort } from '../public';
import { FinanceMapper } from './FinanceMapper';

export class FinanceGateway implements FinancePort {
  private readonly overviewRead;
  private readonly entriesRead;
  private readonly statementsRead;
  private readonly reconciliationsRead;
  private readonly settlementsRead;
  private readonly withdrawalsRead;
  private readonly invoicesRead;
  private readonly mapper = new FinanceMapper();

  constructor(baseUrl: string) {
    this.overviewRead = createFetchFinanceOverviewRead(baseUrl);
    this.entriesRead = createFetchFinanceEntriesRead(baseUrl);
    this.statementsRead = createFetchFinanceStatementsRead(baseUrl);
    this.reconciliationsRead = createFetchFinanceReconciliationsRead(baseUrl);
    this.settlementsRead = createFetchFinanceSettlementsRead(baseUrl);
    this.withdrawalsRead = createFetchFinanceWithdrawalsRead(baseUrl);
    this.invoicesRead = createFetchInvoiceRequestsRead(baseUrl);
  }

  async overview(context: ConsoleContext, signal?: AbortSignal) {
    const value = await this.overviewRead({}, consoleRequest(context.scope, signal, context.session.accessVersion));
    return this.mapper.overview(value);
  }

  async section(context: ConsoleContext, section: FinanceSection, cursor?: string, signal?: AbortSignal) {
    const input = { query: { limit: FINANCE_PAGE_LIMIT, ...(cursor === undefined ? {} : { cursor }) } };
    const request = consoleRequest(context.scope, signal, context.session.accessVersion);
    const value = section === 'entries'
      ? await this.entriesRead(input, request)
      : section === 'statements'
        ? await this.statementsRead(input, request)
        : section === 'reconciliations'
          ? await this.reconciliationsRead(input, request)
          : section === 'settlements'
            ? await this.settlementsRead(input, request)
            : section === 'withdrawals'
              ? await this.withdrawalsRead(input, request)
              : await this.invoicesRead(input, request);
    return this.mapper.section(section, value);
  }

  async reconciliations(context: ConsoleContext, query: FinanceReconciliationQuery, signal?: AbortSignal) {
    const value = await this.reconciliationsRead(
      { query: { limit: query.limit, ...(query.cursor === undefined ? {} : { cursor: query.cursor }) } },
      consoleRequest(context.scope, signal, context.session.accessVersion)
    );
    return this.mapper.reconciliations(value);
  }
}
