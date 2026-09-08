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
import type { FinanceImportDraft } from '../model/FinanceImport';
import { isoDay, type FinancePolicyPreview, type FinanceRepair, type FinanceRepairPreview, type PolicyDraft, type RepairDecision, type RepairDraft } from '../model/FinanceGovernance';
import type { FinancePort } from '../public';
import { FinanceMapper } from './FinanceMapper';
import { StatementImportGateway } from '../../../shared/import/StatementImportGateway';

import { repairPreviewBody } from './FinanceRequest';
import { FinanceClientGateway } from './FinanceClientGateway';
export class FinanceGovernanceGateway extends FinanceClientGateway {
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
    return this.policiesPreview(
      {
        body: {
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
        },
      },
      this.governanceCommand(context, identity, draft.expectedVersion, undefined, signal)
    );
  }

  async managePolicy(context: ConsoleContext, draft: PolicyDraft, preview: FinancePolicyPreview, proof: string, identity: string, signal?: AbortSignal) {
    const value = await this.policiesManage(
      {
        path: { policyid: draft.id },
        body: {
          kind: 'accounting',
          rule: {
            name: draft.name.trim(),
            trigger: draft.trigger.trim(),
            entries: draft.entries,
            effectiveAt: isoDay(draft.effectiveDate),
            expiresAt: draft.expiresDate ? isoDay(draft.expiresDate) : null,
            targetStatus: draft.targetStatus,
            sampleFrom: isoDay(draft.sampleFrom),
            sampleTo: isoDay(draft.sampleTo),
            affectedCount: preview.affectedCount,
            previewToken: preview.previewToken,
            previewHash: preview.previewHash,
          },
        },
      },
      this.governanceCommand(context, identity, draft.expectedVersion, proof, signal)
    );
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
    return this.repairsDecide(
      { path: { repairid: repair.id }, body: { decision, expectedVersion: repair.version, reason: reason.trim(), ...(approvalProof === undefined ? {} : { approvalProof }) } },
      this.governanceCommand(context, identity, repair.version, undefined, signal)
    );
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
}
