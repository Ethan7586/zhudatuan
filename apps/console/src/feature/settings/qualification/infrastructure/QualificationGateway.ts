import { createIdempotencyKey } from '@shop/sdk/context';
import { uploadObject } from '@shop/sdk';
import { createFetchQualification, type QualificationOperations } from '@shop/sdk/qualification';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { consoleCommand, consoleRequest } from '../../../../shared/api/RequestContext';
import type { PolicyManageCommand, PolicyPreviewCommand } from '../model/Command';
import type { QualificationPort } from '../public';
import { QualificationMapper } from './QualificationMapper';
import type { EvidenceContentType, EvidenceKind, QualificationPublishCommand, QualificationRevokeCommand } from '../model/Qualification';
import { QualificationUploadSchema } from './QualificationSchema';

export class QualificationGateway implements QualificationPort {
  private readonly client: QualificationOperations;
  private readonly mapper = new QualificationMapper();
  constructor(baseUrl: string) {
    this.client = createFetchQualification(baseUrl);
  }

  async read(context: ConsoleContext, cursor?: string, signal?: AbortSignal) {
    const value = await this.client.centerRead({ query: { limit: 50, ...(cursor === undefined ? {} : { cursor }) } }, consoleRequest(context.scope, signal, context.session.accessVersion));
    return this.mapper.page(value);
  }

  async previewPolicy(context: ConsoleContext, command: PolicyPreviewCommand, signal?: AbortSignal) {
    const value = await this.client.decisionsPreview({ body: command }, previewContext(context, signal));
    const mapped = this.mapper.preview(value);
    if (mapped.kind !== 'policy') throw new Error('QUALIFICATION_POLICY_PREVIEW_REQUIRED');
    return mapped.impact;
  }

  async previewDecision(context: ConsoleContext, member: string, resource: string, signal?: AbortSignal) {
    const value = await this.client.decisionsPreview({ body: { kind: 'decision', member, resource } }, previewContext(context, signal));
    const mapped = this.mapper.preview(value);
    if (mapped.kind !== 'decision') throw new Error('QUALIFICATION_DECISION_PREVIEW_REQUIRED');
    return mapped.decisions;
  }

  async manage(context: ConsoleContext, command: PolicyManageCommand, signal?: AbortSignal) {
    const body = command.action === 'publish' ? { action: command.action, name: command.name, rule: command.rule } : { action: command.action, version: command.version };
    const value = await this.client.policiesManage(
      { path: { policyid: command.policy }, body },
      consoleCommand(context.scope, {
        accessVersion: context.session.accessVersion,
        expectedVersion: command.expectedVersion,
        proof: command.proof,
        idempotencyKey: command.identity,
        ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
        ...(signal === undefined ? {} : { signal }),
      })
    );
    return this.mapper.receipt(value);
  }

  async publish(context: ConsoleContext, command: QualificationPublishCommand, signal?: AbortSignal) {
    const value = await this.client.qualificationsPublish(
      {
        path: { qualificationid: command.id },
        body: {
          title: command.title,
          subject: { kind: command.subject.kind, id: command.subject.id },
          applicability: command.applicability.map((item) => ({ kind: item.kind, id: item.id })),
          evidence: command.evidence.map((item) => ({ ...item })),
          ...(command.effectiveAt === undefined ? {} : { effectiveAt: command.effectiveAt }),
          expiresAt: command.expiresAt,
        },
      },
      writeContext(context, command.expectedVersion, command.proof, command.identity, signal)
    );
    return this.mapper.qualification(value, 'publish');
  }

  async revoke(context: ConsoleContext, command: QualificationRevokeCommand, signal?: AbortSignal) {
    const value = await this.client.qualificationsRevoke(
      { path: { qualificationid: command.qualification.id }, body: { reason: command.reason } },
      writeContext(context, command.qualification.version, command.proof, command.identity, signal)
    );
    return this.mapper.qualification(value, 'revoke');
  }

  async upload(context: ConsoleContext, file: File, kind: EvidenceKind, identity: string, signal?: AbortSignal) {
    if (file.size < 1 || file.size > 10 * 1024 * 1024) throw new Error('资质材料应小于 10 MB。');
    const contentType = evidenceContentType(file);
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    const sha256 = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
    const intent = QualificationUploadSchema.parse(
      await this.client.evidenceuploadsCreate(
        { body: { name: file.name, kind, contentType, sizeBytes: file.size, sha256 } },
        writeContext(context, undefined, undefined, identity, signal)
      )
    );
    await uploadObject({ url: intent.upload.url, headers: intent.upload.headers, body: file }).catch(() => {
      throw new Error('资质材料上传失败，请重新选择文件。');
    });
    return Object.freeze({ id: intent.evidenceId, kind: intent.kind, name: file.name, reference: intent.objectId, sha256: intent.sha256 });
  }

  createIdentity(): string {
    return createIdempotencyKey();
  }
  createReference(): string {
    return `policy:${crypto.randomUUID()}`;
  }
  createQualificationReference(): string {
    return `qualification:${crypto.randomUUID()}`;
  }
}

function previewContext(context: ConsoleContext, signal?: AbortSignal) {
  return consoleCommand(context.scope, {
    accessVersion: context.session.accessVersion,
    idempotencyKey: null,
    ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
    ...(signal === undefined ? {} : { signal }),
  });
}

function writeContext(context: ConsoleContext, expectedVersion: number | undefined, proof: string | undefined, identity: string, signal?: AbortSignal) {
  return consoleCommand(context.scope, {
    accessVersion: context.session.accessVersion,
    idempotencyKey: identity,
    ...(expectedVersion === undefined ? {} : { expectedVersion }),
    ...(proof === undefined ? {} : { proof }),
    ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
    ...(signal === undefined ? {} : { signal }),
  });
}

function evidenceContentType(file: File): EvidenceContentType {
  if (file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'application/pdf') return file.type;
  throw new Error('仅支持 JPG、PNG 或 PDF 资质材料。');
}
