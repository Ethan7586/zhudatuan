import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type {
  ApprovalDecisionRecord,
  ApprovalDecisionSnapshot,
  ApprovalInstanceRecord,
  ApprovalProofRecord,
  ApprovalRepository,
  ApprovalTaskRecord,
  ApprovalTemplateCommand,
  ApprovalTemplateRecord,
  ApprovalTemplateVersionRecord,
} from '../../application/port/ApprovalRepository';

interface TemplateRow extends Omit<ApprovalTemplateRecord, 'createdAt' | 'updatedAt'> {
  readonly createdAt: Date | string;
  readonly updatedAt: Date | string;
}

interface VersionRow extends Omit<ApprovalTemplateVersionRecord, 'createdAt'> {
  readonly createdAt: Date | string;
}

interface TaskRow extends Omit<ApprovalTaskRecord, 'dueAt' | 'decidedAt'> {
  readonly dueAt: Date | string | null;
  readonly decidedAt: Date | string | null;
}

interface DecisionRow extends Omit<ApprovalDecisionRecord, 'decidedAt' | 'proof'> {
  readonly decidedAt: Date | string;
}

interface ProofRow extends Omit<ApprovalProofRecord, 'issuedAt' | 'expiresAt'> {
  readonly issuedAt: Date | string;
  readonly expiresAt: Date | string;
}

interface ActiveTemplateRow extends VersionRow {
  readonly scopeId: string;
}

interface DueTaskRow extends TaskRow {
  readonly scopeId: string;
  readonly escalationAction: 'notify' | 'reassign' | 'reject';
  readonly escalationTarget: string | null;
}

interface InstanceRow extends Omit<ApprovalInstanceRecord, 'createdAt' | 'decidedAt' | 'expiresAt' | 'tasks' | 'decisions'> {
  readonly createdAt: Date | string;
  readonly decidedAt: Date | string | null;
  readonly expiresAt: Date | string | null;
}

export class PgApprovalRepository implements ApprovalRepository {
  constructor(private readonly transactions: PgTransactionAccess) {}

  async createTemplate(context: WriteTransactionContext, command: ApprovalTemplateCommand) {
    const database = this.transactions.database(context);
    const created = await database.query<TemplateRow>(
      `insert into approval.templates(id,tenant_id,scope_id,code,name,subject_kind,state,active_version,version,created_by,updated_by,created_at,updated_at)
       values($1,$2,$3,$4,$5,$6,'draft',null,1,$7,$7,clock_timestamp(),clock_timestamp()) on conflict(scope_id,code) do nothing
       returning id,scope_id "scopeId",code,name,subject_kind "subjectKind",state,active_version "activeVersion",version,created_at "createdAt",updated_at "updatedAt"`,
      [command.id, context.tenant, command.scopeId, command.code, command.name, command.subjectKind, command.actorId]
    );
    const row = created.rows[0];
    if (!row) return null;
    const active = await this.insertVersion(context, command, 1);
    return Object.freeze({ template: template(row), active });
  }

  async reviseTemplate(context: WriteTransactionContext, command: ApprovalTemplateCommand) {
    const database = this.transactions.database(context);
    const revised = await database.query<TemplateRow & { readonly nextVersion: number }>(
      `update approval.templates set name=$3,subject_kind=$4,version=version+1,updated_by=$5,updated_at=clock_timestamp()
       where id=$1 and scope_id=$2 and version=$6 and state<>'enabled'
       returning id,scope_id "scopeId",code,name,subject_kind "subjectKind",state,active_version "activeVersion",version,
         created_at "createdAt",updated_at "updatedAt",(select coalesce(max(number),0)+1 from approval.template_versions where template_id=$1) "nextVersion"`,
      [command.id, command.scopeId, command.name, command.subjectKind, command.actorId, command.expectedVersion]
    );
    const row = revised.rows[0];
    if (!row) return null;
    const active = await this.insertVersion(context, command, row.nextVersion);
    return Object.freeze({ template: template(row), active });
  }

