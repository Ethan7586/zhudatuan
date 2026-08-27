import type { QueryResultRow } from 'pg';
import type { OperationActions } from '../../../../foundation/application/ModuleOperations';
import { operationLifecycle, requireAccess } from '../../../../foundation/application/ModuleOperations';
<<<<<<< HEAD
import { encodeCursor, keysetResult, queryPage } from '../../../../foundation/interface/Validation';
=======
import { keysetResult, queryPage } from '../../../../foundation/interface/Validation';
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { SupportPortFactory } from '../port/SupportPort';

interface MessageRow extends QueryResultRow {
  readonly id: string; readonly author_type: string; readonly author_id: string | null; readonly body_ciphertext: string;
  readonly conversation_id: string; readonly created_at: string;
}

export function getConversationsOperations(kms: KmsClient, ports: SupportPortFactory): OperationActions {
  return {
    'support.cases.read': async (request, database) => {
      const access = requireAccess(request); const member = await ports(database).member(access.membership.id); const page = queryPage(request);
      const result = await database.query(`select ticket.id,ticket.conversation_id,ticket.scope_id,ticket.priority,ticket.skill,ticket.state,
        ticket.assigned_agent_id,ticket.response_due_at,ticket.resolution_due_at,ticket.created_at,ticket.updated_at,ticket.version,
        conversation.member_id,conversation.order_id,conversation.channel,conversation.subject,conversation.reference_type,
        conversation.reference_id from support.ticket ticket join support.conversation conversation on conversation.id=ticket.conversation_id
        where (conversation.member_id=$2 or exists(select 1 from organization.unitclosure where ancestor_id=$1 and descendant_id=ticket.scope_id))
        and ($3::timestamptz is null or (ticket.updated_at,ticket.id)<($3::timestamptz,$4))
        order by ticket.updated_at desc,ticket.id desc limit $5`, [access.scope.id, member, page.sort, page.id, page.fetch]);
      return keysetResult(result, page, 'updated_at');
    },
    'support.messages.read': operationLifecycle({
      execute: async (request, database) => {
        const access = requireAccess(request); const member = await ports(database).member(access.membership.id); const page = queryPage(request, 200);
        const result = await database.query<MessageRow>(`select message.id,message.author_type,message.author_id,message.body_ciphertext,
          message.conversation_id,message.created_at from support.message message join support.ticket ticket
          on ticket.conversation_id=message.conversation_id join support.conversation conversation on conversation.id=ticket.conversation_id
          where ticket.id=$1 and (conversation.member_id=$3 or exists(select 1 from organization.unitclosure where ancestor_id=$2
<<<<<<< HEAD
          and descendant_id=ticket.scope_id)) and ($4::timestamptz is null or (message.created_at,message.id)<($4::timestamptz,$5))
          order by message.created_at desc,message.id desc limit $6`, [request.input.path.caseid!, access.scope.id, member, page.sort, page.id, page.fetch]);
        const attachments = await database.query(`select evidence.id,evidence.object_ref,evidence.sha256,evidence.kind,evidence.size_bytes,
          evidence.created_at from support.evidence evidence join support.ticket ticket on ticket.conversation_id=evidence.conversation_id
          where ticket.id=$1 and evidence.state='clean' order by evidence.created_at,evidence.id`, [request.input.path.caseid!]);
        const more = result.rows.length > page.limit;
        const descending = more ? result.rows.slice(0, page.limit) : result.rows;
        const oldest = descending.at(-1);
        return { status: 200, body: { items: [...descending].reverse(), count: descending.length,
          ...(more && oldest ? { nextCursor: encodeCursor({ sort: timestamp(oldest.created_at), id: oldest.id }) } : {}),
          attachments: attachments.rows } };
=======
          and descendant_id=ticket.scope_id)) and ($4::timestamptz is null or (message.created_at,message.id)>($4::timestamptz,$5))
          order by message.created_at,message.id limit $6`, [request.input.path.caseid!, access.scope.id, member, page.sort, page.id, page.fetch]);
        const attachments = await database.query(`select evidence.id,evidence.object_ref,evidence.sha256,evidence.kind,evidence.size_bytes,
          evidence.created_at from support.evidence evidence join support.ticket ticket on ticket.conversation_id=evidence.conversation_id
          where ticket.id=$1 and evidence.state='clean' order by evidence.created_at,evidence.id`, [request.input.path.caseid!]);
        const paged = keysetResult(result, page, 'created_at');
        return { ...paged, body: { ...(paged.body as object), attachments: attachments.rows } };
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
      },
      finalize: async (_request, result) => {
        const body = result.body as { readonly items: readonly MessageRow[]; readonly attachments: readonly unknown[];
          readonly count: number; readonly nextCursor?: string };
        const items = await Promise.all(body.items.map(async (message) => ({ id: message.id, authorType: message.author_type,
          author: message.author_id, body: await kms.decrypt('support/message', message.body_ciphertext,
            { message: message.id }), createdAt: message.created_at })));
        return { ...result, body: { items, attachments: body.attachments, count: body.count,
          ...(body.nextCursor === undefined ? {} : { nextCursor: body.nextCursor }) } };
      },
    }),
  };
}
<<<<<<< HEAD

function timestamp(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
