import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { ApprovalDecisionSnapshot, ApprovalInstanceRecord, ApprovalRepository, ApprovalTaskRecord } from '../../application/port/ApprovalRepository';
import { decisionRecord, instance, nestedEscalation, task, template, templateVersion, type DecisionRow, type DueTaskRow, type InstanceRow, type TaskRow, type TemplateRow, type VersionRow } from './ApprovalRecord';

export class PgApprovalQueryRepository {
  constructor(protected readonly transactions: PgTransactionAccess) {}

  async getTemplate(context: ReadTransactionContext, scopeId: string, id: string) {
    const database = this.transactions.database(context);
    const [found, versions] = await Promise.all([
      database.query<TemplateRow>(
        `select id,scope_id "scopeId",code,name,subject_kind "subjectKind",state,active_version "activeVersion",version,created_at "createdAt",updated_at "updatedAt"
         from approval.templates where id=$1 and scope_id=$2`,
        [id, scopeId]
      ),
      database.query<VersionRow>(
        `select id,template_id "templateId",number,name,subject_kind "subjectKind",steps,escalations,created_by "createdBy",created_at "createdAt"
         from approval.template_versions where template_id=$1 order by number desc`,
        [id]
      ),
    ]);
    const row = found.rows[0];
    return row ? Object.freeze({ template: template(row), versions: Object.freeze(versions.rows.map(templateVersion)) }) : null;
  }

  async listTemplates(context: ReadTransactionContext, query: Parameters<ApprovalRepository['listTemplates']>[1]) {
    const result = await this.transactions.database(context).query<TemplateRow>(
      `select id,scope_id "scopeId",code,name,subject_kind "subjectKind",state,active_version "activeVersion",version,created_at "createdAt",updated_at "updatedAt"
       from approval.templates where scope_id=$1 and ($2::text is null or state=$2) and ($3::text is null or subject_kind=$3)
         and ($4::text is null or (id,id)>($4,$5)) order by id limit $6`,
      [query.scopeId, query.state, query.subjectKind, query.sort, query.id, query.fetch]
    );
    return Object.freeze(result.rows.map(template));
  }

  async listTasks(context: ReadTransactionContext, query: Parameters<ApprovalRepository['listTasks']>[1]) {
    const result = await this.transactions.database(context).query<TaskRow>(
      `select task.id,task.instance_id "instanceId",task.sequence,task.name,task.assignee_kind "assigneeKind",task.assignee,task.state,
         task.due_at "dueAt",task.decided_by "decidedBy",task.decided_at "decidedAt",task.reason,
         task.minimum_approvals "minimumApprovals",task.approval_count "approvalCount",task.version
       from approval.tasks task join approval.instances instance on instance.id=task.instance_id
       where instance.scope_id=$1 and (
         task.assignee_kind='membership' and task.assignee=$2
         or task.assignee_kind='permission' and task.assignee=any($3::text[])
         or task.assignee_kind='role' and task.assignee=any($4::text[])
       ) and ($5::text is null or task.state=$5) and ($6::text is null or instance.subject_kind=$6)
         and ($7::text is null or (task.id,task.id)>($7,$8)) order by task.id limit $9`,
      [query.scopeId, query.membership, query.permissions, query.roles, query.state, query.subjectKind, query.sort, query.id, query.fetch]
    );
    return Object.freeze(result.rows.map(task));
  }

  async getInstance(context: ReadTransactionContext, scopeId: string, id: string): Promise<ApprovalInstanceRecord | null> {
    return this.instance(context, scopeId, id);
  }

