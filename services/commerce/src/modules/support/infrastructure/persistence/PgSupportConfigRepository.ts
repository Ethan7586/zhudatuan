import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ExecutionContext } from '../../../../foundation/application/HandlerContext';
import type { OperationReply } from '../../../../foundation/application/OperationHandler';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { bodyRecord, integerField, keysetPage, queryPage, textField } from '../../../../foundation/interface/Validation';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { AssignmentRule } from '../../domain/model/AssignmentRule';
import { Sla } from '../../domain/model/Sla';
import type { TicketPriority } from '../../domain/model/Ticket';
import type { AccountRepository, PreparedSupportOperation, RuleRepository, SlaRepository } from '../../application/port/SupportRepositories';
import type { SupportAccountProvider, SupportAccountVerification, SupportAccountVerifier } from '../../application/port/SupportAccountVerifier';
import type { ReadSupportContext } from '../../application/service/ReadSupportContext';

interface LoadedAccount { readonly scope: string; readonly current: Pick<AccountRow, 'secret_ref' | 'channel'> | null }
type PreparedAccount = SupportAccountVerification;

export class PgSupportConfigRepository implements AccountRepository, RuleRepository, SlaRepository {
  private readonly transactions = new PgTransactionAccess();
  constructor(private readonly support: ReadSupportContext, private readonly verifier: SupportAccountVerifier) {}

  async loadAccount(context: ReadTransactionContext, input: OperationInputFor<'support.accounts.manage'>, execution: ExecutionContext<'support.accounts.manage'>): Promise<PreparedSupportOperation> {
    const actor = await this.console(context, execution);
    const result = await this.transactions.database(context).query<Pick<AccountRow, 'secret_ref' | 'channel'>>(
      'select secret_ref,channel from support.account where id=$1 and scope_id=$2',
      [input.path.accountid, actor.scope]
    );
    return Object.freeze({ scope: actor.scope, current: result.rows[0] ?? null });
  }

  async prepareAccount(input: OperationInputFor<'support.accounts.manage'>, execution: ExecutionContext<'support.accounts.manage'>, value: PreparedSupportOperation): Promise<PreparedSupportOperation> {
    const body = bodyRecord(input);
    const loaded = value as LoadedAccount;
    const provider = choice(body.provider, channels, 'SUPPORT_CHANNEL_INVALID') as SupportAccountProvider;
    const supplied = body.secretRef;
    const secretRef = provider === 'inapp' ? (supplied === undefined ? null : supplied === null ? null : textField(body, 'secretRef')) : supplied === undefined ? loaded.current?.secret_ref ?? null : supplied === null ? null : textField(body, 'secretRef');
    return this.verifier.verify({ provider, scope: loaded.scope, secretRef }, execution);
  }

  async readAccounts(context: ReadTransactionContext, input: OperationInputFor<'support.accounts.read'>, execution: ExecutionContext<'support.accounts.read'>): Promise<OperationReply<OperationOutputFor<'support.accounts.read'>>> {
    const actor = await this.console(context, execution);
    const page = queryPage(input);
    const result = await this.transactions.database(context).query<AccountReadRow>(
      `select id,channel,external_ref,state,validation_state,validation_code,validated_at,version
      from support.account where scope_id=$1 and ($2::text is null or id>$2) order by id limit $3`,
      [actor.scope, page.id, page.fetch]
    );
    const paged = keysetPage(result.rows.map(accountRead), page, 'id');
    return { status: 200, body: { ...paged, items: [...paged.items] } };
  }

  async manageAccount(context: WriteTransactionContext, input: OperationInputFor<'support.accounts.manage'>, execution: ExecutionContext<'support.accounts.manage'>, value: PreparedSupportOperation): Promise<OperationReply<OperationOutputFor<'support.accounts.manage'>>> {
    const actor = await this.console(context, execution);
    const expected = expectedVersion(execution);
    const body = bodyRecord(input);
    const prepared = value as PreparedAccount;
    const channel = choice(body.provider, channels, 'SUPPORT_CHANNEL_INVALID') as AccountRow['channel'];
    const external = textField(body, 'displayName');
    const state = choice(body.state ?? 'active', enabledStates, 'SUPPORT_ACCOUNT_STATE_INVALID') as AccountRow['state'];
    const result = await this.transactions.database(context).query<AccountRow>(
      `insert into support.account(id,scope_id,channel,external_ref,secret_ref,state,validation_state,validation_code,validated_at,secret_version,version)
      select $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,1 where $11=0
      on conflict(id) do update set channel=excluded.channel,external_ref=excluded.external_ref,secret_ref=excluded.secret_ref,
      state=excluded.state,validation_state=excluded.validation_state,validation_code=excluded.validation_code,
      validated_at=excluded.validated_at,secret_version=excluded.secret_version,version=support.account.version+1
      where support.account.scope_id=$2 and support.account.version=$11
      returning id,scope_id,channel,external_ref,secret_ref,state,validation_state,validation_code,validated_at,secret_version,version`,
      [input.path.accountid, actor.scope, channel, external, prepared.secretRef, state, prepared.state, prepared.code, prepared.checkedAt, prepared.secretVersion, expected]
    );
    const row = result.rows[0];
    if (!row) throw new DomainError('VERSION_CONFLICT');
    return { status: 200, headers: { etag: `"${row.version}"` }, body: account(row) };
  }

