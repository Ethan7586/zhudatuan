import { randomUUID } from 'node:crypto';
import type { OperationActions } from '../../../../foundation/application/ModuleOperations';
import { operationLifecycle, requireAccess, rowResult } from '../../../../foundation/application/ModuleOperations';
import { bodyRecord, integerField, textField } from '../../../../foundation/interface/Validation';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { EncryptedMessage, SupportPortFactory } from '../port/SupportPort';

export function sendMessageOperations(kms: KmsClient, ports: SupportPortFactory): OperationActions {
  return {
    'support.messages.send': operationLifecycle({
      prepare: async (request) => {
        const access = requireAccess(request); const ticket = request.input.path.caseid!; const body = bodyRecord(request);
<<<<<<< HEAD
        if (request.input.expectedVersion === undefined) throw new Error('EXPECTED_VERSION_REQUIRED');
        return { access, ticket, expectedVersion: request.input.expectedVersion,
          message: await encrypt(kms, textField(body, 'message', 4000)) };
      },
      execute: async (_request, database, { access, ticket, expectedVersion, message }) => {
=======
        return { access, ticket, message: await encrypt(kms, textField(body, 'message', 4000)) };
      },
      execute: async (_request, database, { access, ticket, message }) => {
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
        const repository = ports(database); const member = await repository.member(access.membership.id);
        const selected = await database.query<{ conversation_id: string; scope_id: string }>(`select ticket.conversation_id,ticket.scope_id
          from support.ticket ticket join support.conversation conversation on conversation.id=ticket.conversation_id where ticket.id=$1
          and ticket.state<>'closed' and (conversation.member_id=$3 or exists(select 1 from organization.unitclosure
<<<<<<< HEAD
          where ancestor_id=$2 and descendant_id=ticket.scope_id)) and ticket.version=$4 for update of ticket`,
        [ticket, access.scope.id, member, expectedVersion]);
        const target = selected.rows[0]; if (!target) throw new Error('VERSION_CONFLICT');
=======
          where ancestor_id=$2 and descendant_id=ticket.scope_id)) for update of ticket`, [ticket, access.scope.id, member]);
        const target = selected.rows[0]; if (!target) throw new Error('SUPPORT_TICKET_NOT_WRITABLE');
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
        const author = access.actor.target === 'storefront' ? 'member' : 'agent';
        const result = await repository.message(ticket, target.conversation_id, target.scope_id, author, access.actor.id, message);
        await database.query(`update support.ticket set state=case when $2='member' then 'open' else 'waiting' end,
          updated_at=clock_timestamp(),version=version+1 where id=$1`, [ticket, author]);
        await database.query('update support.conversation set updated_at=clock_timestamp(),version=version+1 where id=$1', [target.conversation_id]);
        await repository.history(ticket, target.scope_id, 'message', access.actor.id, { message: result.rows[0]!.id });
        return rowResult(result, 201);
      },
    }),
    'support.attachments.create': async (request, database) => {
      const access = requireAccess(request); const body = bodyRecord(request); const ticket = request.input.path.caseid!;
      const member = await ports(database).member(access.membership.id);
      const selected = await database.query<{ conversation_id: string; scope_id: string }>(`select ticket.conversation_id,ticket.scope_id
        from support.ticket ticket join support.conversation conversation on conversation.id=ticket.conversation_id where ticket.id=$1
        and ticket.state<>'closed' and (conversation.member_id=$3 or exists(select 1 from organization.unitclosure
        where ancestor_id=$2 and descendant_id=ticket.scope_id)) for update of ticket`, [ticket, access.scope.id, member]);
      const target = selected.rows[0]; if (!target) throw new Error('SUPPORT_TICKET_NOT_WRITABLE');
      const sha256 = textField(body, 'sha256', 64); if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error('SUPPORT_ATTACHMENT_HASH_INVALID');
      const size = integerField(body, 'size', 1); if (size > 10 * 1024 * 1024) throw new Error('SUPPORT_ATTACHMENT_TOO_LARGE');
      const id = `evidence:${randomUUID()}`; const kind = choice(body.contentType, ['image/jpeg','image/png','application/pdf','text/plain']);
      const result = await database.query(`insert into support.evidence(id,scope_id,conversation_id,object_ref,sha256,kind,size_bytes,state,created_at)
        values($1,$2,$3,$4,$5,$6,$7,'pending',clock_timestamp()) returning *`, [id, target.scope_id, target.conversation_id,
        textField(body, 'reference', 2048), sha256, kind, size]);
      await ports(database).enqueue('supportscan', target.scope_id, { evidence: id }, undefined, `job:scan:${id}`);
      return rowResult(result, 202);
    },
  };
}

async function encrypt(kms: KmsClient, body: string): Promise<EncryptedMessage> {
  const id = `message:${randomUUID()}`; return { id, ...await kms.encrypt('support/message', body, { message: id }) };
}
function choice(value: unknown, allowed: readonly string[]): string {
  if (typeof value !== 'string' || !allowed.includes(value)) throw new Error('SUPPORT_ATTACHMENT_TYPE_INVALID'); return value;
}
