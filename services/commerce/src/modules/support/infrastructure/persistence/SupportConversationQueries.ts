import { supportLifecycle, type SupportPersistence } from './SupportAction';
import type { QueryResultRow } from 'pg';

import { requireAccess } from '../../../../foundation/application/OperationAccess';
import { keysetResult, queryPage } from '../../../../foundation/interface/Validation';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { SupportPersistenceFactory } from './SupportPersistencePort';
import { mapParallel } from '../../../../foundation/performance/Parallel';
import { supportBoundary } from '../../application/service/SupportBoundary';

interface MessageRow extends QueryResultRow {
  readonly id: string;
  readonly author_type: string;
  readonly author_id: string | null;
  readonly body_ciphertext: string;
  readonly conversation_id: string;
  readonly created_at: string;
}

export function supportConversationPersistence(kms: KmsClient, ports: SupportPersistenceFactory): Pick<SupportPersistence, 'readCases' | 'readMessages'> {
  return {
    readCases: async (request, database) => {
      const access = requireAccess(request);
      const member = await ports(database).member(access.membership.id);
      const scopes = await ports(database).descendants(supportBoundary(access));
      const page = queryPage(request.input);
      const result = await database.query(
        `select ticket.id,ticket.conversation_id,ticket.scope_id,ticket.priority,ticket.skill,ticket.state,
        ticket.assigned_agent_id,ticket.response_due_at,ticket.resolution_due_at,ticket.created_at,ticket.updated_at,ticket.version,
        conversation.member_id,conversation.order_id,conversation.channel,conversation.subject,conversation.reference_type,
        conversation.reference_id from support.ticket ticket join support.conversation conversation on conversation.id=ticket.conversation_id
        where ticket.scope_id=any($1::text[])
        and (not $6::boolean or conversation.member_id=$2)
        and ($3::timestamptz is null or (ticket.updated_at,ticket.id)<($3::timestamptz,$4))
        order by ticket.updated_at desc,ticket.id desc limit $5`,
        [scopes, member, page.sort, page.id, page.fetch, access.actor.target === 'storefront']
      );
      return keysetResult(result, page, 'updated_at');
    },
    readMessages: supportLifecycle({
      execute: async (request, database) => {
        const access = requireAccess(request);
        const member = await ports(database).member(access.membership.id);
        const scopes = await ports(database).descendants(supportBoundary(access));
        const page = queryPage(request.input, 200);
        const result = await database.query<MessageRow>(
          `select message.id,message.author_type,message.author_id,message.body_ciphertext,
          message.conversation_id,message.created_at from support.message message join support.ticket ticket
          on ticket.conversation_id=message.conversation_id join support.conversation conversation on conversation.id=ticket.conversation_id
          where ticket.id=$1 and ticket.scope_id=any($2::text[]) and (not $7::boolean or conversation.member_id=$3)
          and ($4::timestamptz is null or (message.created_at,message.id)>($4::timestamptz,$5))
          order by message.created_at,message.id limit $6`,
          [request.input.path.caseid!, scopes, member, page.sort, page.id, page.fetch, access.actor.target === 'storefront']
        );
        const attachments = await database.query(
          `select evidence.id,evidence.object_ref,evidence.sha256,evidence.kind,evidence.size_bytes,
          evidence.created_at from support.evidence evidence join support.ticket ticket on ticket.conversation_id=evidence.conversation_id
          join support.conversation conversation on conversation.id=ticket.conversation_id where ticket.id=$1 and evidence.state='clean'
          and ticket.scope_id=any($2::text[])
          and (not $4::boolean or conversation.member_id=$3) order by evidence.created_at,evidence.id`,
          [request.input.path.caseid!, scopes, member, access.actor.target === 'storefront']
        );
        const paged = keysetResult(result, page, 'created_at');
        return { ...paged, body: { ...(paged.body as object), attachments: attachments.rows } };
      },
      finalize: async (_request, result) => {
        const body = result.body as { readonly items: readonly MessageRow[]; readonly attachments: readonly unknown[]; readonly count: number; readonly nextCursor?: string };
        const items = await mapParallel(body.items, 16, async (message) => ({
          id: message.id,
          authorType: message.author_type,
          author: message.author_id,
          body: await kms.decrypt('pii', 'support/message', message.body_ciphertext, { message: message.id }),
          createdAt: message.created_at,
        }));
        return { ...result, body: { items, attachments: body.attachments, count: body.count, ...(body.nextCursor === undefined ? {} : { nextCursor: body.nextCursor }) } };
      },
    }),
  };
}
