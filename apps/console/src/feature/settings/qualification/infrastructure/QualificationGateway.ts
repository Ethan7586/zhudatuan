import { createIdempotencyKey } from '@shop/sdk/context';
import { createFetchQualification, type QualificationOperations } from '@shop/sdk/qualification';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { consoleCommand, consoleRequest } from '../../../../shared/api/RequestContext';
import type { PolicyManageCommand, PolicyPreviewCommand } from '../model/Command';
import type { QualificationPort } from '../public';
import { QualificationMapper } from './QualificationMapper';

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

  async previewPolicy(context: ConsoleContext, command: PolicyPreviewCommand, identity: string, signal?: AbortSignal) {
    const value = await this.client.decisionsPreview({ body: command }, previewContext(context, identity, signal));
    const mapped = this.mapper.preview(value);
    if (mapped.kind !== 'policy') throw new Error('QUALIFICATION_POLICY_PREVIEW_REQUIRED');
    return mapped.impact;
  }

  async previewDecision(context: ConsoleContext, member: string, resource: string, identity: string, signal?: AbortSignal) {
    const value = await this.client.decisionsPreview({ body: { kind: 'decision', member, resource } }, previewContext(context, identity, signal));
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

  createIdentity(): string {
    return createIdempotencyKey();
  }
  createReference(): string {
    return `policy:${crypto.randomUUID()}`;
  }
}

function previewContext(context: ConsoleContext, identity: string, signal?: AbortSignal) {
  return consoleCommand(context.scope, {
    accessVersion: context.session.accessVersion,
    idempotencyKey: identity,
    ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
    ...(signal === undefined ? {} : { signal }),
  });
}