  async setTemplateState(context: WriteTransactionContext, command: Parameters<ApprovalRepository['setTemplateState']>[1]) {
    const database = this.transactions.database(context);
    if (command.state === 'enabled') {
      await database.query(
        `select pg_advisory_xact_lock(hashtextextended(target.scope_id||':'||target.subject_kind,0))
           from approval.templates target where target.id=$1 and target.scope_id=$2`,
        [command.id, command.scopeId]
      );
      const conflict = await database.query<{ readonly present: boolean }>(
        `select exists(
           select 1 from approval.templates target join approval.templates enabled
             on enabled.scope_id=target.scope_id and enabled.subject_kind=target.subject_kind
            and enabled.state='enabled' and enabled.id<>target.id
          where target.id=$1 and target.scope_id=$2
        ) "present"`,
        [command.id, command.scopeId]
      );
      if (conflict.rows[0]?.present) return 'subjectconflict' as const;
    }
    const result = await database.query<TemplateRow>(
      `update approval.templates set state=$3,
         active_version=case when $3='enabled' then (select max(number) from approval.template_versions where template_id=$1) else active_version end,
         version=version+1,updated_by=$4,updated_at=clock_timestamp()
       where id=$1 and scope_id=$2 and version=$5 and state<>$3
       returning id,scope_id "scopeId",code,name,subject_kind "subjectKind",state,active_version "activeVersion",version,created_at "createdAt",updated_at "updatedAt"`,
      [command.id, command.scopeId, command.state, command.actorId, command.expectedVersion]
    );
    const row = result.rows[0];
    if (!row) return null;
    const active = await this.activeVersion(context, row.id, row.activeVersion);
    return Object.freeze({ template: template(row), active });
  }

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

  private async insertVersion(context: WriteTransactionContext, command: ApprovalTemplateCommand, number: number): Promise<ApprovalTemplateVersionRecord> {
    const result = await this.transactions.database(context).query<VersionRow>(
      `insert into approval.template_versions(id,tenant_id,scope_id,template_id,number,name,subject_kind,steps,escalations,created_by,created_at)
       values('approvaltemplateversion:'||gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9,clock_timestamp())
       returning id,template_id "templateId",number,name,subject_kind "subjectKind",steps,escalations,created_by "createdBy",created_at "createdAt"`,
      [context.tenant, command.scopeId, command.id, number, command.name, command.subjectKind, JSON.stringify(command.steps), JSON.stringify(command.escalations), command.actorId]
    );
    return templateVersion(required(result.rows[0], 'APPROVAL_TEMPLATE_VERSION_CREATE_FAILED'));
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

  private async activeVersion(context: ReadTransactionContext, templateId: string, number: number | null): Promise<ApprovalTemplateVersionRecord> {
    const result = await this.transactions.database(context).query<VersionRow>(
      `select id,template_id "templateId",number,name,subject_kind "subjectKind",steps,escalations,created_by "createdBy",created_at "createdAt"
       from approval.template_versions where template_id=$1 and number=coalesce($2,(select max(number) from approval.template_versions where template_id=$1))`,
      [templateId, number]
    );
    return templateVersion(required(result.rows[0], 'APPROVAL_TEMPLATE_VERSION_MISSING'));
  }

  private async instance(context: ReadTransactionContext, scopeId: string, id: string): Promise<ApprovalInstanceRecord | null> {
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

function template(row: TemplateRow): ApprovalTemplateRecord {
  return Object.freeze({ ...row, createdAt: utc(row.createdAt), updatedAt: utc(row.updatedAt) });
}

function templateVersion(row: VersionRow): ApprovalTemplateVersionRecord {
  return Object.freeze({ ...row, steps: Object.freeze(row.steps), escalations: Object.freeze(row.escalations), createdAt: utc(row.createdAt) });
}

function task(row: TaskRow): ApprovalTaskRecord {
  return Object.freeze({ ...row, dueAt: nullableUtc(row.dueAt), decidedAt: nullableUtc(row.decidedAt) });
}

function decisionRecord(row: DecisionRow, token: string | null): ApprovalDecisionRecord {
  return Object.freeze({ ...row, proof: token, evidence: Object.freeze({ ...row.evidence }), decidedAt: utc(row.decidedAt) });
}

function instance(row: InstanceRow): Omit<ApprovalInstanceRecord, 'tasks' | 'decisions'> {
  return Object.freeze({
    ...row,
    subjectSnapshot: Object.freeze({ ...row.subjectSnapshot }),
    constraints: Object.freeze({ ...row.constraints }),
    createdAt: utc(row.createdAt),
    decidedAt: nullableUtc(row.decidedAt),
    expiresAt: nullableUtc(row.expiresAt),
  });
}

function proof(row: ProofRow): ApprovalProofRecord {
  return Object.freeze({ ...row, constraints: Object.freeze({ ...row.constraints }), issuedAt: utc(row.issuedAt), expiresAt: utc(row.expiresAt) });
}

function nestedEscalation(row: DueTaskRow): Readonly<{ action: 'notify' | 'reassign' | 'reject'; target?: string }> {
  return Object.freeze({ action: row.escalationAction, ...(row.escalationTarget === null ? {} : { target: row.escalationTarget }) });
}

function utc(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('APPROVAL_TIME_INVALID');
  return date.toISOString();
}

function nullableUtc(value: Date | string | null): string | null {
  return value === null ? null : utc(value);
}

function required<T>(value: T | undefined, code: string): T {
  if (value === undefined) throw new Error(code);
  return value;
}
