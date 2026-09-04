import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { FinanceAudit, FinanceCommandResult, FinanceFacets, FinanceOverview, FinanceRecordPage, FinanceReconciliationChange, FinanceReconciliationPage, FinanceReconciliationQuery, FinanceSection } from '../model/Finance';
import type { FinanceCommand } from '../model/FinanceCommand';
import type { FinanceImportDraft, FinanceImportProviders, FinanceImportTask } from '../model/FinanceImport';
import type { FinanceGovernanceReceipt, FinancePolicyPage, FinancePolicyPreview, FinanceRepair, FinanceRepairPage, FinanceRepairPreview, PolicyDraft, RepairDecision, RepairDraft } from '../model/FinanceGovernance';

export interface FinancePort {
  overview(context: ConsoleContext, signal?: AbortSignal): Promise<FinanceOverview>;
  facets(context: ConsoleContext, signal?: AbortSignal): Promise<FinanceFacets>;
  audit(context: ConsoleContext, reference: string, signal?: AbortSignal): Promise<FinanceAudit>;
  section(context: ConsoleContext, section: FinanceSection, cursor?: string, signal?: AbortSignal): Promise<FinanceRecordPage>;
  reconciliations(context: ConsoleContext, query: FinanceReconciliationQuery, signal?: AbortSignal): Promise<FinanceReconciliationPage>;
  manageReconciliation(context: ConsoleContext, reconciliation: string, version: number, change: FinanceReconciliationChange, proof: string, identity: string, signal?: AbortSignal): Promise<void>;
  execute(context: ConsoleContext, command: FinanceCommand, proof: string, identity: string, signal?: AbortSignal): Promise<FinanceCommandResult>;
  importProviders(context: ConsoleContext, signal?: AbortSignal): Promise<FinanceImportProviders>;
  createImport(context: ConsoleContext, draft: FinanceImportDraft, identity: string, progress?: (processed: number) => void, signal?: AbortSignal): Promise<FinanceImportTask>;
  readImport(context: ConsoleContext, id: string, signal?: AbortSignal): Promise<FinanceImportTask>;
  policies(context: ConsoleContext, cursor?: string, signal?: AbortSignal): Promise<FinancePolicyPage>;
  previewPolicy(context: ConsoleContext, draft: PolicyDraft, identity: string, signal?: AbortSignal): Promise<FinancePolicyPreview>;
  managePolicy(context: ConsoleContext, draft: PolicyDraft, preview: FinancePolicyPreview, proof: string, identity: string, signal?: AbortSignal): Promise<FinanceGovernanceReceipt>;
  repairs(context: ConsoleContext, cursor?: string, signal?: AbortSignal): Promise<FinanceRepairPage>;
  previewRepair(context: ConsoleContext, draft: RepairDraft, identity: string, signal?: AbortSignal): Promise<FinanceRepairPreview>;
  submitRepair(context: ConsoleContext, draft: RepairDraft, preview: FinanceRepairPreview, proof: string, identity: string, signal?: AbortSignal): Promise<FinanceRepair>;
  decideRepair(context: ConsoleContext, repair: FinanceRepair, decision: RepairDecision, reason: string, approvalProof: string | undefined, identity: string, signal?: AbortSignal): Promise<FinanceRepair>;
  reverseRepair(context: ConsoleContext, repair: FinanceRepair, reason: string, proof: string, identity: string, signal?: AbortSignal): Promise<FinanceRepair>;
}
