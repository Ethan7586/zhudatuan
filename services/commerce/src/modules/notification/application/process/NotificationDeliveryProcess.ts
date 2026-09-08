import { createHash, randomUUID } from 'node:crypto';
import type { KmsClient } from '../../../../pipeline/KmsPort';
import type { DeliveryResolver } from '../port/DeliveryResolver';
import type { DeliveryChannelId } from '../../domain/model/Template';
import { Template } from '../../domain/model/Template';
import { classifyDeliveryFailure, Dispatch } from '../../domain/model/Dispatch';
import { Preference, type QuietHours } from '../../domain/model/Preference';
import type { DeliveryRepository } from '../port/DeliveryRepository';
import type { TransactionManager, TransactionOptions } from '../../../../platform/database/TransactionManager';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { allParallel, mapParallel } from '@shop/kernel';
import { WORKER_CAPACITY } from '@shop/config/runtime';

import { definitiveProviderRejection, deliveryError, digest, optionalText, preferenceFor, required } from './NotificationDeliveryValue';

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
    await mapParallel(templates, WORKER_CAPACITY.notification.concurrency, (record) => this.queueEvent(record, event, scope, member, execution));
    await this.write(execution, (context) => this.repository.completeInbox(context, event.id));
  }

  async dispatch(id: string, execution: DeliveryExecution): Promise<void> {
    const selected = await this.write(execution, (context) => this.repository.claim(context, id));
    if (!selected) return;
    const preference = selected.member_id === null ? null : preferenceFor(selected.member_id, selected);
    const decision = preference?.decide(selected.purpose, selected.mandatory, new Date()) ?? { kind: 'allow' as const };
    if (decision.kind === 'block') return this.write(execution, (context) => this.repository.cancel(context, selected, decision.reason));
    if (decision.kind === 'defer') return this.write(execution, (context) => this.repository.defer(context, selected, decision.availableAt));
    const dispatch = new Dispatch(
      selected.id,
      selected.scope_id,
      selected.member_id,
      selected.template_id,
      selected.channel,
      selected.recipient_ref ?? selected.recipient_ciphertext ?? selected.id,
      selected.payload,
      selected.subject,
      selected.body,
      'sending',
      selected.id
    );
    const recipient = selected.recipient_ref ?? (await this.kms.decrypt('pii', 'notification/recipient', required(selected.recipient_ciphertext), { dispatch: id, channel: selected.channel }));
    const strategies = this.deliveries.resolve(dispatch.channel);
    for (let index = 0; index < strategies.length; index += 1) {
      const strategy = strategies[index]!;
      try {
        const receipt = await strategy.send({
          recipient,
          providerTemplate: selected.provider_template,
          purpose: selected.purpose,
          ...(selected.channel === 'wechat' && selected.authorization_state === 'accepted' ? { authorization: 'accepted' as const } : {}),
          variables: dispatch.variables,
          subject: dispatch.subject,
          body: dispatch.body,
          idempotency: dispatch.idempotencyKey,
          requestId: dispatch.id,
          traceId: execution.trace,
          deadline: execution.deadline,
          signal: execution.signal,
        });
        await this.write(execution, (context) => this.repository.complete(context, selected, receipt, index + 1));
        return;
      } catch (cause) {
        const failure = classifyDeliveryFailure(cause);
        const route = index + 1;
        const degrade = failure.kind === 'retryable' && route < strategies.length;
        if (degrade) {
          await this.write(execution, (context) => this.repository.recordFailure(context, selected, strategy.provider, route, failure));
          continue;
        }
        const terminal = await this.write(execution, (context) => this.repository.fail(context, selected, strategy.provider, route, failure));
        if (!terminal) throw new Error(failure.code);
        return;
      }
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
      [code, recipient] = await allParallel(
        [
          () => this.kms.decrypt('pii', 'identity/challenge', selected.codeCiphertext, { challenge: id, purpose: selected.purpose }),
          () => this.kms.decrypt('pii', 'identity/destination', selected.destinationCiphertext, { challenge: id, purpose: selected.purpose }),
        ] as const,
        { concurrency: 2, expiresAt: execution.deadline, signal: execution.signal }
      );
    } catch (cause) {
      await this.write(execution, (context) => this.repository.failChallengeAttempt(context, id, attempt.sequence, deliveryError(cause)));
      throw cause;
    }
    try {
      const receipt = await this.deliveries.resolve('sms')[0]!.send({
        recipient,
        providerTemplate: null,
        purpose: 'verification',
        variables: { code },
        subject: null,
        body: 'verification',
        idempotency: id,
        requestId: `${id}:${attempt.sequence}`,
        traceId: execution.trace,
        deadline: execution.deadline,
        signal: execution.signal,
      });
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

  private async queueEvent(record: Awaited<ReturnType<DeliveryRepository['eventTemplates']>>[number], event: NotificationEvent, scope: string, member: string | null, execution: DeliveryExecution): Promise<void> {
    const template = new Template(
      record.id,
      record.scope_id,
      record.channel,
      record.event_type,
      record.version,
      record.variable_schema,
      record.provider_template,
      record.subject,
      record.body,
      record.status,
      record.purpose,
      record.mandatory
    );
    const decision = member === null ? { kind: 'allow' as const } : preferenceFor(member, record).decide(template.purpose, template.mandatory, new Date());
    if (decision.kind === 'block') return;
    const recipient = await this.recipient(member, scope, template.channel, execution);
    if (!recipient) return;
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
    const variables = template.select(event.payload);
    const subject = template.render(template.subject, variables);
    const body = template.render(template.body, variables)!;
    const idempotency = `${event.id}:${template.id}:${template.version}`;
    new Dispatch(id, scope, member, template.id, template.channel, reference ?? recipient.address!, variables, subject, body, 'queued', idempotency);
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
        idempotency,
        event: template.event,
        templateVersion: template.version,
        providerTemplate: template.providerTemplate,
        variableSchema: template.variables,
        purpose: template.purpose,
        mandatory: template.mandatory,
        availableAt: decision.kind === 'defer' ? decision.availableAt : new Date().toISOString(),
      })
    );
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
