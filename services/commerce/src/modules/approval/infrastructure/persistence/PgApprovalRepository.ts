import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { ApprovalInstanceRecord, ApprovalProofRecord, ApprovalRepository, ApprovalTaskRecord, ApprovalTemplateVersionRecord } from '../../application/port/ApprovalRepository';
import { decisionRecord, proof, required, task, templateVersion, type ActiveTemplateRow, type DecisionRow, type ProofRow, type TaskRow } from './ApprovalRecord';
import { PgApprovalTemplateRepository } from './PgApprovalTemplateRepository';

export class PgApprovalRepository extends PgApprovalTemplateRepository implements ApprovalRepository {
  async createInstance(context: WriteTransactionContext, command: Parameters<ApprovalRepository['createInstance']>[1]) {
    const database = this.transactions.database(context);
    const active = await database.query<ActiveTemplateRow>(
      `select version.id,version.template_id "templateId",version.number,version.name,version.subject_kind "subjectKind",version.steps,
         version.escalations,version.created_by "createdBy",version.created_at "createdAt",template.scope_id "scopeId"
       from approval.templates template join approval.template_versions version
         on version.template_id=template.id and version.number=template.active_version
       where template.scope_id=$1 and template.subject_kind=$2 and template.state='enabled'
       order by template.updated_at desc,template.id limit 1 for share of template`,
      [command.scopeId, command.subjectKind]
    );
    const selected = active.rows[0];
    if (!selected) return null;
    await database.query(
      `insert into approval.instances(
         id,tenant_id,scope_id,template_id,template_version,subject_kind,subject_id,subject_version,subject_snapshot,
         action,evidence_hash,amount_minor,currency,constraints,requester_id,state,current_step,version,created_by,updated_by,created_at,updated_at,expires_at
       ) values($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14::jsonb,$15,'pending',1,1,$15,$15,clock_timestamp(),clock_timestamp(),$16)`,
      [
        command.id,
        context.tenant,
        command.scopeId,
        selected.templateId,
        selected.number,
        command.subjectKind,
        command.subjectId,
        command.subjectVersion,
        JSON.stringify(command.subjectSnapshot),
        command.action,
        command.evidenceHash,
        command.amountMinor,
        command.currency,
        JSON.stringify(command.constraints),
        command.requesterId,
        command.expiresAt,
      ]
    );
    const assigned = await this.insertTasks(context, command.id, templateVersion(selected), 1, command.requesterId);
    const instance = await this.instance(context, command.scopeId, command.id);
    return instance ? Object.freeze({ instance, assigned }) : null;
  }

  async cancelInstance(context: WriteTransactionContext, command: Parameters<ApprovalRepository['cancelInstance']>[1]) {
    const database = this.transactions.database(context);
    const cancelled = await database.query<{ readonly id: string; readonly version: number }>(
      `update approval.instances set state='cancelled',version=version+1,decided_at=clock_timestamp(),updated_by=$5,updated_at=clock_timestamp(),decision_reason=$6
       where id=$1 and scope_id=$2 and requester_id=$3 and version=$4 and state='pending' returning id,version`,
      [command.id, command.scopeId, command.requesterId, command.expectedVersion, context.actor, command.reason]
    );
    if (!cancelled.rows[0]) return null;
    await database.query(
      `update approval.tasks set state='cancelled',version=version+1,updated_at=clock_timestamp()
       where instance_id=$1 and state in('pending','escalated')`,
      [command.id]
    );
    return Object.freeze(cancelled.rows[0]);
  }

  async consumeProof(context: WriteTransactionContext, command: Parameters<ApprovalRepository['consumeProof']>[1]): Promise<ApprovalProofRecord | null> {
    const result = await this.transactions.database(context).query<ProofRow>(
      `update approval.proofs set consumed_at=clock_timestamp(),consumed_by=$13,consumer_operation=$11,consumer_request_hash=$12
       where token_hash=$1 and scope_id=$2 and subject_kind=$3 and subject_id=$4 and subject_version=$5 and action=$6
         and evidence_hash=$7 and amount_minor is not distinct from $8 and currency is not distinct from $9
         and constraints=$10::jsonb and consumed_at is null and expires_at>clock_timestamp()
       returning id,instance_id "instanceId",scope_id "scopeId",checker_id "checkerId",subject_kind "subjectKind",subject_id "subjectId",
         subject_version "subjectVersion",action,evidence_hash "evidenceHash",amount_minor "amountMinor",currency,constraints,issued_at "issuedAt",expires_at "expiresAt"`,
      [
        command.tokenHash,
        command.scopeId,
        command.subjectKind,
        command.subjectId,
        command.subjectVersion,
        command.action,
        command.evidenceHash,
        command.amountMinor,
        command.currency,
        JSON.stringify(command.constraints),
        command.consumerOperation,
        command.requestHash,
        command.consumerId,
      ]
    );
    const row = result.rows[0];
    return row ? proof(row) : null;
  }