  async dueTasks(
    context: ReadTransactionContext,
    limit: number
  ): Promise<readonly Readonly<{ task: ApprovalTaskRecord; instance: ApprovalInstanceRecord; escalation: Readonly<{ action: 'notify' | 'reassign' | 'reject'; target?: string }> }>[]> {
    const database = this.transactions.database(context);
    const result = await database.query<DueTaskRow>(
      `select task.id,task.instance_id "instanceId",task.sequence,task.name,task.assignee_kind "assigneeKind",task.assignee,task.state,
         task.due_at "dueAt",task.decided_by "decidedBy",task.decided_at "decidedAt",task.reason,
         task.minimum_approvals "minimumApprovals",task.approval_count "approvalCount",task.version,instance.scope_id "scopeId",
         case when instance.expires_at<=clock_timestamp() then 'reject'
              else coalesce(version.escalations->task.escalation_count->>'action','reject') end "escalationAction",
         case when instance.expires_at<=clock_timestamp() then null
              else version.escalations->task.escalation_count->>'target' end "escalationTarget"
       from approval.tasks task join approval.instances instance on instance.id=task.instance_id
       join approval.template_versions version on version.template_id=instance.template_id and version.number=instance.template_version
       where task.state in('pending','escalated') and instance.state='pending' and (
         instance.expires_at<=clock_timestamp()
         or jsonb_array_length(version.escalations)=0 and task.due_at<=clock_timestamp()
         or task.escalation_count<jsonb_array_length(version.escalations)
           and task.due_at+make_interval(hours=>(version.escalations->task.escalation_count->>'afterHours')::integer)<=clock_timestamp()
       )
       order by task.due_at,task.id limit $1`,
      [limit]
    );
    const due: Array<Readonly<{ task: ApprovalTaskRecord; instance: ApprovalInstanceRecord; escalation: Readonly<{ action: 'notify' | 'reassign' | 'reject'; target?: string }> }>> = [];
    for (const row of result.rows) {
      const instance = await this.instance(context, row.scopeId, row.instanceId);
      if (!instance) continue;
      const escalation = nestedEscalation(row);
      due.push(Object.freeze({ task: task(row), instance, escalation }));
    }
    return Object.freeze(due);
  }

  async lockTask(context: WriteTransactionContext, scopeId: string, id: string): Promise<ApprovalDecisionSnapshot | null> {
    const database = this.transactions.database(context);
    const locked = await database.query<TaskRow & { readonly requesterPrincipal: string }>(
      `select task.id,task.instance_id "instanceId",task.sequence,task.name,task.assignee_kind "assigneeKind",task.assignee,task.state,
         task.due_at "dueAt",task.decided_by "decidedBy",task.decided_at "decidedAt",task.reason,
         task.minimum_approvals "minimumApprovals",task.approval_count "approvalCount",task.version,instance.requester_principal_id "requesterPrincipal"
       from approval.tasks task join approval.instances instance on instance.id=task.instance_id
       where task.id=$1 and instance.scope_id=$2 for update of task,instance`,
      [id, scopeId]
    );
    const row = locked.rows[0];
    if (!row) return null;
    const instance = await this.instance(context, scopeId, row.instanceId);
    const { requesterPrincipal, ...taskRow } = row;
    return instance ? Object.freeze({ task: task(taskRow), instance, requesterPrincipal }) : null;
  }

  protected async instance(context: ReadTransactionContext, scopeId: string, id: string): Promise<ApprovalInstanceRecord | null> {
    const database = this.transactions.database(context);
    const [instances, tasks, decisions] = await Promise.all([
      database.query<InstanceRow>(
        `select instance.id,instance.scope_id "scopeId",instance.template_id "templateId",instance.template_version "templateVersion",
           instance.subject_kind "subjectKind",instance.subject_id "subjectId",instance.subject_version "subjectVersion",instance.subject_snapshot "subjectSnapshot",
           instance.action,instance.evidence_hash "evidenceHash",instance.constraints,
           instance.amount_minor "amountMinor",instance.currency,
           instance.requester_id "requesterId",instance.state,instance.current_step "currentStep",version.step_count "stepCount",instance.version,
           instance.created_at "createdAt",instance.decided_at "decidedAt",instance.expires_at "expiresAt"
         from approval.instances instance join approval.template_versions version on version.template_id=instance.template_id and version.number=instance.template_version
         where instance.id=$1 and instance.scope_id=$2`,
        [id, scopeId]
      ),
      database.query<TaskRow>(
        `select id,instance_id "instanceId",sequence,name,assignee_kind "assigneeKind",assignee,state,due_at "dueAt",decided_by "decidedBy",decided_at "decidedAt",reason,
           minimum_approvals "minimumApprovals",approval_count "approvalCount",version
         from approval.tasks where instance_id=$1 order by sequence,id`,
        [id]
      ),
      database.query<DecisionRow>(
        `select id,instance_id "instanceId",task_id "taskId",outcome,reason,actor_id "actorId",evidence,proof_id "proofId",decided_at "decidedAt"
         from approval.decisions where instance_id=$1 order by decided_at,id`,
        [id]
      ),
    ]);
    const row = instances.rows[0];
    return row
      ? Object.freeze({
          ...instance(row),
          tasks: Object.freeze(tasks.rows.map(task)),
          decisions: Object.freeze(decisions.rows.map((decision) => decisionRecord(decision, null))),
        })
      : null;
  }
}
