import { createHash, randomUUID } from 'node:crypto';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { DeliveryRegistry } from '../DeliveryRegistry';
import type { DeliveryChannelId } from '../../domain/model/Template';
import { Template } from '../../domain/model/Template';
import { Dispatch } from '../../domain/model/Dispatch';
import type { NotificationRepository } from '../port/NotificationRepository';

export interface NotificationEvent {
  readonly job: string;
  readonly id: string;
  readonly type: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export class DispatchNotification {
  constructor(private readonly repository: NotificationRepository, private readonly kms: KmsClient,
    private readonly deliveries: DeliveryRegistry) {}

  async event(event: NotificationEvent): Promise<void> {
    const scope = (await this.repository.jobScope(event.job)).rows[0]?.scope_id;
    if (!scope) throw new Error('NOTIFICATION_SCOPE_REQUIRED');
    const member = optionalText(event.payload.member);
    const templates = await this.repository.eventTemplates(scope, event.type, member);
    for (const record of templates.rows) {
      const template = new Template(record.id, record.scope_id, record.channel, record.event_type, record.version,
        record.variable_schema, record.provider_template, record.subject, record.body, record.status);
      const variables = template.select(event.payload);
      const recipient = await this.recipient(member, scope, template.channel);
      if (!recipient) continue;
      const id = `dispatch:${randomUUID()}`;
      let ciphertext: string | null = null; let key: string | null = null; let reference: string | null = recipient.reference;
      if (recipient.address !== null) {
        const envelope = await this.kms.encrypt('notification/recipient', recipient.address, { dispatch: id, channel: template.channel });
        ciphertext = envelope.ciphertext; key = envelope.keyVersion; reference = null;
      }
      const subject = template.render(template.subject, variables); const body = template.render(template.body, variables)!;
      new Dispatch(id, scope, member, template.id, template.channel, reference ?? recipient.address!, variables, subject, body, 'queued');
      await this.repository.queue({ id, scope, member, template: template.id, recipientToken: recipient.token,
        recipientCiphertext: ciphertext, recipientKeyVersion: key, recipientRef: reference, variables, subject, body,
        idempotency: `${event.id}:${template.channel}` });
    }
    await this.repository.completeInbox(event.id);
  }

  async dispatch(id: string): Promise<void> {
    const selected = (await this.repository.claim(id)).rows[0]; if (!selected) return;
    const template = new Template(selected.template_id, selected.scope_id, selected.channel, selected.event_type, selected.version,
      selected.variable_schema, selected.provider_template, selected.subject, selected.body, selected.status);
    const variables = template.select(selected.payload);
    const recipient = selected.recipient_ref ?? await this.kms.decrypt('notification/recipient', required(selected.recipient_ciphertext),
      { dispatch: id, channel: selected.channel });
    try {
      const receipt = await this.deliveries.require(selected.channel).send({ recipient, providerTemplate: selected.provider_template,
        variables, subject: selected.subject, body: selected.body, idempotency: id });
      await this.repository.complete(selected, receipt);
    } catch (cause) {
      await this.repository.fail(selected, selected.channel, deliveryError(cause)); throw cause;
    }
  }

  async challenge(id: string): Promise<void> {
    const selected = (await this.repository.challenge(id)).rows[0]; if (!selected) return;
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
    const attempt = (await this.repository.beginChallengeAttempt(id, 'sms')).rows[0];
    if (!attempt || !attempt.dispatch) return;
    let code: string;
    let recipient: string;
    try {
      [code, recipient] = await Promise.all([
        this.kms.decrypt('identity/challenge', selected.code_ciphertext, { challenge: id, purpose: selected.purpose }),
        this.kms.decrypt('identity/destination', selected.destination_ciphertext, { challenge: id, purpose: selected.purpose }),
      ]);
    } catch (cause) {
      await this.repository.failChallengeAttempt(id, attempt.sequence, deliveryError(cause));
      throw cause;
    }
<<<<<<< HEAD
    try {
      const receipt = await this.deliveries.require('sms').send({ recipient, providerTemplate: null, variables: { code }, subject: null,
        body: 'verification', idempotency: id });
      const completed = await this.repository.completeChallengeAttempt(id, attempt.sequence, receipt.provider, receipt.externalId);
      if (completed.rowCount !== 1) throw new Error('IDENTITY_NOTIFICATION_DELIVERY_STATE_LOST');
    } catch (cause) {
      const code = deliveryError(cause);
      if (definitiveProviderRejection(code)) await this.repository.failChallengeAttempt(id, attempt.sequence, code);
      else await this.repository.ambiguousChallengeAttempt(id, attempt.sequence, code);
=======
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
    const [code, recipient] = await Promise.all([
      this.kms.decrypt('identity/challenge', selected.code_ciphertext, { challenge: id, purpose: selected.purpose }),
      this.kms.decrypt('identity/destination', selected.destination_ciphertext, { challenge: id, purpose: selected.purpose }),
    ]);
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
    try {
      const receipt = await this.deliveries.require('sms').send({ recipient, providerTemplate: null, variables: { code }, subject: null,
        body: 'verification', idempotency: id });
      const completed = await this.repository.completeChallengeAttempt(id, attempt.sequence, receipt.provider, receipt.externalId);
      if (completed.rowCount !== 1) throw new Error('IDENTITY_NOTIFICATION_DELIVERY_STATE_LOST');
    } catch (cause) {
<<<<<<< HEAD
      await this.repository.challengeAttempt(id, 'sms', 'failed', null, deliveryError(cause)); throw cause;
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
      const code = deliveryError(cause);
      if (definitiveProviderRejection(code)) await this.repository.failChallengeAttempt(id, attempt.sequence, code);
      else await this.repository.ambiguousChallengeAttempt(id, attempt.sequence, code);
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
    try {
      const receipt = await this.deliveries.require('sms').send({ recipient, providerTemplate: null, variables: { code }, subject: null,
        body: 'verification', idempotency: id });
      await this.repository.challengeAttempt(id, receipt.provider, 'sent', receipt.externalId, null);
    } catch (cause) {
      await this.repository.challengeAttempt(id, 'sms', 'failed', null, deliveryError(cause)); throw cause;
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
    }
  }

  private async recipient(member: string | null, scope: string, channel: DeliveryChannelId): Promise<Readonly<{
    token: string; address: string | null; reference: string | null
  }> | null> {
    if (channel === 'inapp') {
      const reference = member === null ? `scope:${scope}` : `member:${member}`;
      return { token: digest(reference), address: null, reference };
    }
    if (member === null) return null;
    const endpoint = (await this.repository.endpoint(member, channel)).rows[0];
    if (!endpoint) return null;
    const address = await this.kms.decrypt('notification/recipient', endpoint.address_ciphertext, { member, channel });
    return { token: endpoint.address_token, address, reference: null };
  }
}

function optionalText(value: unknown): string | null {
  if (value === undefined || value === null) return null; if (typeof value !== 'string' || !value) throw new Error('NOTIFICATION_MEMBER_INVALID'); return value;
}
function required(value: string | null): string { if (!value) throw new Error('NOTIFICATION_RECIPIENT_MISSING'); return value; }
function digest(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function deliveryError(value: unknown): string {
  const message = value instanceof Error ? value.message : 'NOTIFICATION_DELIVERY_FAILED';
  return message.replace(/[^A-Z0-9_.:-]/gi, '').slice(0, 200) || 'NOTIFICATION_DELIVERY_FAILED';
}
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
function definitiveProviderRejection(code: string): boolean {
  return code === 'ALIYUN_SMS_REJECTED' || code.startsWith('ALIYUN_SMS_ISV.');
}
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
function definitiveProviderRejection(code: string): boolean {
  return code === 'ALIYUN_SMS_REJECTED' || code.startsWith('ALIYUN_SMS_ISV.');
}
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