  async readRules(context: ReadTransactionContext, input: OperationInputFor<'support.rules.read'>, execution: ExecutionContext<'support.rules.read'>): Promise<OperationReply<OperationOutputFor<'support.rules.read'>>> {
    const actor = await this.console(context, execution);
    const page = queryPage(input);
    const result = await this.transactions.database(context).query<RuleReadRow>(
      `select id,name,skill,priorities,weight,state,version,updated_at from support.assignmentrule
      where scope_id=$1 and ($2::text is null or id>$2) order by id limit $3`, [actor.scope, page.id, page.fetch]
    );
    const paged = keysetPage(result.rows.map(ruleRead), page, 'id');
    return { status: 200, body: { ...paged, items: [...paged.items] } };
  }

  async manageRule(context: WriteTransactionContext, input: OperationInputFor<'support.rules.manage'>, execution: ExecutionContext<'support.rules.manage'>): Promise<OperationReply<OperationOutputFor<'support.rules.manage'>>> {
    const actor = await this.console(context, execution);
    const expected = expectedVersion(execution);
    const body = bodyRecord(input);
    const priorities = stringArray(body.priorities) as TicketPriority[];
    const state = choice(body.state, enabledStates, 'SUPPORT_RULE_STATE_INVALID') as RuleRow['state'];
    const weight = integerField(body, 'weight', 1);
    if (weight > 1000) throw new DomainError('VALIDATION_FAILED', { field: 'weight' });
    const skill = textField(body, 'skill', 64);
    new AssignmentRule(input.path.ruleid, actor.scope, skill, priorities, weight, state === 'active');
    const result = await this.transactions.database(context).query<RuleRow>(
      `insert into support.assignmentrule(id,scope_id,name,skill,priorities,weight,state,version,created_at,updated_at)
      select $1,$2,$3,$4,$5,$6,$7,1,clock_timestamp(),clock_timestamp() where $8=0
      on conflict(id) do update set name=excluded.name,skill=excluded.skill,priorities=excluded.priorities,weight=excluded.weight,
      state=excluded.state,version=support.assignmentrule.version+1,updated_at=clock_timestamp()
      where support.assignmentrule.scope_id=$2 and support.assignmentrule.version=$8 returning *`,
      [input.path.ruleid, actor.scope, textField(body, 'name'), skill, priorities, weight, state, expected]
    );
    const row = result.rows[0];
    if (!row) throw new DomainError('VERSION_CONFLICT');
    return { status: 200, headers: { etag: `"${row.version}"` }, body: rule(row) };
  }

  async readSlas(context: ReadTransactionContext, input: OperationInputFor<'support.slas.read'>, execution: ExecutionContext<'support.slas.read'>): Promise<OperationReply<OperationOutputFor<'support.slas.read'>>> {
    const actor = await this.console(context, execution);
    const page = queryPage(input);
    const result = await this.transactions.database(context).query<SlaRow>(
      `select id,scope_id,priority,response_seconds,resolution_seconds,version from support.sla
      where scope_id=$1 and ($2::text is null or id>$2) order by id limit $3`, [actor.scope, page.id, page.fetch]
    );
    const paged = keysetPage(result.rows.map(slaRead), page, 'id');
    return { status: 200, body: { ...paged, items: [...paged.items] } };
  }

  async manageSla(context: WriteTransactionContext, input: OperationInputFor<'support.slas.manage'>, execution: ExecutionContext<'support.slas.manage'>): Promise<OperationReply<OperationOutputFor<'support.slas.manage'>>> {
    const actor = await this.console(context, execution);
    const expected = expectedVersion(execution);
    const body = bodyRecord(input);
    const priority = choice(body.priority, priorities, 'SUPPORT_PRIORITY_INVALID') as TicketPriority;
    const response = integerField(body, 'responseSeconds', 1);
    const resolution = integerField(body, 'resolutionSeconds', response);
    new Sla(input.path.slaid, actor.scope, priority, response, resolution, expected);
    const result = await this.transactions.database(context).query<SlaRow>(
      `insert into support.sla(id,scope_id,priority,response_seconds,resolution_seconds,version)
      select $1,$2,$3,$4,$5,1 where $6=0
      on conflict(id) do update set priority=excluded.priority,response_seconds=excluded.response_seconds,
      resolution_seconds=excluded.resolution_seconds,version=support.sla.version+1
      where support.sla.scope_id=$2 and support.sla.version=$6 returning *`,
      [input.path.slaid, actor.scope, priority, response, resolution, expected]
    );
    const row = result.rows[0];
    if (!row) throw new DomainError('VERSION_CONFLICT');
    return { status: 200, headers: { etag: `"${row.version}"` }, body: sla(row) };
  }

