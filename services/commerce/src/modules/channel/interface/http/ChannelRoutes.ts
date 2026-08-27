import { randomUUID } from 'node:crypto';
import { OperationCatalog } from '@shop/contract';
import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../../foundation/application/AuditSink';
import { ModuleOperations, operationLifecycle, requireAccess, rowResult, type OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { OperationUsecase } from '../../../../foundation/application/OperationHandler';
import { bodyRecord, integerField, keysetResult, queryPage, textField } from '../../../../foundation/interface/Validation';
import { KMS_CLIENT } from '../../../../foundation/infrastructure/KmsClient';
import { SECRET_STORE } from '../../../../foundation/infrastructure/SecretStore';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { createConnectionOperations } from '../../application/command/CreateConnection';
import { enableConnectionOperations } from '../../application/command/EnableConnection';
import { runSyncOperations } from '../../application/command/RunSync';
import { getConnectionsOperations } from '../../application/query/GetConnections';
import { getSyncRunsOperations } from '../../application/query/GetSyncRuns';
import { PgChannelRepository } from '../../infrastructure/persistence/PgChannelRepository';
import { channelWebhook } from './ChannelWebhook';
import { MANIFEST_VERIFIER } from '../../../../bootstrap/SignatureVerifier';
import { ContractPolicy,DisableExtension,EnableExtension,EXTENSION_LOADER,extensionRepository,InstallExtension } from '../../../extension/ExtensionModule';
import { organizationPort } from '../../../organization/OrganizationModule';
import { capabilityPort } from '../../../capability/CapabilityModule';

export function channelRoutes(context: ModuleContext): OperationUsecase {
  const pool = context.container.get(DATABASE_POOL);
  const kms = context.container.get(KMS_CLIENT);
  const audit = context.container.get(AUDIT_SINK);
  const secrets=context.container.get(SECRET_STORE); const loader=context.container.get(EXTENSION_LOADER);
  const extensions=(database:OperationDatabase)=>extensionRepository(database);
  const install=new InstallExtension(extensions,context.container.get(MANIFEST_VERIFIER),new ContractPolicy(),loader);
  const enable=new EnableExtension(extensions,loader); const disable=new DisableExtension(extensions,loader);
  const standard = new ModuleOperations('channel', pool, audit, {
    ...createConnectionOperations(install,secrets),
    ...enableConnectionOperations(enable,disable),
    ...runSyncOperations((database) => new PgChannelRepository(database)),
    ...getConnectionsOperations(extensions),
    ...getSyncRunsOperations(),
    'channel.distributors.create': operationLifecycle({
      prepare: async (request) => {
        const access = requireAccess(request);
        const body = bodyRecord(request);
        const id = `distributor:${randomUUID()}`;
        const contact = optional(body, 'contact');
        const envelope = contact === null ? null : await kms.encrypt('channel/contact', contact, { distributor: id, scope: access.scope.id });
        return { access, body, id, envelope };
      },
      execute: async (_request, database, { access, body, id, envelope }) => {
      await organizationPort.createDistributor(database, { id, parent: access.scope.id, name: textField(body, 'name'),
        timezone: optional(body, 'timezone') ?? 'Asia/Shanghai' });
      const result = await database.query(`insert into channel.distributor(id,organization_id,code,name,contact_ciphertext,contact_token,contact_key_version,
        settlement_mode,metadata,status,created_at,updated_at) values($1,$1,$2,$3,$4,$5,$6,$7,$8::jsonb,'active',clock_timestamp(),clock_timestamp()) returning *`,
      [id, textField(body, 'code', 64), textField(body, 'name'), envelope?.ciphertext ?? null, envelope?.fingerprint ?? null,
        envelope?.keyVersion ?? null, textField(body, 'settlementMode', 64), JSON.stringify(object(body.metadata))]);
        return rowResult(result, 201);
      },
    }),
    'channel.distributors.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const result = await database.query(`select distributor.id,distributor.organization_id,distributor.code,distributor.name,
        distributor.settlement_mode,distributor.metadata,distributor.status,distributor.created_at,distributor.updated_at,
        count(binding.id)::integer tenant_count from channel.distributor distributor
        join organization.unitclosure visible on visible.descendant_id=distributor.organization_id and visible.ancestor_id=$1
        left join channel.tenantbinding binding on binding.distributor_id=distributor.id and binding.state='active'
        where ($2::timestamptz is null or (distributor.updated_at,distributor.id)<($2::timestamptz,$3))
        group by distributor.id order by distributor.updated_at desc,distributor.id desc limit $4`, [access.scope.id, page.sort, page.id, page.fetch]);
      return keysetResult(result, page, 'updated_at');
    },
    'channel.distributors.update': operationLifecycle({
      prepare: async (request) => {
        const access = requireAccess(request);
        const body = bodyRecord(request);
        const id = request.input.path.distributorid!;
        const contact = optional(body, 'contact');
        const envelope = contact === null ? null : await kms.encrypt('channel/contact', contact, { distributor: id, scope: access.scope.id });
        return { access, body, id, envelope };
      },
      execute: async (_request, database, { access, body, id, envelope }) => {
      const result = await database.query(`update channel.distributor distributor set name=coalesce($3,name),settlement_mode=coalesce($4,settlement_mode),
        metadata=coalesce($5::jsonb,metadata),contact_ciphertext=case when $6::boolean then $7 else contact_ciphertext end,
        contact_token=case when $6::boolean then $8 else contact_token end,contact_key_version=case when $6::boolean then $9 else contact_key_version end,
        updated_at=clock_timestamp() from organization.unitclosure visible where distributor.id=$1 and visible.descendant_id=distributor.organization_id
        and visible.ancestor_id=$2 returning distributor.*`, [id, access.scope.id, maybe(body.name), maybe(body.settlementMode), body.metadata === undefined ? null : JSON.stringify(object(body.metadata)),
        body.contact !== undefined, envelope?.ciphertext ?? null, envelope?.fingerprint ?? null, envelope?.keyVersion ?? null]);
      if (!result.rows[0]) throw new Error('RESOURCE_NOT_FOUND');
      if (body.name !== undefined) await organizationPort.rename(database, id, textField(body, 'name'));
        return rowResult(result);
      },
    }),
    'channel.distributors.disable': async (request, database) => {
      const access = requireAccess(request);
      const id = request.input.path.distributorid!;
      const result = await database.query(`update channel.distributor distributor set status='terminated',updated_at=clock_timestamp()
        from organization.unitclosure visible where distributor.id=$1 and visible.descendant_id=distributor.organization_id and visible.ancestor_id=$2
        and not exists(select 1 from channel.tenantbinding where distributor_id=distributor.id and state='active') returning distributor.*`, [id, access.scope.id]);
      if (!result.rows[0]) throw new Error('DISTRIBUTOR_HAS_ACTIVE_BINDINGS_OR_NOT_FOUND');
      await organizationPort.disable(database, id);
      return rowResult(result);
    },
    'channel.bindings.manage': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const distributor = textField(body, 'distributor');
      const tenant = textField(body, 'tenant');
      const visible = await database.query(`select 1 from organization.unitclosure root join organization.unitclosure child on child.ancestor_id=root.descendant_id
        join organization.organization target on target.id=child.descendant_id and target.kind='tenant'
        where root.ancestor_id=$1 and root.descendant_id=$2 and child.descendant_id=$3`, [access.scope.id, distributor, tenant]);
      if (!visible.rows[0]) throw new Error('BINDING_SCOPE_INVALID');
      const result = await database.query(`insert into channel.tenantbinding(id,distributor_id,tenant_id,state,evidence,effective_at,expires_at,created_at,updated_at)
        values($1,$2,$3,$4,$5::jsonb,coalesce($6::timestamptz,clock_timestamp()),$7,clock_timestamp(),clock_timestamp()) on conflict(id) do update
        set state=excluded.state,evidence=excluded.evidence,expires_at=excluded.expires_at,updated_at=clock_timestamp()
        where channel.tenantbinding.distributor_id=$2 and channel.tenantbinding.tenant_id=$3 returning *`, [request.input.path.bindingid!, distributor, tenant,
        state(body, ['draft', 'active', 'expired', 'terminated']), JSON.stringify(object(body.evidence)), body.effectiveAt ?? null, body.expiresAt ?? null]);
      return rowResult(result);
    },
    'channel.quotas.manage': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const result = await capabilityPort.save(database, { id: request.input.path.quotaid!, scope: access.scope.id,
        capability: textField(body, 'capability'), state: body.state === 'disabled' ? 'disabled' : 'enabled',
        quota: body.quota === null ? null : integerField(body, 'quota'), expiresAt: body.expiresAt ?? null,
        expectedVersion: request.input.expectedVersion ?? null });
      if (!result.rows[0]) throw new Error('VERSION_CONFLICT');
      return rowResult(result);
    },
    'channel.operations.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const result = await database.query(`select id,provider,kind,internal_reference,external_reference,state,response,created_at,updated_at
        from channel.provideroperation where scope_id=$1 and ($2::timestamptz is null or (updated_at,id)<($2::timestamptz,$3))
        order by updated_at desc,id desc limit $4`, [access.scope.id, page.sort, page.id, page.fetch]);
      return keysetResult(result, page, 'updated_at');
    },
    'channel.operations.replay': async (request, database) => {
      const access = requireAccess(request);
      const operation = await database.query<{ id: string; kind: string; internal_reference: string }>(`update channel.provideroperation set state='queued',updated_at=clock_timestamp()
        where id=$1 and scope_id=$2 and state in('failed','unknown') returning id,kind,internal_reference`, [request.input.path.operationid!, access.scope.id]);
      const found = operation.rows[0];
      if (!found) throw new Error('PROVIDER_OPERATION_NOT_REPLAYABLE');
      const kind = found.kind === 'refund' ? 'paymentrefund' : 'fulfillment';
      await database.query(`insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
        values($1,$2,'channel',$3,case when $2='paymentrefund' then jsonb_build_object('refund',$4) else jsonb_build_object('operation',$5) end,
        'queued',20,clock_timestamp(),clock_timestamp(),clock_timestamp())`,
      [`job:${randomUUID()}`, kind, access.scope.id, found.internal_reference, found.id]);
      return { status: 202, body: { operation: found.id, state: 'queued' } };
    },
  }, OperationCatalog.all().filter((operation) => operation.module === 'channel' && operation.id !== 'channel.webhooks.receive').map(({ id }) => id));
  const webhook = channelWebhook(context, pool, kms, audit);
  return { invoke: (request) => request.type === 'channel.webhooks.receive' ? webhook.execute(request) : standard.invoke(request) };
}

function object(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('JSON_OBJECT_REQUIRED');
  return value as Record<string, unknown>;
}

function optional(body: Readonly<Record<string, unknown>>, field: string): string | null {
  const value = body[field];
  if (value === undefined || value === null || value === '') return null;
  return text(value, `VALIDATION_FAILED:${field}`);
}

function maybe(value: unknown): string | null { return value === undefined ? null : text(value, 'VALIDATION_FAILED'); }
function text(value: unknown, code: string): string { if (typeof value !== 'string' || !value.trim()) throw new Error(code); return value.trim(); }
function state(body: Readonly<Record<string, unknown>>, allowed: readonly string[]): string {
  const value = textField(body, 'state' in body ? 'state' : 'kind', 64);
  if (!allowed.includes(value)) throw new Error('STATE_INVALID');
  return value;
}
