import { createHash, randomUUID } from 'node:crypto';
import type { OperationActions } from '../../../../foundation/application/ModuleOperations';
import { operationLifecycle, requireAccess, rowResult } from '../../../../foundation/application/ModuleOperations';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { ObjectStore } from '../../../../foundation/infrastructure/ObjectStore';
import type { EncryptedMessage, SupportPortFactory } from '../port/SupportPort';
import { supportBoundary } from '../SupportBoundary';

export function sendMessageOperations(kms: KmsClient, objects: Pick<ObjectStore, 'create'>, ports: SupportPortFactory): OperationActions {
  return {
    'support.messages.send': operationLifecycle({
      prepare: async (request) => {
        const access = requireAccess(request);
        const ticket = request.input.path.caseid!;
        const body = bodyRecord(request);
        return { access, ticket, message: await encrypt(kms, textField(body, 'message', 4000)) };
      },
      execute: async (_request, database, { access, ticket, message }) => {
        const repository = ports(database);
        const member = await repository.member(access.membership.id);
        const scopes = await repository.descendants(supportBoundary(access));
        const selected = await database.query<{ conversation_id: string; scope_id: string }>(
          `select ticket.conversation_id,ticket.scope_id
          from support.ticket ticket join support.conversation conversation on conversation.id=ticket.conversation_id where ticket.id=$1
          and ticket.state<>'closed' and ticket.scope_id=any($2::text[]) and (not $4::boolean or conversation.member_id=$3)
          for update of ticket`,
          [ticket, scopes, member, access.actor.target === 'storefront']
        );
        const target = selected.rows[0];
        if (!target) throw new Error('SUPPORT_TICKET_NOT_WRITABLE');
        const author = access.actor.target === 'storefront' ? 'member' : 'agent';
        const result = await repository.message(ticket, target.conversation_id, target.scope_id, author, access.actor.id, message);
        await database.query(
          `update support.ticket set state=case when $2='member' then 'open' else 'waiting' end,
          updated_at=clock_timestamp(),version=version+1 where id=$1`,
          [ticket, author]
        );
        await database.query('update support.conversation set updated_at=clock_timestamp(),version=version+1 where id=$1', [target.conversation_id]);
        await repository.history(ticket, target.scope_id, 'message', access.actor.id, { message: result.rows[0]!.id });
        return rowResult(result, 201);
      },
    }),
    'support.attachments.create': operationLifecycle({
      prepare: async (request) => {
        const access = requireAccess(request);
        const body = bodyRecord(request);
        const name = textField(body, 'name', 255).trim();
        const contentType = choice(body.contentType, ['image/jpeg', 'image/png', 'application/pdf', 'text/plain']);
        const data = textField(body, 'data', 1_500_000);
        if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data) || data.length % 4 !== 0) throw new Error('SUPPORT_ATTACHMENT_ENCODING_INVALID');
        const bytes = new Uint8Array(Buffer.from(data, 'base64'));
        if (bytes.byteLength < 1 || bytes.byteLength > 1_000_000 || !signatureMatches(bytes, contentType)) throw new Error('SUPPORT_ATTACHMENT_CONTENT_INVALID');
        const extension = extensionFor(name, contentType);
        const upload = await objects.create(`support/${createHash('sha256').update(access.membership.id).digest('hex').slice(0, 32)}/${randomUUID()}${extension}`, contentType);
        try {
          await upload.append(bytes);
          const stored = await upload.complete();
          if (stored.size !== bytes.byteLength || stored.sha256 !== createHash('sha256').update(bytes).digest('hex')) throw new Error('SUPPORT_ATTACHMENT_INTEGRITY_INVALID');
          return { access, ticket: request.input.path.caseid!, name, contentType, stored };
        } catch (cause) {
          await upload.abort().catch(() => undefined);
          throw cause;
        }
      },
      execute: async (_request, database, prepared) => {
        const { access, ticket, contentType, stored } = prepared;
        const repository = ports(database);
        const member = await repository.member(access.membership.id);
        const scopes = await repository.descendants(supportBoundary(access));
        const selected = await database.query<{ conversation_id: string; scope_id: string }>(
          `select ticket.conversation_id,ticket.scope_id
        from support.ticket ticket join support.conversation conversation on conversation.id=ticket.conversation_id where ticket.id=$1
        and ticket.state<>'closed' and ticket.scope_id=any($2::text[]) and (not $4::boolean or conversation.member_id=$3)
        for update of ticket`,
          [ticket, scopes, member, access.actor.target === 'storefront']
        );
        const target = selected.rows[0];
        if (!target) throw new Error('SUPPORT_TICKET_NOT_WRITABLE');
        const id = `evidence:${randomUUID()}`;
        const result = await database.query(
          `insert into support.evidence(id,scope_id,conversation_id,object_ref,sha256,kind,size_bytes,state,created_at)
        values($1,$2,$3,$4,$5,$6,$7,'clean',clock_timestamp()) returning *`,
          [id, target.scope_id, target.conversation_id, stored.reference, stored.sha256, contentType, stored.size]
        );
        return rowResult(result, 201);
      },
    }),
  };
}

function extensionFor(name: string, contentType: string): string {
  const extension = name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0];
  const allowed = contentType === 'image/jpeg' ? ['.jpg', '.jpeg'] : contentType === 'image/png' ? ['.png'] : contentType === 'application/pdf' ? ['.pdf'] : ['.txt'];
  if (!extension || !allowed.includes(extension)) throw new Error('SUPPORT_ATTACHMENT_EXTENSION_INVALID');
  return extension;
}

function signatureMatches(bytes: Uint8Array, contentType: string): boolean {
  if (contentType === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
  if (contentType === 'image/png') return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  if (contentType === 'application/pdf') return new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-';
  return !bytes.includes(0) && new TextDecoder('utf-8', { fatal: true }).decode(bytes).length > 0;
}

async function encrypt(kms: KmsClient, body: string): Promise<EncryptedMessage> {
  const id = `message:${randomUUID()}`;
  return { id, ...(await kms.encrypt('pii', 'support/message', body, { message: id })) };
}
function choice(value: unknown, allowed: readonly string[]): string {
  if (typeof value !== 'string' || !allowed.includes(value)) throw new Error('SUPPORT_ATTACHMENT_TYPE_INVALID');
  return value;
}
