import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ExecutionContext } from '../../../../foundation/application/HandlerContext';
import type { OperationReply } from '../../../../foundation/application/OperationHandler';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { bodyRecord, integerField, keysetPage, queryPage, textField } from '../../../../foundation/application/Validation';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { AgentRepository } from '../../application/port/SupportRepositories';
import type { AgentStore } from '../../application/port/SupportPersistence';
import type { ReadSupportContext } from '../../application/service/ReadSupportContext';
import type { Agent } from '../../domain/policy/AssignmentPolicy';
import type { PgSupportEventRepository } from './PgSupportEventRepository';

export class PgAgentRepository implements AgentRepository, AgentStore {
  private readonly transactions = new PgTransactionAccess();
  constructor(private readonly support?: ReadSupportContext, private readonly events?: PgSupportEventRepository) {}

  async assertSender(context: ReadTransactionContext, membership: string, scope: string): Promise<string> {
    const result = await this.transactions.database(context).query<{ id: string }>(
      `select id from support.agent where membership_id=$1 and scope_id=$2 and state in('available','busy')`,
      [membership, scope]
    );
    const id = result.rows[0]?.id;
    if (!id) throw new DomainError('SUPPORT_TICKET_NOT_WRITABLE');
    return id;
  }

  async findByMembership(context: ReadTransactionContext, membership: string, scopes: readonly string[]): Promise<string | null> {
    const result = await this.transactions.database(context).query<{ id: string }>(
      `select id from support.agent where membership_id=$1 and scope_id=any($2::text[]) and state<>'disabled' order by id limit 1`,
      [membership, scopes]
    );
    return result.rows[0]?.id ?? null;
  }

  async candidates(context: ReadTransactionContext, scope: string): Promise<readonly Agent[]> {
    const result = await this.transactions.database(context).query<AgentRow & { load: number }>(
      `select agent.id,agent.scope_id,agent.membership_id,agent.state,agent.skills,agent.capacity,agent.version,
      agent.last_assigned_at,count(ticket.id) filter(where ticket.state in('assigned','waiting'))::integer load
      from support.agent agent left join support.ticket ticket on ticket.assigned_agent_id=agent.id
      where agent.scope_id=$1 and agent.state='available' group by agent.id order by agent.id`,
      [scope]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ id: row.id, online: true, state: row.state, load: Number(row.load), capacity: Number(row.capacity), skills: Object.freeze(row.skills), scopes: Object.freeze([scope]), lastAssignedAt: row.last_assigned_at })));
  }

  async readAgents(context: ReadTransactionContext, input: OperationInputFor<'support.agents.read'>, execution: ExecutionContext<'support.agents.read'>): Promise<OperationReply<OperationOutputFor<'support.agents.read'>>> {
    const actor = await this.console(context, execution);
    const page = queryPage(input);
    const result = await this.transactions.database(context).query<AgentRow>(
      `select id,scope_id,membership_id,skills,capacity,state,version,last_assigned_at from support.agent
      where scope_id=$1 and ($2::text is null or id>$2) order by id limit $3`, [actor.scope, page.id, page.fetch]
    );
    const rows = result.rows.map((row) => ({ id: row.id, membership_id: row.membership_id, skills: row.skills, capacity: Number(row.capacity), state: row.state, version: Number(row.version) }));
    const paged = keysetPage(rows, page, 'id');
    return { status: 200, body: { ...paged, items: [...paged.items] } };
  }

  async manageAgent(context: WriteTransactionContext, input: OperationInputFor<'support.agents.manage'>, execution: ExecutionContext<'support.agents.manage'>): Promise<OperationReply<OperationOutputFor<'support.agents.manage'>>> {
    const actor = await this.console(context, execution);
    if (execution.expectedVersion === undefined) throw new DomainError('VERSION_CONFLICT');
    const body = bodyRecord(input);
    const capacity = integerField(body, 'capacity', 1);
    if (capacity > 100) throw new DomainError('VALIDATION_FAILED', { field: 'capacity' });
    const state = choice(body.state, states, 'SUPPORT_AGENT_INVALID') as AgentRow['state'];
    const skills = stringArray(body.skills);
    const membership = textField(body, 'membership');
    const result = await this.transactions.database(context).query<AgentRow>(
      `insert into support.agent(id,scope_id,membership_id,skills,capacity,state,version,created_at,updated_at,last_assigned_at)
      select $1,$2,$3,$4::jsonb,$5,$6,1,clock_timestamp(),clock_timestamp(),null where $7=0
      on conflict(id) do update set membership_id=excluded.membership_id,skills=excluded.skills,capacity=excluded.capacity,
      state=excluded.state,version=support.agent.version+1,updated_at=clock_timestamp()
      where support.agent.scope_id=$2 and support.agent.version=$7
      returning id,scope_id,membership_id,skills,capacity,state,version,last_assigned_at`,
      [input.path.agentid, actor.scope, membership, JSON.stringify(skills), capacity, state, execution.expectedVersion]
    );
    const row = result.rows[0];
    if (!row) throw new DomainError('VERSION_CONFLICT');
    if (state === 'disabled') {
      if (!this.events) throw new Error('SUPPORT_EVENT_REPOSITORY_REQUIRED');
      await this.events.enqueue(context, 'supportreassign', actor.scope, { agent: row.id, cursor: null }, undefined, `job:reassign:${row.id}:${row.version}`);
    }
    return { status: 200, headers: { etag: `"${row.version}"` }, body: { id: row.id, scope_id: row.scope_id, membership_id: row.membership_id, skills: row.skills, capacity: Number(row.capacity), state: row.state, version: Number(row.version) } };
  }

  private async console(context: ReadTransactionContext, execution: ExecutionContext) {
    if (!this.support) throw new Error('SUPPORT_CONTEXT_REQUIRED');
    const actor = await this.support.actor(context, execution);
    if (actor.target !== 'console') throw new DomainError('AUTHORIZATION_DENIED');
    return actor;
  }
}

interface AgentRow {
  readonly id: string;
  readonly scope_id: string;
  readonly membership_id: string;
  readonly skills: string[];
  readonly capacity: number;
  readonly state: 'offline' | 'available' | 'busy' | 'disabled';
  readonly version: number;
  readonly last_assigned_at: string | null;
}
function choice(value: unknown, values: readonly string[], code: string): string { if (typeof value !== 'string' || !values.includes(value)) throw new Error(code); return value; }
function stringArray(value: unknown): string[] { if (!Array.isArray(value) || value.length === 0 || !value.every((item) => typeof item === 'string' && item.trim())) throw new DomainError('VALIDATION_FAILED'); return [...new Set(value.map((item) => item.trim()))]; }
const states = ['offline', 'available', 'busy', 'disabled'] as const;
