import {
  createFetchFinanceEntriesRead,
  createFetchFinanceAuditRead,
  createFetchFinanceFacetsRead,
  createFetchFinanceOverviewRead,
  createFetchFinancePoliciesRead,
  createFetchFinancePoliciesManage,
  createFetchFinancePoliciesPreview,
  createFetchFinanceReconciliationrepairsRead,
  createFetchFinanceReconciliationrepairsPreview,
  createFetchFinanceReconciliationrepairsSubmit,
  createFetchFinanceReconciliationrepairsDecide,
  createFetchFinanceReconciliationrepairsReverse,
  createFetchFinanceReconciliationsManage,
  createFetchFinanceReconciliationsRead,
  createFetchFinanceSettlementsRead,
  createFetchFinanceSettlementsDecide,
  createFetchFinanceStatementsRead,
  createFetchFinanceStatementsExport,
  createFetchFinanceWithdrawalsRead,
  createFetchFinanceWithdrawalsCreate,
  createFetchFinanceWithdrawalsDecide,
  createFetchFinanceWithdrawalsRecover,
} from '@shop/sdk/finance';
import { createFetchInvoiceRequestsCancel, createFetchInvoiceRequestsDecide, createFetchInvoiceRequestsRead, createFetchInvoiceRequestsRed } from '@shop/sdk/invoice';
import { OP_FINANCE_SETTLEMENTS_DECIDE, OP_FINANCE_STATEMENTS_EXPORT, OP_FINANCE_WITHDRAWALS_CREATE, OP_FINANCE_WITHDRAWALS_DECIDE, OP_FINANCE_WITHDRAWALS_RECOVER, OP_INVOICE_REQUESTS_CANCEL, OP_INVOICE_REQUESTS_DECIDE, OP_INVOICE_REQUESTS_RED } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { consoleCommand, consoleRequest } from '../../../shared/api/RequestContext';
import { FINANCE_PAGE_LIMIT, type FinanceCommandResult, type FinanceReconciliationChange, type FinanceReconciliationQuery, type FinanceSection } from '../model/Finance';
import type { FinanceCommand } from '../model/FinanceCommand';
import type { FinanceImportDraft } from '../model/FinanceImport';
import { isoDay, type FinancePolicyPreview, type FinanceRepair, type FinanceRepairPreview, type PolicyDraft, type RepairDecision, type RepairDraft } from '../model/FinanceGovernance';
import type { FinancePort } from '../public';
import { FinanceMapper } from './FinanceMapper';
import { StatementImportGateway } from '../../../shared/import/StatementImportGateway';

export class FinanceGateway implements FinancePort {
  private readonly overviewRead;
  private readonly auditRead;
  private readonly facetsRead;
  private readonly policiesRead;
  private readonly policiesPreview;
  private readonly policiesManage;
  private readonly repairsRead;
  private readonly repairsPreview;
  private readonly repairsSubmit;
  private readonly repairsDecide;
  private readonly repairsReverse;
  private readonly entriesRead;
  private readonly statementsRead;
  private readonly reconciliationsRead;
  private readonly reconciliationsManage;
  private readonly settlementsRead;
  private readonly withdrawalsRead;
  private readonly invoicesRead;
  private readonly statementsExport;
  private readonly settlementsDecide;
  private readonly withdrawalsCreate;
  private readonly withdrawalsDecide;
  private readonly withdrawalsRecover;
  private readonly invoicesCancel;
  private readonly invoicesDecide;
  private readonly invoicesRed;
  private readonly mapper = new FinanceMapper();
  private readonly imports;

