import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { CommitContext, FinalizeContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { CipherEnvelope, KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { AddressRepository } from '../port/AddressRepository';
import type { MemberRepository } from '../port/MemberRepository';

interface PreparedAddress {
  readonly deleted: boolean;
  readonly recipient: string;
  readonly mobile: string;
  readonly address: string;
  readonly region: string;
  readonly recipientEnvelope: CipherEnvelope | null;
  readonly mobileEnvelope: CipherEnvelope | null;
  readonly addressEnvelope: CipherEnvelope | null;
}

export class AddressesManageHandler implements DurableOperationHandler<'member.addresses.manage', PreparedAddress, OperationOutputFor<'member.addresses.manage'>, 'write'> {
  readonly operation = 'member.addresses.manage' as const;
  readonly mode = 'write' as const;
  constructor(
    private readonly members: MemberRepository,
    private readonly addresses: AddressRepository,
    private readonly kms: KmsClient
  ) {}

  async prepare(input: OperationInputFor<'member.addresses.manage'>, context: PrepareContext<'member.addresses.manage'>): Promise<PreparedAddress> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    if (body.status === 'deleted') return Object.freeze({ deleted: true, recipient: '', mobile: '', address: '', region: '', recipientEnvelope: null, mobileEnvelope: null, addressEnvelope: null });
    const recipient = textField(body, 'recipient', 128).trim();
    const mobile = textField(body, 'mobile', 32).trim();
    const address = textField(body, 'address', 1000).trim();
    const region = textField(body, 'region', 64).trim();
    const [recipientEnvelope, mobileEnvelope, addressEnvelope] = await Promise.all([
      this.kms.encrypt('pii', 'member/address/recipient', recipient, { principal: access.actor.id }),
      this.kms.encrypt('pii', 'member/address/mobile', mobile, { principal: access.actor.id }),
      this.kms.encrypt('pii', 'member/address/detail', address, { principal: access.actor.id }),
    ]);
    return Object.freeze({ deleted: false, recipient, mobile, address, region, recipientEnvelope, mobileEnvelope, addressEnvelope });
  }

  async commit(input: OperationInputFor<'member.addresses.manage'>, prepared: PreparedAddress, context: CommitContext<'member.addresses.manage'>) {
    const access = requireSession(context.security);
    const membership = await this.members.membership(context.transaction, access.membership.id);
    const row = prepared.deleted
      ? await this.addresses.remove(context.transaction, input.path.addressid, membership.member, context.expectedVersion ?? null)
      : await this.addresses.save(context.transaction, {
          id: input.path.addressid,
          member: membership.member,
          recipient: prepared.recipient,
          mobile: prepared.mobile,
          address: prepared.address,
          region: prepared.region,
          recipientEnvelope: prepared.recipientEnvelope!,
          mobileEnvelope: prepared.mobileEnvelope!,
          addressEnvelope: prepared.addressEnvelope!,
          expectedVersion: context.expectedVersion ?? null,
        });
    if (!row) throw new DomainError('VERSION_CONFLICT');
    const response = { status: 200, body: row as OperationOutputFor<'member.addresses.manage'> } as const;
    return Object.freeze({ checkpoint: response.body, response });
  }

  finalize(
    _input: OperationInputFor<'member.addresses.manage'>,
    checkpoint: OperationOutputFor<'member.addresses.manage'>,
    _context: FinalizeContext<'member.addresses.manage'>
  ): Promise<OperationReply<OperationOutputFor<'member.addresses.manage'>>> {
    return Promise.resolve({ status: 200, body: checkpoint });
  }
}