  async escalateTask(context: WriteTransactionContext, command: Parameters<ApprovalRepository['escalateTask']>[1]) {
    const database = this.transactions.database(context);
    const state = command.action === 'reject' ? 'expired' : 'escalated';
    const updated = await database.query<TaskRow & { readonly scopeId: string }>(
      `update approval.tasks task set state=$3,
         assignee=case when $4::text is null then assignee else $4 end,
         escalation_count=escalation_count+1,
         reason=case when $3='expired' then '审批已超时' else reason end,version=version+1,updated_at=clock_timestamp()
       from approval.instances instance where task.id=$1 and instance.id=$2 and task.version=$5
         and task.state in('pending','escalated') and instance.state='pending'
       returning task.id,task.instance_id "instanceId",task.sequence,task.name,task.assignee_kind "assigneeKind",task.assignee,task.state,
         task.due_at "dueAt",task.decided_by "decidedBy",task.decided_at "decidedAt",task.reason,
         task.minimum_approvals "minimumApprovals",task.approval_count "approvalCount",task.version,instance.scope_id "scopeId"`,
      [command.taskId, command.instanceId, state, command.target ?? null, command.expectedVersion]
    );
    const row = updated.rows[0];
    if (!row) return null;
    if (state === 'expired') {
      await database.query(
        `update approval.instances set state='expired',version=version+1,decided_at=clock_timestamp(),decision_reason='审批已超时',updated_by=$2,updated_at=clock_timestamp()
         where id=$1 and state='pending'`,
        [command.instanceId, command.actorId]
      );
      await database.query(`update approval.tasks set state='expired',version=version+1,updated_at=clock_timestamp() where instance_id=$1 and id<>$2 and state in('pending','escalated')`, [command.instanceId, command.taskId]);
    }
    const instance = await this.instance(context, row.scopeId, command.instanceId);
    return instance ? Object.freeze({ task: task(row), instance }) : null;
  }