  constructor(baseUrl: string) {
    this.imports = new StatementImportGateway(baseUrl);
    this.overviewRead = createFetchFinanceOverviewRead(baseUrl);
    this.auditRead = createFetchFinanceAuditRead(baseUrl);
    this.facetsRead = createFetchFinanceFacetsRead(baseUrl);
    this.policiesRead = createFetchFinancePoliciesRead(baseUrl);
    this.policiesPreview = createFetchFinancePoliciesPreview(baseUrl);
    this.policiesManage = createFetchFinancePoliciesManage(baseUrl);
    this.repairsRead = createFetchFinanceReconciliationrepairsRead(baseUrl);
    this.repairsPreview = createFetchFinanceReconciliationrepairsPreview(baseUrl);
    this.repairsSubmit = createFetchFinanceReconciliationrepairsSubmit(baseUrl);
    this.repairsDecide = createFetchFinanceReconciliationrepairsDecide(baseUrl);
    this.repairsReverse = createFetchFinanceReconciliationrepairsReverse(baseUrl);
    this.entriesRead = createFetchFinanceEntriesRead(baseUrl);
    this.statementsRead = createFetchFinanceStatementsRead(baseUrl);
    this.reconciliationsRead = createFetchFinanceReconciliationsRead(baseUrl);
    this.reconciliationsManage = createFetchFinanceReconciliationsManage(baseUrl);
    this.settlementsRead = createFetchFinanceSettlementsRead(baseUrl);
    this.withdrawalsRead = createFetchFinanceWithdrawalsRead(baseUrl);
    this.invoicesRead = createFetchInvoiceRequestsRead(baseUrl);
    this.statementsExport = createFetchFinanceStatementsExport(baseUrl);
    this.settlementsDecide = createFetchFinanceSettlementsDecide(baseUrl);
    this.withdrawalsCreate = createFetchFinanceWithdrawalsCreate(baseUrl);
    this.withdrawalsDecide = createFetchFinanceWithdrawalsDecide(baseUrl);
    this.withdrawalsRecover = createFetchFinanceWithdrawalsRecover(baseUrl);
    this.invoicesCancel = createFetchInvoiceRequestsCancel(baseUrl);
    this.invoicesDecide = createFetchInvoiceRequestsDecide(baseUrl);
    this.invoicesRed = createFetchInvoiceRequestsRed(baseUrl);
  }

  importProviders(context: ConsoleContext, signal?: AbortSignal) {
    return this.imports.providers(context, signal);
  }

  createImport(context: ConsoleContext, draft: FinanceImportDraft, identity: string, progress?: (processed: number) => void, signal?: AbortSignal) {
    if (!draft.file) throw new Error('IMPORT_FILE_REQUIRED');
    return this.imports.create(context, draft.file, draft, identity, progress, signal);
  }

  readImport(context: ConsoleContext, id: string, signal?: AbortSignal) {
    return this.imports.read(context, id, signal);
  }

  policies(context: ConsoleContext, cursor?: string, signal?: AbortSignal) {
    return this.policiesRead({ query: { limit: FINANCE_PAGE_LIMIT, ...(cursor === undefined ? {} : { cursor }) } }, consoleRequest(context.scope, signal, context.session.accessVersion));
  }

  previewPolicy(context: ConsoleContext, draft: PolicyDraft, identity: string, signal?: AbortSignal) {
    return this.policiesPreview({ body: {
      policyId: draft.id,
      targetStatus: draft.targetStatus,
      name: draft.name.trim(),
      trigger: draft.trigger.trim(),
      entries: draft.entries,
      effectiveAt: isoDay(draft.effectiveDate),
      ...(draft.expiresDate ? { expiresAt: isoDay(draft.expiresDate) } : { expiresAt: null }),
      sampleFrom: isoDay(draft.sampleFrom),
      sampleTo: isoDay(draft.sampleTo),
      expectedVersion: draft.expectedVersion,
    } }, this.governanceCommand(context, identity, draft.expectedVersion, undefined, signal));
  }

  async managePolicy(context: ConsoleContext, draft: PolicyDraft, preview: FinancePolicyPreview, proof: string, identity: string, signal?: AbortSignal) {
    const value = await this.policiesManage({ path: { policyid: draft.id }, body: { kind: 'accounting', rule: {
      name: draft.name.trim(), trigger: draft.trigger.trim(), entries: draft.entries, effectiveAt: isoDay(draft.effectiveDate),
      expiresAt: draft.expiresDate ? isoDay(draft.expiresDate) : null, targetStatus: draft.targetStatus,
      sampleFrom: isoDay(draft.sampleFrom), sampleTo: isoDay(draft.sampleTo), affectedCount: preview.affectedCount,
      previewToken: preview.previewToken, previewHash: preview.previewHash,
    } } }, this.governanceCommand(context, identity, draft.expectedVersion, proof, signal));
    return Object.freeze({ reference: value.id, state: value.state, version: value.version });
  }

  repairs(context: ConsoleContext, cursor?: string, signal?: AbortSignal) {
    return this.repairsRead({ query: { limit: FINANCE_PAGE_LIMIT, ...(cursor === undefined ? {} : { cursor }) } }, consoleRequest(context.scope, signal, context.session.accessVersion));
  }

