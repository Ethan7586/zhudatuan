import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { CommitContext, FinalizeContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { DurableCommit, DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { CipherEnvelope, KmsClient } from '../../../../foundation/application/KmsPort';
import { bodyRecord, nullableText } from '../../../../foundation/application/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { DistributorRepository } from '../port/DistributorRepository';

interface PreparedDistributorUpdate {
  readonly id: string;
  readonly scope: string;
  readonly name: string | null;
  readonly settlementMode: string | null;
  readonly metadata: Readonly<Record<string, unknown>> | null;
  readonly contactChanged: boolean;
  readonly contact: CipherEnvelope | null;
  readonly expectedVersion: number | null;
}

export class DistributorsUpdateHandler implements DurableOperationHandler<'channel.distributors.update', PreparedDistributorUpdate, Readonly<Record<string, unknown>>, 'write'> {
  readonly operation = 'channel.distributors.update' as const;
  readonly mode = 'write' as const;
  constructor(
    private readonly distributors: DistributorRepository,
    private readonly kms: KmsClient
  ) {}

  async prepare(input: OperationInputFor<'channel.distributors.update'>, context: PrepareContext<'channel.distributors.update'>): Promise<PreparedDistributorUpdate> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const contact = nullableText(body, 'contact');
    const envelope = contact === null ? null : await this.kms.encrypt('pii', 'channel/contact', contact, { distributor: input.path.distributorid, scope: access.scope.id });
    return Object.freeze({
      id: input.path.distributorid,
      scope: access.scope.id,
      name: nullableText(body, 'name'),
      settlementMode: nullableText(body, 'settlementMode'),
      metadata: body.metadata === undefined ? null : record(body.metadata),
      contactChanged: 'contact' in body,
      contact: envelope,
      expectedVersion: context.expectedVersion ?? null,
    });
  }

  async commit(
    _input: OperationInputFor<'channel.distributors.update'>,
    prepared: PreparedDistributorUpdate,
    context: CommitContext<'channel.distributors.update'>
  ): Promise<DurableCommit<Readonly<Record<string, unknown>>, OperationOutputFor<'channel.distributors.update'>>> {
    const updated = await this.distributors.update(context.transaction, prepared);
    return { checkpoint: updated, response: { status: 200, body: updated as OperationOutputFor<'channel.distributors.update'> } };
  }

  async finalize(
    _input: OperationInputFor<'channel.distributors.update'>,
    checkpoint: Readonly<Record<string, unknown>>,
    _context: FinalizeContext<'channel.distributors.update'>
  ): Promise<OperationReply<OperationOutputFor<'channel.distributors.update'>>> {
    return { status: 200, body: checkpoint as OperationOutputFor<'channel.distributors.update'> };
  }
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DomainError('VALIDATION_FAILED', { field: 'metadata' });
  return Object.freeze({ ...(value as Record<string, unknown>) });
}
