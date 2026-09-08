import type { ModuleJob } from '../../../../pipeline/ModuleJob';
import type { EscalateApproval } from '../../application/process/EscalateApproval';
import { ApprovalEscalationJob } from './ApprovalEscalationJob';

export function createJobs(process: EscalateApproval): readonly ModuleJob[] {
  return Object.freeze([{ id: 'approvalescalation', processor: new ApprovalEscalationJob(process) }]);
}