  previewRepair(context: ConsoleContext, draft: RepairDraft, identity: string, signal?: AbortSignal) {
    return this.repairsPreview({ body: repairPreviewBody(draft) }, this.governanceCommand(context, identity, draft.expectedVersion, undefined, signal));
  }

  submitRepair(context: ConsoleContext, draft: RepairDraft, preview: FinanceRepairPreview, proof: string, identity: string, signal?: AbortSignal) {
    return this.repairsSubmit({ body: { previewToken: preview.previewToken, previewHash: preview.previewHash, expectedVersion: draft.expectedVersion } }, this.governanceCommand(context, identity, draft.expectedVersion, proof, signal));
  }

  decideRepair(context: ConsoleContext, repair: FinanceRepair, decision: RepairDecision, reason: string, approvalProof: string | undefined, identity: string, signal?: AbortSignal) {
    return this.repairsDecide({ path: { repairid: repair.id }, body: { decision, expectedVersion: repair.version, reason: reason.trim(), ...(approvalProof === undefined ? {} : { approvalProof }) } }, this.governanceCommand(context, identity, repair.version, undefined, signal));
  }

  reverseRepair(context: ConsoleContext, repair: FinanceRepair, reason: string, proof: string, identity: string, signal?: AbortSignal) {
    return this.repairsReverse({ path: { repairid: repair.id }, body: { expectedVersion: repair.version, reason: reason.trim() } }, this.governanceCommand(context, identity, repair.version, proof, signal));
  }

  private governanceCommand(context: ConsoleContext, identity: string, expectedVersion: number, proof: string | undefined, signal?: AbortSignal) {
    return consoleCommand(context.scope, {
      accessVersion: context.session.accessVersion,
      idempotencyKey: identity,
      expectedVersion,
      ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
      ...(proof === undefined ? {} : { proof }),
      ...(signal === undefined ? {} : { signal }),
    });
  }

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
      case 'entries': return this.entriesRead(input, request);
      case 'statements': return this.statementsRead(input, request);
      case 'reconciliations': return this.reconciliationsRead(input, request);
      case 'settlements': return this.settlementsRead(input, request);
      case 'withdrawals': return this.withdrawalsRead(input, request);
      case 'invoices': return this.invoicesRead(input, request);
      case 'policies': return this.policiesRead(input, request);
    }
  }

  async reconciliations(context: ConsoleContext, query: FinanceReconciliationQuery, signal?: AbortSignal) {
    const value = await this.reconciliationsRead({ query: {
      limit: query.limit,
      ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
      ...(query.period === undefined ? {} : { period: query.period }),
      ...(query.provider === undefined ? {} : { provider: query.provider }),
      ...(query.mall === undefined ? {} : { mall: query.mall }),
      ...(query.state === undefined ? {} : { state: query.state }),
      ...(query.differenceType === undefined ? {} : { differenceType: query.differenceType }),
    } }, consoleRequest(context.scope, signal, context.session.accessVersion));
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
      case OP_FINANCE_STATEMENTS_EXPORT: return commandResult(await this.statementsExport(command.input, request));
      case OP_FINANCE_SETTLEMENTS_DECIDE: return commandResult(await this.settlementsDecide(command.input, request));
      case OP_FINANCE_WITHDRAWALS_CREATE: return commandResult(await this.withdrawalsCreate(command.input, request));
      case OP_FINANCE_WITHDRAWALS_DECIDE: return commandResult(await this.withdrawalsDecide(command.input, request));
      case OP_FINANCE_WITHDRAWALS_RECOVER: return commandResult(await this.withdrawalsRecover(command.input, request));
      case OP_INVOICE_REQUESTS_CANCEL: return commandResult(await this.invoicesCancel(command.input, request));
      case OP_INVOICE_REQUESTS_DECIDE: return commandResult(await this.invoicesDecide(command.input, request));
      case OP_INVOICE_REQUESTS_RED: return commandResult(await this.invoicesRed(command.input, request));
    }
  }
}

function repairPreviewBody(draft: RepairDraft) {
  return {
    statementId: draft.statementId.trim(),
    sourceJournalId: draft.sourceJournalId.trim(),
    sourceHash: draft.sourceHash,
    entries: draft.entries,
    reason: draft.reason.trim(),
    expectedVersion: draft.expectedVersion,
  };
}

function commandResult(value: Readonly<{ id: string; state: string }>): FinanceCommandResult {
  return Object.freeze({ reference: value.id, state: value.state });
}
