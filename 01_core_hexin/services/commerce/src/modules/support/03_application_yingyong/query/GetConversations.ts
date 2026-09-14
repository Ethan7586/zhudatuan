import type { QueryResultRow } from 'pg';
import type { OperationActions } from '../../../../foundation/application/ModuleOperations';
import { operationLifecycle, requireAccess } from '../../../../foundation/application/ModuleOperations';
import { encodeCursor, keysetResult, queryPage } from '../../../../foundation/interface/Validation';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { SupportPortFactory } from '../../01_public_gongkai/SupportPort';

interface MessageRow extends QueryResultRow {
  readonly id: string; readonly author_type: string; readonly author_id: string | null; readonly body_ciphertext: string;
  readonly conversation_id: string; readonly visibility: 'public' | 'internal'; readonly created_at: string;
}

export function getConversationsOperations(kms: KmsClient, ports: SupportPortFactory): OperationActions {
  return {
    'support.cases.read': async (request, database) => {
      const access = requireAccess(request); const member = await ports(database).member(access.membership.id); const page = queryPage(request);
      const view = caseView(request.input.query.view);
      const result = await database.query(`select ticket.id,ticket.conversation_id,ticket.scope_id,ticket.priority,ticket.skill,ticket.state,
        ticket.assigned_agent_id,ticket.response_due_at,ticket.resolution_due_at,ticket.created_at,ticket.updated_at,ticket.version,
        conversation.member_id,conversation.order_id,conversation.channel,conversation.subject,conversation.reference_type,
        conversation.reference_id from support.ticket ticket join support.conversation conversation on conversation.id=ticket.conversation_id
        left join support.agent assigned on assigned.id=ticket.assigned_agent_id where exists(select 1 from organization.unitclosure
        where ancestor_id=$1 and descendant_id=ticket.scope_id) and ($4::text='all' or ($4::text='created' and conversation.member_id=$2)
        or ($4::text='handling' and ticket.state in('open','assigned','waiting')
        and (ticket.assigned_agent_id is null or assigned.membership_id=$3)))
        and ($5::timestamptz is null or (ticket.updated_at,ticket.id)<($5::timestamptz,$6))
        order by ticket.updated_at desc,ticket.id desc limit $7`,
      [access.scope.id, member, access.membership.id, view, page.sort, page.id, page.fetch]);
      const counts = await database.query<{ handling: number; created: number; all: number }>(`select
        count(*) filter(where ticket.state in('open','assigned','waiting') and
          (ticket.assigned_agent_id is null or assigned.membership_id=$2))::integer handling,
        count(*) filter(where conversation.member_id=$3)::integer created,count(*)::integer all
        from support.ticket ticket join support.conversation conversation on conversation.id=ticket.conversation_id
        left join support.agent assigned on assigned.id=ticket.assigned_agent_id where exists(select 1 from organization.unitclosure
          where ancestor_id=$1 and descendant_id=ticket.scope_id)`, [access.scope.id, access.membership.id, member]);
      const pageResult = keysetResult(result, page, 'updated_at');
      return { ...pageResult, body: { ...(pageResult.body as Readonly<Record<string, unknown>>),
        views: counts.rows[0] ?? { handling: 0, created: 0, all: 0 } } };
    },
    'support.messages.read': operationLifecycle({
      execute: async (request, database) => {
        const access = requireAccess(request); const member = await ports(database).member(access.membership.id); const page = queryPage(request, 200);
        const result = await database.query<MessageRow>(`select message.id,message.author_type,message.author_id,message.visibility,message.body_ciphertext,
          message.conversation_id,message.created_at from support.message message join support.ticket ticket
          on ticket.conversation_id=message.conversation_id join support.conversation conversation on conversation.id=ticket.conversation_id
          where ticket.id=$1 and (($7::text='storefront' and conversation.member_id=$3) or ($7::text='console' and
          exists(select 1 from organization.unitclosure where ancestor_id=$2 and descendant_id=ticket.scope_id)))
          and (message.visibility='public' or $7::text='console')
          and ($4::timestamptz is null or (message.created_at,message.id)<($4::timestamptz,$5))
          order by message.created_at desc,message.id desc limit $6`, [request.input.path.caseid!, access.scope.id, member, page.sort, page.id,
          page.fetch, access.actor.target === 'storefront' ? 'storefront' : 'console']);
        const attachments = await database.query(`select evidence.id,evidence.object_ref,evidence.sha256,evidence.kind,evidence.size_bytes,
          evidence.created_at from support.evidence evidence join support.ticket ticket on ticket.conversation_id=evidence.conversation_id
          join support.conversation conversation on conversation.id=ticket.conversation_id where ticket.id=$1 and evidence.state='clean'
          and (($4::text='storefront' and conversation.member_id=$3) or ($4::text='console' and exists(select 1
          from organization.unitclosure where ancestor_id=$2 and descendant_id=ticket.scope_id)))
          order by evidence.created_at,evidence.id`, [request.input.path.caseid!, access.scope.id, member,
          access.actor.target === 'storefront' ? 'storefront' : 'console']);
        const more = result.rows.length > page.limit;
        const descending = more ? result.rows.slice(0, page.limit) : result.rows;
        const oldest = descending.at(-1);
        return { status: 200, body: { items: [...descending].reverse(), count: descending.length,
          ...(more && oldest ? { nextCursor: encodeCursor({ sort: timestamp(oldest.created_at), id: oldest.id }) } : {}),
          attachments: attachments.rows } };
      },
      finalize: async (_request, result) => {
        const body = result.body as { readonly items: readonly MessageRow[]; readonly attachments: readonly unknown[];
          readonly count: number; readonly nextCursor?: string };
        const items = await Promise.all(body.items.map(async (message) => ({ id: message.id, authorType: message.author_type,
          visibility: message.visibility,
          author: message.author_id, body: await kms.decrypt('support/message', message.body_ciphertext,
            { message: message.id }), createdAt: message.created_at })));
        return { ...result, body: { items, attachments: body.attachments, count: body.count,
          ...(body.nextCursor === undefined ? {} : { nextCursor: body.nextCursor }) } };
      },
    }),
  };
}

function caseView(raw: unknown): 'handling' | 'created' | 'all' {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined) return 'handling';
  if (value !== 'handling' && value !== 'created' && value !== 'all') throw new Error('SUPPORT_CASE_VIEW_INVALID');
  return value;
}

function timestamp(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}
