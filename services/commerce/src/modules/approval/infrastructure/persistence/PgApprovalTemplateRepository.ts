import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { ApprovalRepository, ApprovalTemplateCommand, ApprovalTemplateVersionRecord } from '../../application/port/ApprovalRepository';
import { required, template, templateVersion, type TemplateRow, type VersionRow } from './ApprovalRecord';
import { PgApprovalQueryRepository } from './PgApprovalQueryRepository';

export class PgApprovalTemplateRepository extends PgApprovalQueryRepository {
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

  protected async insertVersion(context: WriteTransactionContext, command: ApprovalTemplateCommand, number: number): Promise<ApprovalTemplateVersionRecord> {
    const result = await this.transactions.database(context).query<VersionRow>(
      `insert into approval.template_versions(id,tenant_id,scope_id,template_id,number,name,subject_kind,steps,escalations,created_by,created_at)
       values('approvaltemplateversion:'||gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9,clock_timestamp())
       returning id,template_id "templateId",number,name,subject_kind "subjectKind",steps,escalations,created_by "createdBy",created_at "createdAt"`,
      [context.tenant, command.scopeId, command.id, number, command.name, command.subjectKind, JSON.stringify(command.steps), JSON.stringify(command.escalations), command.actorId]
    );
    return templateVersion(required(result.rows[0], 'APPROVAL_TEMPLATE_VERSION_CREATE_FAILED'));
  }

  protected async activeVersion(context: ReadTransactionContext, templateId: string, number: number | null): Promise<ApprovalTemplateVersionRecord> {
    const result = await this.transactions.database(context).query<VersionRow>(
      `select id,template_id "templateId",number,name,subject_kind "subjectKind",steps,escalations,created_by "createdBy",created_at "createdAt"
       from approval.template_versions where template_id=$1 and number=coalesce($2,(select max(number) from approval.template_versions where template_id=$1))`,
      [templateId, number]
    );
    return templateVersion(required(result.rows[0], 'APPROVAL_TEMPLATE_VERSION_MISSING'));
  }
}
