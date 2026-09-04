import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { CommitContext, FinalizeContext, HandlerContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { CipherEnvelope, KmsClient } from '../../../../foundation/application/KmsPort';
import { bodyRecord, textField } from '../../../../foundation/application/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import { Endpoint } from '../../domain/model/Endpoint';
import type { NotificationMember, NotificationRepository } from '../port/NotificationRepository';

type EndpointChannel = 'sms' | 'email' | 'wechat';
interface LoadedEndpoint {
  readonly member: NotificationMember;
  readonly channel: EndpointChannel;
  readonly enabled: boolean;
  readonly address: string | null;
  readonly identity: string | null;
}
interface PreparedEndpoint {
  readonly member: NotificationMember;
  readonly channel: EndpointChannel;
  readonly envelope: CipherEnvelope | null;
  readonly consentSource: 'member' | 'provider';
  readonly expectedVersion: number;
}

export class EndpointsManageHandler implements DurableOperationHandler<'notification.endpoints.manage', PreparedEndpoint, OperationOutputFor<'notification.endpoints.manage'>, 'write', LoadedEndpoint> {
  readonly operation = 'notification.endpoints.manage' as const;
  readonly mode = 'write' as const;
  constructor(
    private readonly notifications: NotificationRepository,
    private readonly kms: KmsClient
  ) {}

  async load(input: OperationInputFor<'notification.endpoints.manage'>, context: HandlerContext<'notification.endpoints.manage'>): Promise<LoadedEndpoint> {
    const access = requireSession(context.security);
    const member = await this.notifications.member(context.transaction, access.membership.id);
    const channel = endpointChannel(input.path.channel);
    const body = bodyRecord(input);
    const enabled = boolean(body.enabled);
    if (!enabled) return Object.freeze({ member, channel, enabled, address: null, identity: null });
    if (channel === 'wechat') {
      if (body.authorization !== 'accepted') throw new Error('NOTIFICATION_SUBSCRIPTION_AUTHORIZATION_REQUIRED');
      const identity = await this.notifications.wechatRecipient(context.transaction, access.membership.id);
      if (!identity) throw new Error('WECHAT_IDENTITY_NOT_BOUND');
      return Object.freeze({ member, channel, enabled, address: identity.subjectCiphertext, identity: identity.id });
    }
    return Object.freeze({ member, channel, enabled, address: textField(body, 'address', 512), identity: null });
  }

  async prepare(_input: OperationInputFor<'notification.endpoints.manage'>, context: PrepareContext<'notification.endpoints.manage'>, loaded: LoadedEndpoint): Promise<PreparedEndpoint> {
    const consentSource = loaded.identity === null ? 'member' : 'provider';
    const expectedVersion = context.expectedVersion ?? 0;
    if (loaded.address === null) return Object.freeze({ member: loaded.member, channel: loaded.channel, envelope: null, consentSource, expectedVersion });
    const address = loaded.identity === null ? loaded.address : await this.kms.decrypt('pii', 'identity/wechat', loaded.address, { identity: loaded.identity });
    const envelope = await this.kms.encrypt('pii', 'notification/recipient', address, { member: loaded.member.member, channel: loaded.channel });
    return Object.freeze({ member: loaded.member, channel: loaded.channel, envelope, consentSource, expectedVersion });
  }

  async commit(_input: OperationInputFor<'notification.endpoints.manage'>, prepared: PreparedEndpoint, context: CommitContext<'notification.endpoints.manage'>) {
    const access = requireSession(context.security);
    const current = await this.notifications.member(context.transaction, access.membership.id);
    if (current.member !== prepared.member.member || current.organization !== prepared.member.organization) throw new Error('MEMBERSHIP_OWNER_CHANGED');
    const row = prepared.envelope
      ? await this.notifications.saveEndpoint(context.transaction, current.member, prepared.channel, prepared.envelope, prepared.consentSource, prepared.expectedVersion)
      : await this.notifications.revokeEndpoint(context.transaction, current.member, prepared.channel, prepared.expectedVersion);
    if (!row && prepared.expectedVersion > 0) throw new Error('VERSION_CONFLICT');
    const endpoint = row === null ? null : new Endpoint(row.member_id, row.channel, row.address_token, row.consent_source,
      timestamp(row.consent_at), row.revoked_at === null ? null : timestamp(row.revoked_at), row.version);
    const body = endpoint === null ? {} : endpoint.active()
      ? { member_id: endpoint.member, channel: endpoint.channel, consent_source: endpoint.consentSource,
          consent_at: endpoint.consentAt, revoked_at: null, version: endpoint.version }
      : { member_id: endpoint.member, channel: endpoint.channel, consent_source: endpoint.consentSource,
          revoked_at: endpoint.revokedAt!, version: endpoint.version };
    const response = endpoint ? { status: 200, body: body as OperationOutputFor<'notification.endpoints.manage'> } : { status: 204, body: {} as OperationOutputFor<'notification.endpoints.manage'> };
    return Object.freeze({ checkpoint: response.body, response });
  }

  finalize(
    _input: OperationInputFor<'notification.endpoints.manage'>,
    checkpoint: OperationOutputFor<'notification.endpoints.manage'>,
    _context: FinalizeContext<'notification.endpoints.manage'>
  ): Promise<OperationReply<OperationOutputFor<'notification.endpoints.manage'>>> {
    return Promise.resolve({ status: Object.keys(checkpoint as object).length === 0 ? 204 : 200, body: checkpoint });
  }
}

function endpointChannel(value: unknown): EndpointChannel {
  if (!['sms', 'email', 'wechat'].includes(String(value))) throw new Error('NOTIFICATION_ENDPOINT_CHANNEL_INVALID');
  return value as EndpointChannel;
}
function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('BOOLEAN_REQUIRED');
  return value;
}
function timestamp(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}