  async decideTask(context: WriteTransactionContext, command: Parameters<ApprovalRepository['decideTask']>[1]) {
    const database = this.transactions.database(context);
    const decision = await database.query<DecisionRow>(
      `insert into approval.decisions(id,tenant_id,scope_id,instance_id,task_id,outcome,reason,actor_id,evidence,proof_id,decided_at)
       select $1,$2,$3,task.instance_id,task.id,$5,$6,$7,$8::jsonb,$9,clock_timestamp()
       from approval.tasks task join approval.instances instance on instance.id=task.instance_id
       where task.id=$4 and instance.scope_id=$3 and instance.version=$10 and instance.state='pending'
         and task.version=$11 and task.state in('pending','escalated')
       on conflict(task_id,actor_principal_id) do nothing
       returning id,instance_id "instanceId",task_id "taskId",outcome,reason,actor_id "actorId",evidence,proof_id "proofId",decided_at "decidedAt"`,
      [command.decisionId, context.tenant, command.scopeId, command.id, command.outcome, command.reason, command.membership, JSON.stringify(command.evidence), command.proofId, command.instanceVersion, command.expectedVersion]
    );
    const decidedRecord = decision.rows[0];
    if (!decidedRecord) return null;
    const decided = await database.query<TaskRow>(
      `update approval.tasks task set state=$3,approval_count=approval_count+case when $7='approved' then 1 else 0 end,
         decided_by=case when $3='pending' then null else $4 end,decided_at=case when $3='pending' then null else clock_timestamp() end,
         reason=case when $3='pending' then task.reason else $5 end,version=task.version+1,updated_at=clock_timestamp()
       from approval.instances instance where task.id=$1 and instance.id=task.instance_id and instance.scope_id=$2
         and task.version=$6 and task.state in('pending','escalated')
       returning task.id,task.instance_id "instanceId",task.sequence,task.name,task.assignee_kind "assigneeKind",task.assignee,task.state,
         task.due_at "dueAt",task.decided_by "decidedBy",task.decided_at "decidedAt",task.reason,
         task.minimum_approvals "minimumApprovals",task.approval_count "approvalCount",task.version`,
      [command.id, command.scopeId, command.taskState, command.membership, command.reason, command.expectedVersion, command.outcome]
    );
    const decidedTask = decided.rows[0];
    if (!decidedTask) return null;
    const transitioned = await database.query<{ readonly currentStep: number; readonly templateId: string; readonly templateVersion: number }>(
      `update approval.instances set state=$3,current_step=coalesce($4,current_step),decided_at=case when $3='pending' then null else clock_timestamp() end,
         decision_reason=case when $3='pending' then null else $6 end,version=version+1,updated_by=$5,updated_at=clock_timestamp()
       where id=$1 and scope_id=$2 and state='pending' and version=$7
       returning current_step "currentStep",template_id "templateId",template_version "templateVersion"`,
      [decidedTask.instanceId, command.scopeId, command.nextState, command.nextStep, command.membership, command.reason, command.instanceVersion]
    );
    const transition = transitioned.rows[0];
    if (!transition) return null;
    if (command.nextState === 'rejected') {
      await database.query(`update approval.tasks set state='cancelled',version=version+1,updated_at=clock_timestamp() where instance_id=$1 and id<>$2 and state in('pending','escalated')`, [decidedTask.instanceId, decidedTask.id]);
    } else if (command.nextStep !== null && command.nextStep > decidedTask.sequence) {
      const version = await this.activeVersion(context, transition.templateId, transition.templateVersion);
      await this.insertTasks(context, decidedTask.instanceId, version, command.nextStep, command.membership);
    }
    if (command.nextState === 'approved') {
      if (!command.proofId || !command.proofHash || !command.proofExpiresAt) throw new Error('APPROVAL_PROOF_REQUIRED');
      await database.query(
        `insert into approval.proofs(
           id,tenant_id,scope_id,instance_id,token_hash,checker_id,subject_kind,subject_id,subject_version,action,evidence_hash,amount_minor,currency,constraints,issued_at,expires_at
         ) select $1,tenant_id,scope_id,id,$2,$3,subject_kind,subject_id,subject_version,action,evidence_hash,amount_minor,currency,constraints,clock_timestamp(),$4
           from approval.instances where id=$5 and scope_id=$6 and state='approved'`,
        [command.proofId, command.proofHash, command.membership, command.proofExpiresAt, decidedTask.instanceId, command.scopeId]
      );
    }
    const instance = await this.instance(context, command.scopeId, decidedTask.instanceId);
    return instance
      ? Object.freeze({
          task: task(decidedTask),
          instance,
          decision: decisionRecord(decidedRecord, command.proofToken),
        })
      : null;
  }

  private async insertTasks(context: WriteTransactionContext, instanceId: string, version: ApprovalTemplateVersionRecord, sequence: number, actorId: string): Promise<readonly ApprovalTaskRecord[]> {
    const step = version.steps.find((candidate) => candidate.sequence === sequence);
    if (!step) throw new Error('APPROVAL_TEMPLATE_STEP_MISSING');
    const tasks: ApprovalTaskRecord[] = [];
    for (const assignment of step.approvers) {
      const result = await this.transactions.database(context).query<TaskRow>(
        `insert into approval.tasks(
           id,tenant_id,scope_id,instance_id,sequence,name,assignee_kind,assignee,state,due_at,minimum_approvals,approval_count,
           escalation_count,version,created_by,updated_by,created_at,updated_at
         ) select 'approvaltask:'||gen_random_uuid(),instance.tenant_id,instance.scope_id,instance.id,$2,$3,$4,$5,'pending',
           clock_timestamp()+make_interval(hours=>$6),$7,0,0,1,$8,$8,clock_timestamp(),clock_timestamp()
           from approval.instances instance where instance.id=$1 and instance.state='pending'
         returning id,instance_id "instanceId",sequence,name,assignee_kind "assigneeKind",assignee,state,due_at "dueAt",
           decided_by "decidedBy",decided_at "decidedAt",reason,minimum_approvals "minimumApprovals",approval_count "approvalCount",version`,
        [instanceId, step.sequence, step.name, assignment.kind, assignment.value, step.dueHours, assignment.minimumApprovals, actorId]
      );
      tasks.push(task(required(result.rows[0], 'APPROVAL_TASK_CREATE_FAILED')));
    }
    return Object.freeze(tasks);
  }
}
