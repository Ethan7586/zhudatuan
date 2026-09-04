import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import { RUNTIME_LIMITS } from '@shop/config/runtime';
import { createHash, randomUUID } from 'node:crypto';
import { isConsumerTarget, type OperationInputFor, type OperationOutputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../foundation/application/HandlerContext';
import type { OperationReply } from '../../../../foundation/application/OperationHandler';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { bodyRecord, integerField, textField } from '../../../../foundation/application/Validation';
import type { ObjectStore, UploadAuthorization } from '../../../runtime/public/ObjectPort';
import { retentionUntil as objectRetentionUntil } from '@shop/kernel';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { AttachmentRepository, PreparedSupportOperation } from '../../application/port/SupportRepositories';
import type { EvidenceStore } from '../../application/port/SupportPersistence';
import type { ReadSupportContext } from '../../application/service/ReadSupportContext';
import type { PgSupportEventRepository } from './PgSupportEventRepository';
import type { PgTicketRepository } from './PgTicketRepository';

interface PreparedEvidence {
  readonly id: string;
  readonly ticket: string;
  readonly name: string;
  readonly contentType: 'image/jpeg' | 'image/png' | 'application/pdf' | 'text/plain';
  readonly size: number;
  readonly sha256: string;
  readonly upload: UploadAuthorization;
}

export class PgEvidenceRepository implements AttachmentRepository, EvidenceStore {
  private readonly transactions = new PgTransactionAccess();

  constructor(
    private readonly objects?: ObjectStore,
    private readonly support?: ReadSupportContext,
    private readonly tickets?: PgTicketRepository,
    private readonly events?: PgSupportEventRepository
  ) {}

  async prepareAttachment(input: OperationInputFor<'support.attachments.create'>, execution: ExecutionContext<'support.attachments.create'>): Promise<PreparedSupportOperation> {
    if (!this.objects) throw new Error('SUPPORT_OBJECT_STORE_REQUIRED');
    const access = requireSession(execution.security);
    const body = bodyRecord(input);
    const name = sanitizeName(textField(body, 'name', 255));
    const contentType = textField(body, 'contentType') as PreparedEvidence['contentType'];
    const size = integerField(body, 'sizeBytes', 1);
    if (!Number.isSafeInteger(size) || size < 1 || size > 10 * 1024 * 1024) throw new DomainError('VALIDATION_FAILED', { field: 'sizeBytes' });
    const sha256 = textField(body, 'sha256', 64).toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(sha256)) throw new DomainError('VALIDATION_FAILED', { field: 'sha256' });
    assertExtension(name, contentType);
    const id = `evidence:${randomUUID()}`;
    const path = `support/${createHash('sha256').update(access.membership.id).digest('hex').slice(0, 32)}/${randomUUID()}`;
    const upload = await this.objects.authorizeUpload({ path, contentType, size, sha256,
      expiresIn: RUNTIME_LIMITS.upload.authorizationSeconds, retentionUntil: objectRetentionUntil(RUNTIME_LIMITS.upload.retentionDays.support) });
    return Object.freeze({ id, ticket: input.path.caseid, name, contentType, size, sha256, upload });
  }

  async createAttachment(
    context: WriteTransactionContext,
    _input: OperationInputFor<'support.attachments.create'>,
    execution: ExecutionContext<'support.attachments.create'>,
    value: PreparedSupportOperation
  ): Promise<OperationReply<OperationOutputFor<'support.attachments.create'>>> {
    if (!this.support || !this.tickets || !this.events) throw new Error('SUPPORT_EVIDENCE_DEPENDENCIES_REQUIRED');
    const prepared = value as PreparedEvidence;
    const actor = await this.support.actor(context, execution);
    const ticket = await this.tickets.lockMessageTarget(context, prepared.ticket, actor.scopes, actor.member, isConsumerTarget(actor.target));
    if (ticket.ticket.state === 'closed') throw new DomainError('SUPPORT_TICKET_NOT_WRITABLE');
    const result = await this.transactions.database(context).query<{ id: string; state: 'pending' }>(
      `insert into support.evidence(id,scope_id,conversation_id,object_ref,sha256,kind,size_bytes,state,original_name,
      content_type,upload_expires_at,version,created_at)
      values($1,$2,$3,$4,$5,$6,$7,'pending',$8,$6,$9,1,clock_timestamp()) returning id,state`,
      [prepared.id, ticket.ticket.scope, ticket.conversation, prepared.upload.reference, prepared.sha256, prepared.contentType, prepared.size, prepared.name, prepared.upload.expiresAt]
    );
    if (!result.rows[0]) throw new Error('SUPPORT_EVIDENCE_CREATE_FAILED');
    await this.events.enqueue(context, 'supportscan', ticket.ticket.scope, { evidence: prepared.id }, undefined, `job:scan:${prepared.id}`);
    return { status: 201, body: { id: prepared.id, state: 'pending', upload: { url: prepared.upload.url, method: 'PUT', headers: prepared.upload.headers, expiresAt: prepared.upload.expiresAt } } };
  }

  async inspect(context: WriteTransactionContext, conversation: string, scope: string, ids: readonly string[]) {
    if (ids.length === 0) return Object.freeze([]);
    const result = await this.transactions.database(context).query<{ id: string; state: 'pending' | 'clean' | 'rejected' }>(
      `select id,state from support.evidence where id=any($1::text[]) and conversation_id=$2 and scope_id=$3 order by id for update`,
      [ids, conversation, scope]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ id: row.id, state: row.state })));
  }
}

function sanitizeName(value: string): string {
  const name = value.normalize('NFKC').replace(/[\u0000-\u001f\u007f/\\]/g, '').trim().slice(0, 255);
  if (!name) throw new DomainError('VALIDATION_FAILED', { field: 'name' });
  return name;
}

function assertExtension(name: string, contentType: PreparedEvidence['contentType']): void {
  const extension = name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0];
  const allowed = contentType === 'image/jpeg' ? ['.jpg', '.jpeg'] : contentType === 'image/png' ? ['.png'] : contentType === 'application/pdf' ? ['.pdf'] : ['.txt'];
  if (!extension || !allowed.includes(extension)) throw new DomainError('VALIDATION_FAILED', { field: 'name' });
}
