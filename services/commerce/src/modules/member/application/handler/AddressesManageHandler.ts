import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import { DomainError } from '../../../../platform/error/DomainError';
import type { CommitContext, FinalizeContext, PrepareContext } from '../../../../pipeline/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { CipherEnvelope, KmsClient } from '../../../../pipeline/KmsPort';
import { bodyRecord, textField } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import { addressChangedEvent } from '../../domain/event/MemberEvents';
import { AddressPolicy } from '../../domain/policy/AddressPolicy';
import type { AddressRepository, MemberAddressSummary } from '../port/AddressRepository';
import type { MemberRepository } from '../port/MemberRepository';

interface PreparedAddress {
  readonly deleted: boolean;
  readonly recipient: string;
  readonly mobile: string;
  readonly address: string;
  readonly region: string;
  readonly isDefault: boolean;
  readonly recipientEnvelope: CipherEnvelope | null;
  readonly mobileEnvelope: CipherEnvelope | null;
  readonly addressEnvelope: CipherEnvelope | null;
}

export class AddressesManageHandler implements DurableOperationHandler<'member.addresses.manage', PreparedAddress, OperationOutputFor<'member.addresses.manage'>, 'write'> {
  readonly operation = 'member.addresses.manage' as const;
  readonly mode = 'write' as const;
  private readonly policy = new AddressPolicy();
  constructor(
    private readonly members: MemberRepository,
    private readonly addresses: AddressRepository,
    private readonly kms: KmsClient
  ) {}

  async prepare(input: OperationInputFor<'member.addresses.manage'>, context: PrepareContext<'member.addresses.manage'>): Promise<PreparedAddress> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    if (body.status === 'deleted') return Object.freeze({ deleted: true, recipient: '', mobile: '', address: '', region: '', isDefault: false, recipientEnvelope: null, mobileEnvelope: null, addressEnvelope: null });
    const fields = this.policy.normalize({
      recipient: textField(body, 'recipient', 128),
      mobile: textField(body, 'mobile', 32),
      address: textField(body, 'address', 500),
      region: textField(body, 'region', 64),
      isDefault: body.is_default === true,
    });
    const [recipientEnvelope, mobileEnvelope, addressEnvelope] = await Promise.all([
      this.kms.encrypt('pii', 'member/address/recipient', fields.recipient, { principal: access.actor.id }),
      this.kms.encrypt('pii', 'member/address/mobile', fields.mobile, { principal: access.actor.id }),
      this.kms.encrypt('pii', 'member/address/detail', fields.address, { principal: access.actor.id }),
    ]);
    return Object.freeze({ deleted: false, ...fields, recipientEnvelope, mobileEnvelope, addressEnvelope });
  }

  async commit(input: OperationInputFor<'member.addresses.manage'>, prepared: PreparedAddress, context: CommitContext<'member.addresses.manage'>) {
    const access = requireSession(context.security);
    const membership = await this.members.membership(context.transaction, access.membership.id);
    const book = await this.addresses.book(context.transaction, membership.member);
    const row = prepared.deleted
      ? await this.addresses.remove(context.transaction, membership.member, book.remove(input.path.addressid, context.expectedVersion ?? -1))
      : await this.addresses.save(
          context.transaction,
          {
            id: input.path.addressid,
            member: membership.member,
            recipient: prepared.recipient,
            mobile: prepared.mobile,
            address: prepared.address,
            region: prepared.region,
            recipientEnvelope: prepared.recipientEnvelope!,
            mobileEnvelope: prepared.mobileEnvelope!,
            addressEnvelope: prepared.addressEnvelope!,
            expectedVersion: context.expectedVersion ?? -1,
          },
          book.save(input.path.addressid, context.expectedVersion ?? -1, prepared.isDefault)
        );
    if (!row) throw new DomainError('VERSION_CONFLICT');
    const response = { status: 200, body: row as OperationOutputFor<'member.addresses.manage'> } as const;
    return Object.freeze({
      checkpoint: response.body,
      response,
      events: [
        addressChangedEvent(
          { member: membership.member, scope: membership.organization, actor: access.actor.id, trace: context.traceId },
          { address: input.path.addressid, state: prepared.deleted ? 'deleted' : 'active', isDefault: prepared.deleted ? false : (row as MemberAddressSummary).is_default, version: row.version }
        ),
      ],
    });
  }

  finalize(
    _input: OperationInputFor<'member.addresses.manage'>,
    checkpoint: OperationOutputFor<'member.addresses.manage'>,
    _context: FinalizeContext<'member.addresses.manage'>
  ): Promise<OperationReply<OperationOutputFor<'member.addresses.manage'>>> {
    return Promise.resolve({ status: 200, body: checkpoint });
  }
}
