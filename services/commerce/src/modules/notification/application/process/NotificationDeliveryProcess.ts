import { createHash, randomUUID } from 'node:crypto';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { DeliveryResolver } from '../port/DeliveryResolver';
import type { DeliveryChannelId } from '../../domain/model/Template';
import { Template } from '../../domain/model/Template';
import { Dispatch } from '../../domain/model/Dispatch';
import type { DeliveryRepository } from '../port/DeliveryRepository';
import type { TransactionManager, TransactionOptions } from '../../../../foundation/persistence/TransactionManager';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface NotificationEvent {
  readonly job: string;
  readonly id: string;
  readonly type: string;
  readonly payload: Readonly<Record<string, unknown>>;
}
export interface DeliveryExecution {
  readonly scope: string;
  readonly trace: string;
  readonly signal: AbortSignal;
  readonly deadline: number;
}

export class NotificationDeliveryProcess {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly repository: DeliveryRepository,
    private readonly kms: KmsClient,
    private readonly deliveries: DeliveryResolver
  ) {}

  async event(event: NotificationEvent, execution: DeliveryExecution): Promise<void> {
    const scope = await this.read(execution, (context) => this.repository.jobScope(context, event.job));
    if (!scope) throw new Error('NOTIFICATION_SCOPE_REQUIRED');
    const member = optionalText(event.payload.member);
    const templates = await this.read(execution, (context) => this.repository.eventTemplates(context, scope, event.type, member));
    for (const record of templates) {
      const template = new Template(record.id, record.scope_id, record.channel, record.event_type, record.version, record.variable_schema, record.provider_template, record.subject, record.body, record.status);
      const variables = template.select(event.payload);
      const recipient = await this.recipient(member, scope, template.channel, execution);
      if (!recipient) continue;
      const id = `dispatch:${randomUUID()}`;
      let ciphertext: string | null = null;
      let key: string | null = null;
      let reference: string | null = recipient.reference;
      if (recipient.address !== null) {
        const envelope = await this.kms.encrypt('pii', 'notification/recipient', recipient.address, { dispatch: id, channel: template.channel });
        ciphertext = envelope.ciphertext;
        key = envelope.keyVersion;
        reference = null;
      }
      const subject = template.render(template.subject, variables);
      const body = template.render(template.body, variables)!;
      new Dispatch(id, scope, member, template.id, template.channel, reference ?? recipient.address!, variables, subject, body, 'queued');
      await this.write(execution, (context) =>
        this.repository.queue(context, {
          id,
          scope,
          member,
          template: template.id,
          recipientToken: recipient.token,
          recipientCiphertext: ciphertext,
          recipientKeyVersion: key,
          recipientRef: reference,
          variables,
          subject,
          body,
          idempotency: `${event.id}:${template.channel}`,
        })
      );
    }
    await this.write(execution, (context) => this.repository.completeInbox(context, event.id));
  }

  async dispatch(id: string, execution: DeliveryExecution): Promise<void> {
    const selected = await this.write(execution, (context) => this.repository.claim(context, id));
    if (!selected) return;
    const template = new Template(selected.template_id, selected.scope_id, selected.channel, selected.event_type, selected.version, selected.variable_schema, selected.provider_template, selected.subject, selected.body, selected.status);
    const variables = template.select(selected.payload);
    const recipient = selected.recipient_ref ?? (await this.kms.decrypt('pii', 'notification/recipient', required(selected.recipient_ciphertext), { dispatch: id, channel: selected.channel }));
    try {
      const receipt = await this.deliveries.require(selected.channel).send({ recipient, providerTemplate: selected.provider_template, variables, subject: selected.subject, body: selected.body, idempotency: id });
      await this.write(execution, (context) => this.repository.complete(context, selected, receipt));
    } catch (cause) {
      await this.write(execution, (context) => this.repository.fail(context, selected, selected.channel, deliveryError(cause)));
      throw cause;
    }
  }

  async challenge(id: string, execution: DeliveryExecution): Promise<void> {
    const selected = await this.read(execution, (context) => this.repository.challenge(context, id));
    if (!selected) return;
    const attempt = await this.write(execution, (context) => this.repository.beginChallengeAttempt(context, id, 'sms'));
    if (!attempt || !attempt.dispatch) return;
    let code: string;
    let recipient: string;
    try {
      [code, recipient] = await Promise.all([
        this.kms.decrypt('pii', 'identity/challenge', selected.codeCiphertext, { challenge: id, purpose: selected.purpose }),
        this.kms.decrypt('pii', 'identity/destination', selected.destinationCiphertext, { challenge: id, purpose: selected.purpose }),
      ]);
    } catch (cause) {
      await this.write(execution, (context) => this.repository.failChallengeAttempt(context, id, attempt.sequence, deliveryError(cause)));
      throw cause;
    }
    try {
      const receipt = await this.deliveries.require('sms').send({ recipient, providerTemplate: null, variables: { code }, subject: null, body: 'verification', idempotency: id });
      const completed = await this.write(execution, (context) => this.repository.completeChallengeAttempt(context, id, attempt.sequence, receipt.provider, receipt.externalId));
      if (!completed) throw new Error('IDENTITY_NOTIFICATION_DELIVERY_STATE_LOST');
    } catch (cause) {
      const code = deliveryError(cause);
      if (definitiveProviderRejection(code)) await this.write(execution, (context) => this.repository.failChallengeAttempt(context, id, attempt.sequence, code));
      else await this.write(execution, (context) => this.repository.ambiguousChallengeAttempt(context, id, attempt.sequence, code));
    }
  }

  private async recipient(
    member: string | null,
    scope: string,
    channel: DeliveryChannelId,
    execution: DeliveryExecution
  ): Promise<Readonly<{
    token: string;
    address: string | null;
    reference: string | null;
  }> | null> {
    if (channel === 'inapp') {
      const reference = member === null ? `scope:${scope}` : `member:${member}`;
      return { token: digest(reference), address: null, reference };
    }
    if (member === null) return null;
    const endpoint = await this.read(execution, (context) => this.repository.endpoint(context, member, channel));
    if (!endpoint) return null;
    const address = await this.kms.decrypt('pii', 'notification/recipient', endpoint.address_ciphertext, { member, channel });
    return { token: endpoint.address_token, address, reference: null };
  }

  private read<T>(execution: DeliveryExecution, work: (context: ReadTransactionContext) => Promise<T>): Promise<T> {
    return this.transactions.read(this.options(execution), work);
  }

  private write<T>(execution: DeliveryExecution, work: (context: WriteTransactionContext) => Promise<T>): Promise<T> {
    return this.transactions.write(this.options(execution), work);
  }

  private options(execution: DeliveryExecution): TransactionOptions {
    return {
      tenant: execution.scope,
      membership: '',
      scope: execution.scope,
      actor: 'job:notification',
      trace: execution.trace,
      operation: 'job.notification.deliver',
      workload: 'jobs',
      signal: execution.signal,
      deadline: execution.deadline,
    };
  }
}

function optionalText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !value) throw new Error('NOTIFICATION_MEMBER_INVALID');
  return value;
}
function required(value: string | null): string {
  if (!value) throw new Error('NOTIFICATION_RECIPIENT_MISSING');
  return value;
}
function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
function deliveryError(value: unknown): string {
  const message = value instanceof Error ? value.message : 'NOTIFICATION_DELIVERY_FAILED';
  return message.replace(/[^A-Z0-9_.:-]/gi, '').slice(0, 200) || 'NOTIFICATION_DELIVERY_FAILED';
}
function definitiveProviderRejection(code: string): boolean {
  return code === 'ALIYUN_SMS_REJECTED' || code.startsWith('ALIYUN_SMS_ISV.');
}