  async resolveSla(context: ReadTransactionContext, scope: string, priority: TicketPriority): Promise<Readonly<{ response: number; resolution: number }>> {
    const result = await this.transactions.database(context).query<{ response_seconds: number; resolution_seconds: number }>('select response_seconds,resolution_seconds from support.resolve_sla($1,$2)', [scope, priority]);
    const row = result.rows[0];
    if (!row) throw new Error('SUPPORT_SLA_NOT_CONFIGURED');
    return Object.freeze({ response: Number(row.response_seconds), resolution: Number(row.resolution_seconds) });
  }

  async assignmentRules(context: ReadTransactionContext, scope: string): Promise<readonly AssignmentRule[]> {
    const result = await this.transactions.database(context).query<RuleRow>(
      `select id,scope_id,name,skill,priorities,weight,state,version,created_at,updated_at
      from support.assignmentrule where scope_id=$1 and state='active' order by weight desc,id`, [scope]
    );
    return Object.freeze(result.rows.map((row) => new AssignmentRule(row.id, row.scope_id, row.skill, row.priorities, Number(row.weight), true)));
  }

  private async console(context: ReadTransactionContext, execution: ExecutionContext) {
    const actor = await this.support.actor(context, execution);
    if (actor.target !== 'console') throw new DomainError('AUTHORIZATION_DENIED');
    return actor;
  }

}

interface AccountRow { readonly id: string; readonly scope_id: string; readonly channel: SupportAccountProvider; readonly external_ref: string; readonly secret_ref: string | null; readonly state: 'active' | 'disabled'; readonly validation_state: 'verified' | 'notrequired' | 'unverified'; readonly validation_code: string; readonly validated_at: string | Date | null; readonly secret_version: string | null; readonly version: number }
type AccountReadRow = Omit<AccountRow, 'scope_id' | 'secret_ref' | 'secret_version'>;
interface RuleRow { readonly id: string; readonly scope_id: string; readonly name: string; readonly skill: string; readonly priorities: TicketPriority[]; readonly weight: number; readonly state: 'active' | 'disabled'; readonly version: number; readonly created_at: string; readonly updated_at: string }
interface RuleReadRow { readonly id: string; readonly name: string; readonly skill: string; readonly priorities: TicketPriority[]; readonly weight: number; readonly state: 'active' | 'disabled'; readonly version: number; readonly updated_at: string }
interface SlaRow { readonly id: string; readonly scope_id: string; readonly priority: TicketPriority; readonly response_seconds: number; readonly resolution_seconds: number; readonly version: number }
function rule(row: RuleRow) { return { ...row, weight: Number(row.weight), version: Number(row.version), created_at: instant(row.created_at), updated_at: instant(row.updated_at) }; }
function ruleRead(row: RuleReadRow) { return { ...row, weight: Number(row.weight), version: Number(row.version), updated_at: instant(row.updated_at) }; }
function sla(row: SlaRow) { return { ...row, response_seconds: Number(row.response_seconds), resolution_seconds: Number(row.resolution_seconds), version: Number(row.version) }; }
function slaRead(row: SlaRow) { const value = sla(row); return { id: value.id, priority: value.priority, response_seconds: value.response_seconds, resolution_seconds: value.resolution_seconds, version: value.version }; }
function account(row: AccountRow) { return { id: row.id, scope_id: row.scope_id, provider: row.channel, display_name: row.external_ref, state: row.state, validation_state: row.validation_state, validation_code: row.validation_code, validated_at: row.validated_at === null ? null : instant(row.validated_at), version: Number(row.version) }; }
function accountRead(row: AccountReadRow) { return { id: row.id, provider: row.channel, display_name: row.external_ref, state: row.state, validation_state: row.validation_state, validation_code: row.validation_code, validated_at: row.validated_at === null ? null : instant(row.validated_at), version: Number(row.version) }; }
function expectedVersion(execution: ExecutionContext): number { if (execution.expectedVersion === undefined) throw new DomainError('VERSION_CONFLICT'); return execution.expectedVersion; }
function choice(value: unknown, values: readonly string[], code: string): string { if (typeof value !== 'string' || !values.includes(value)) throw new Error(code); return value; }
function stringArray(value: unknown): string[] { if (!Array.isArray(value) || value.length === 0 || !value.every((item) => typeof item === 'string' && item.trim())) throw new DomainError('VALIDATION_FAILED'); return [...new Set(value.map((item) => item.trim()))]; }
function instant(value: string | Date): string { return new Date(value).toISOString(); }
const priorities = ['low', 'normal', 'high', 'urgent'] as const;
const channels = ['inapp', 'wechat', 'email', 'sms'] as const;
const enabledStates = ['active', 'disabled'] as const;
