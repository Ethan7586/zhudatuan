import { randomUUID } from 'node:crypto';
import type { OperationActions } from '../../../../foundation/application/ModuleOperations';
import { operationLifecycle, requireAccess, rowResult } from '../../../../foundation/application/ModuleOperations';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { ObjectStore } from '../../../../foundation/infrastructure/ObjectStore';
import type { EncryptedMessage, MessageVisibility, SupportPortFactory } from '../../01_public_gongkai/SupportPort';

const MAX_INLINE_ATTACHMENT_BYTES = 1024 * 1024;

export function sendMessageOperations(kms: KmsClient, ports: SupportPortFactory, objects?: ObjectStore): OperationActions {
  return {
    'support.messages.send': operationLifecycle({
      prepare: async (request) => {
        const access = requireAccess(request); const ticket = request.input.path.caseid!; const body = bodyRecord(request);
        if (request.input.expectedVersion === undefined) throw new Error('EXPECTED_VERSION_REQUIRED');
        const visibility = choice(body.visibility ?? 'public', ['public','internal'], 'SUPPORT_MESSAGE_VISIBILITY_INVALID') as MessageVisibility;
        if (visibility === 'internal' && access.actor.target === 'storefront') throw new Error('SUPPORT_INTERNAL_NOTE_FORBIDDEN');
        return { access, ticket, expectedVersion: request.input.expectedVersion,
          visibility, message: await encrypt(kms, textField(body, 'message', 4000)) };
      },
      execute: async (_request, database, { access, ticket, expectedVersion, visibility, message }) => {
        const repository = ports(database); const member = await repository.member(access.membership.id);
        const selected = await database.query<{ conversation_id: string; scope_id: string }>(`select ticket.conversation_id,ticket.scope_id
          from support.ticket ticket join support.conversation conversation on conversation.id=ticket.conversation_id where ticket.id=$1
          and ticket.state<>'closed' and (($5::text='storefront' and conversation.member_id=$3) or ($5::text='console' and
          exists(select 1 from organization.unitclosure where ancestor_id=$2 and descendant_id=ticket.scope_id)))
          and ticket.version=$4 for update of ticket`, [ticket, access.scope.id, member, expectedVersion, access.actor.target]);
        const target = selected.rows[0]; if (!target) throw new Error('VERSION_CONFLICT');
        const author = access.actor.target === 'storefront' ? 'member' : 'agent';
        const result = await repository.message(ticket, target.conversation_id, target.scope_id, author, access.actor.id, visibility, message);
        await database.query(`update support.ticket set state=case when $2::text='internal' then state
          when $3::text='member' then 'open' else 'waiting' end,updated_at=clock_timestamp(),version=version+1 where id=$1`,
        [ticket, visibility, author]);
        await database.query('update support.conversation set updated_at=clock_timestamp(),version=version+1 where id=$1', [target.conversation_id]);
        await repository.history(ticket, target.scope_id, visibility === 'internal' ? 'internal.note' : 'message', access.actor.id,
          { message: result.rows[0]!.id, visibility });
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
      if (!objects) throw new Error('SUPPORT_ATTACHMENT_STORE_UNAVAILABLE');
      const id = `evidence:${randomUUID()}`;
      const name = attachmentName(body.name);
      const kind = choice(body.contentType, ['image/jpeg','image/png','application/pdf','text/plain']);
      const visibility = choice(body.visibility ?? 'public', ['public','internal'], 'SUPPORT_ATTACHMENT_VISIBILITY_INVALID') as MessageVisibility;
      if (visibility === 'internal' && access.actor.target === 'storefront') throw new Error('SUPPORT_INTERNAL_ATTACHMENT_FORBIDDEN');
      const stored = await storeAttachment(objects, id, kind, body.contentBase64);
      const result = await database.query(`insert into support.evidence(id,scope_id,conversation_id,object_ref,sha256,kind,size_bytes,state,file_name,
        visibility,created_at) values($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,clock_timestamp()) returning *`,
      [id, target.scope_id, target.conversation_id, stored.reference, stored.sha256, kind, stored.size, name, visibility]);
      await ports(database).enqueue('supportscan', target.scope_id, { evidence: id }, undefined, `job:scan:${id}`);
      await ports(database).history(ticket, target.scope_id, 'attachment.uploaded', access.actor.id,
        { evidence: id, name, contentType: kind, size: stored.size, visibility });
      return rowResult(result, 202);
    },
  };
}

async function storeAttachment(objects: ObjectStore, id: string, contentType: string, encoded: unknown) {
  if (typeof encoded !== 'string' || encoded.length === 0 || encoded.length > Math.ceil(MAX_INLINE_ATTACHMENT_BYTES * 4 / 3) + 4
    || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 !== 0) throw new Error('SUPPORT_ATTACHMENT_CONTENT_INVALID');
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_INLINE_ATTACHMENT_BYTES
    || bytes.toString('base64') !== encoded || !attachmentSignatureValid(bytes, contentType)) {
    throw new Error('SUPPORT_ATTACHMENT_CONTENT_INVALID');
  }
  const extension = contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/png' ? 'png'
    : contentType === 'application/pdf' ? 'pdf' : 'txt';
  const upload = await objects.create(`support/evidence/${id.slice('evidence:'.length)}.${extension}`, contentType);
  try {
    await upload.append(bytes);
    return await upload.complete();
  } catch (error) {
    await upload.abort().catch(() => undefined);
    throw error;
  }
}

function attachmentSignatureValid(bytes: Uint8Array, contentType: string): boolean {
  if (contentType === 'image/png') return bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((value, index) => bytes[index] === value);
  if (contentType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === 'application/pdf') return bytes.length >= 5 && Buffer.from(bytes.subarray(0, 5)).toString('ascii') === '%PDF-';
  try { return !new TextDecoder('utf-8', { fatal: true }).decode(bytes).includes('\u0000'); } catch { return false; }
}

function attachmentName(value: unknown): string {
  if (typeof value !== 'string') throw new Error('SUPPORT_ATTACHMENT_NAME_INVALID');
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > 160 || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new Error('SUPPORT_ATTACHMENT_NAME_INVALID');
  }
  return normalized;
}

async function encrypt(kms: KmsClient, body: string): Promise<EncryptedMessage> {
  const id = `message:${randomUUID()}`; return { id, ...await kms.encrypt('support/message', body, { message: id }) };
}
function choice(value: unknown, allowed: readonly string[], error = 'SUPPORT_ATTACHMENT_TYPE_INVALID'): string {
  if (typeof value !== 'string' || !allowed.includes(value)) throw new Error(error); return value;
}
