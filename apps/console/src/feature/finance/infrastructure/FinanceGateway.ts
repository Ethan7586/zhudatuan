import {
  OP_FINANCE_SETTLEMENTS_DECIDE,
  OP_FINANCE_STATEMENTS_EXPORT,
  OP_FINANCE_WITHDRAWALS_CREATE,
  OP_FINANCE_WITHDRAWALS_DECIDE,
  OP_FINANCE_WITHDRAWALS_RECOVER,
  OP_INVOICE_REQUESTS_CANCEL,
  OP_INVOICE_REQUESTS_DECIDE,
  OP_INVOICE_REQUESTS_RED,
} from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { consoleCommand, consoleRequest } from '../../../shared/api/RequestContext';
import { FINANCE_PAGE_LIMIT, type FinanceCommandResult, type FinanceReconciliationChange, type FinanceReconciliationQuery, type FinanceSection } from '../model/Finance';
import type { FinanceCommand } from '../model/FinanceCommand';
import type { FinancePort } from '../public';

import { FinanceGovernanceGateway } from './FinanceGovernanceGateway';
import { commandResult } from './FinanceRequest';
export class FinanceGateway extends FinanceGovernanceGateway implements FinancePort {
  async overview(context: ConsoleContext, signal?: AbortSignal) {
    const value = await this.overviewRead({}, consoleRequest(context.scope, signal, context.session.accessVersion));
    return this.mapper.overview(value);
  }

  async facets(context: ConsoleContext, signal?: AbortSignal) {
    const value = await this.facetsRead({}, consoleRequest(context.scope, signal, context.session.accessVersion));
    return this.mapper.facets(value);
  }

  async audit(context: ConsoleContext, reference: string, signal?: AbortSignal) {
    const value = await this.auditRead({ query: { reference } }, consoleRequest(context.scope, signal, context.session.accessVersion));
    return this.mapper.audit(value);
  }

  async section(context: ConsoleContext, section: FinanceSection, cursor?: string, signal?: AbortSignal) {
    const input = { query: { limit: FINANCE_PAGE_LIMIT, ...(cursor === undefined ? {} : { cursor }) } };
    const request = consoleRequest(context.scope, signal, context.session.accessVersion);
    const value = await this.readSection(section, input, request);
    return this.mapper.section(section, value);
  }

  private readSection(section: FinanceSection, input: { readonly query: { readonly limit: number; readonly cursor?: string } }, request: ReturnType<typeof consoleRequest>): Promise<unknown> {
    switch (section) {
      case 'entries':
        return this.entriesRead(input, request);
      case 'statements':
        return this.statementsRead(input, request);
      case 'reconciliations':
        return this.reconciliationsRead(input, request);
      case 'settlements':
        return this.settlementsRead(input, request);
      case 'withdrawals':
        return this.withdrawalsRead(input, request);
      case 'invoices':
        return this.invoicesRead(input, request);
      case 'policies':
        return this.policiesRead(input, request);
    }
  }

  async reconciliations(context: ConsoleContext, query: FinanceReconciliationQuery, signal?: AbortSignal) {
    const value = await this.reconciliationsRead(
      {
        query: {
          limit: query.limit,
          ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
          ...(query.period === undefined ? {} : { period: query.period }),
          ...(query.provider === undefined ? {} : { provider: query.provider }),
          ...(query.mall === undefined ? {} : { mall: query.mall }),
          ...(query.state === undefined ? {} : { state: query.state }),
          ...(query.differenceType === undefined ? {} : { differenceType: query.differenceType }),
        },
      },
      consoleRequest(context.scope, signal, context.session.accessVersion)
    );
    return this.mapper.reconciliations(value);
  }

  async manageReconciliation(context: ConsoleContext, reconciliation: string, version: number, change: FinanceReconciliationChange, proof: string, identity: string, signal?: AbortSignal) {
    const body =
      change.action === 'retry' || change.action === 'approve'
        ? { action: change.action, reason: change.reason, ...(change.evidence === undefined ? {} : { evidence: change.evidence }) }
        : { action: change.action, item: change.item ?? '', reason: change.reason, ...(change.evidence === undefined ? {} : { evidence: change.evidence }) };
    await this.reconciliationsManage(
      { path: { reconciliationid: reconciliation }, body },
      consoleCommand(context.scope, {
        accessVersion: context.session.accessVersion,
        expectedVersion: version,
        proof,
        idempotencyKey: identity,
        ...(context.session.csrf ? { csrfToken: context.session.csrf } : {}),
        ...(signal ? { signal } : {}),
      })
    );
  }

  async execute(context: ConsoleContext, command: FinanceCommand, proof: string, identity: string, signal?: AbortSignal): Promise<FinanceCommandResult> {
    const request = consoleCommand(context.scope, {
      accessVersion: context.session.accessVersion,
      ...('expectedVersion' in command && command.expectedVersion !== undefined ? { expectedVersion: command.expectedVersion } : {}),
      ...(proof ? { proof } : {}),
      idempotencyKey: identity,
      ...(context.session.csrf ? { csrfToken: context.session.csrf } : {}),
      ...(signal ? { signal } : {}),
    });
    switch (command.operation) {
      case OP_FINANCE_STATEMENTS_EXPORT:
        return commandResult(await this.statementsExport(command.input, request));
      case OP_FINANCE_SETTLEMENTS_DECIDE:
        return commandResult(await this.settlementsDecide(command.input, request));
      case OP_FINANCE_WITHDRAWALS_CREATE:
        return commandResult(await this.withdrawalsCreate(command.input, request));
      case OP_FINANCE_WITHDRAWALS_DECIDE:
        return commandResult(await this.withdrawalsDecide(command.input, request));
      case OP_FINANCE_WITHDRAWALS_RECOVER:
        return commandResult(await this.withdrawalsRecover(command.input, request));
      case OP_INVOICE_REQUESTS_CANCEL:
        return commandResult(await this.invoicesCancel(command.input, request));
      case OP_INVOICE_REQUESTS_DECIDE:
        return commandResult(await this.invoicesDecide(command.input, request));
      case OP_INVOICE_REQUESTS_RED:
        return commandResult(await this.invoicesRed(command.input, request));
    }
  }
}
