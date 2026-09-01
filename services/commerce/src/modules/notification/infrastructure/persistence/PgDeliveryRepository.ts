import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { randomUUID } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';

import type { DeliveryReceipt } from '../../application/port/DeliveryChannel';
import type { ChallengeRecord, DeliveryRepository, DispatchRecord, EndpointRecord, QueuedDispatch, TemplateRecord } from '../../application/port/DeliveryRepository';
import type { DeliveryChannelId } from '../../domain/model/Template';
import type { NotificationIdentityPort } from '../../../identity/public/index';
import type { OrganizationReadPort } from '../../../organization/public';

export class PgDeliveryRepository implements DeliveryRepository {
  constructor(
    private readonly identity: NotificationIdentityPort,
    private readonly organizations: OrganizationReadPort,
    private readonly transactions = new PgTransactionAccess()
  ) {}

  jobScope(context: ReadTransactionContext, job: string): Promise<string | null> {
    return new PgRuntimeWriter(this.transactions.database(context)).jobScope(job);
  }

  async eventTemplates(context: ReadTransactionContext, scope: string, event: string, member: string | null) {
    const scopes = await this.notificationScopes(context, scope);
    const result = await this.transactions.database(context).query<TemplateRecord>(
      `select distinct on(template.channel) template.* from notification.template template left join notification.preference preference
      on preference.member_id=$2 and preference.channel=template.channel and preference.event_type=template.event_type
      where template.scope_id=any($1::text[]) and template.event_type=$3 and template.status='active'
      and($2::text is not null or template.channel='inapp') and coalesce(preference.enabled,true)
      and(template.channel<>'wechat' or preference.authorization_state='accepted')
      order by template.channel,array_position($1::text[],template.scope_id),template.version desc`,
      [scopes, member, event]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze(row)));
  }

  private async notificationScopes(context: ReadTransactionContext, scope: string): Promise<readonly string[]> {
    const snapshot = await this.organizations.scope(context, scope);
    return Object.freeze([snapshot.id, ...snapshot.ancestors]);
  }

  async endpoint(context: ReadTransactionContext, member: string, channel: DeliveryChannelId): Promise<EndpointRecord | null> {
    const result = await this.transactions.database(context).query<EndpointRecord>(
      `select address_ciphertext,address_token from notification.endpoint
      where member_id=$1 and channel=$2 and revoked_at is null`,
      [member, channel]
    );
    return result.rows[0] ? Object.freeze(result.rows[0]) : null;
  }

  async queue(context: WriteTransactionContext, input: QueuedDispatch): Promise<void> {
    const database = this.transactions.database(context);
    const queued = await database.query<{ id: string }>(
      `insert into notification.dispatch(id,scope_id,member_id,template_id,channel,recipient_token,
      recipient_ciphertext,recipient_key_version,recipient_ref,payload,subject,body,state,idempotency_key,available_at,created_at)
      values($1,$2,$3,$4,(select channel from notification.template where id=$4),$5,$6,$7,$8,$9::jsonb,$10,$11,'queued',$12,
      clock_timestamp(),clock_timestamp()) on conflict(scope_id,idempotency_key) do nothing returning id`,
      [input.id, input.scope, input.member, input.template, input.recipientToken, input.recipientCiphertext, input.recipientKeyVersion, input.recipientRef, JSON.stringify(input.variables), input.subject, input.body, input.idempotency]
    );
    if (queued.rows[0]) await new PgRuntimeWriter(database).schedule({ id: `job:${randomUUID()}`, kind: 'notification', owner: 'notification', scope: input.scope, payload: { dispatch: queued.rows[0].id }, priority: 20 });
  }

  async completeInbox(context: WriteTransactionContext, event: string): Promise<void> {
    if (!(await new PgRuntimeWriter(this.transactions.database(context)).completeInbox('job:notification', event))) throw new Error('NOTIFICATION_INBOX_LEASE_LOST');
  }

  async claim(context: WriteTransactionContext, id: string): Promise<DispatchRecord | null> {
    const result = await this.transactions.database(context).query<DispatchRecord>(
      `update notification.dispatch dispatch set state='sending' from notification.template template
      where dispatch.id=$1 and template.id=dispatch.template_id and dispatch.state in('queued','failed')
      returning dispatch.id,dispatch.scope_id,dispatch.member_id,dispatch.template_id,dispatch.channel,template.event_type,template.version,
        template.provider_template,template.variable_schema,dispatch.subject,dispatch.body,dispatch.payload,dispatch.recipient_ciphertext,
        dispatch.recipient_ref,template.status`,
      [id]
    );
    return result.rows[0] ? Object.freeze(result.rows[0]) : null;
  }

  async complete(context: WriteTransactionContext, dispatch: DispatchRecord, receipt: DeliveryReceipt): Promise<void> {
    const database = this.transactions.database(context);
    const completed = await database.query<{ id: string; scope: string; channel: string }>(
      `with completed as(update notification.dispatch set state='sent' where id=$1 and state='sending' returning id,scope_id,channel)
      insert into notification.attempt(id,dispatch_id,scope_id,member_id,provider,external_id,state,attempted_at)
      select $2,completed.id,completed.scope_id,$3,$4,$5,'sent',clock_timestamp() from completed
      returning dispatch_id id,scope_id scope,(select channel from completed) channel`,
      [dispatch.id, `attempt:${randomUUID()}`, dispatch.member_id, receipt.provider, receipt.externalId]
    );
    const row = completed.rows[0];
    if (!row) throw new Error('NOTIFICATION_DELIVERY_STATE_LOST');
    const event = `event:${randomUUID()}`;
    await new PgRuntimeWriter(database).append({ id: event, type: 'notification.delivered', aggregateType: 'dispatch', aggregate: row.id, scope: row.scope, payload: { dispatch: row.id, channel: row.channel }, trace: event });
  }

  async fail(context: WriteTransactionContext, dispatch: DispatchRecord, provider: string, code: string): Promise<void> {
    await this.transactions.database(context).query(
      `with failed as(update notification.dispatch set state='failed',available_at=clock_timestamp()
      where id=$1 and state='sending' returning id,scope_id,member_id) insert into notification.attempt
      (id,dispatch_id,scope_id,member_id,provider,state,error_code,attempted_at)
      select $2,id,scope_id,member_id,$3,'failed',$4,clock_timestamp() from failed`,
      [`${dispatch.id}`, `attempt:${randomUUID()}`, provider, code]
    );
  }

  async challenge(context: ReadTransactionContext, id: string): Promise<ChallengeRecord | null> {
    return this.identity.challenge(context, id);
  }

  async beginChallengeAttempt(context: WriteTransactionContext, id: string, provider: string) {
    return this.identity.beginAttempt(context, id, provider);
  }
  async completeChallengeAttempt(context: WriteTransactionContext, id: string, sequence: number, provider: string, external: string): Promise<boolean> {
    return this.identity.completeAttempt(context, id, sequence, provider, external);
  }
  async failChallengeAttempt(context: WriteTransactionContext, id: string, sequence: number, code: string): Promise<void> {
    await this.identity.failAttempt(context, id, sequence, code);
  }
  async ambiguousChallengeAttempt(context: WriteTransactionContext, id: string, sequence: number, code: string): Promise<void> {
    await this.identity.ambiguousAttempt(context, id, sequence, code);
  }
}
