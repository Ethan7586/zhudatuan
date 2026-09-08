import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { randomUUID } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../platform/database/PgRuntimeWriter';

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
      `select distinct on(template.channel) template.id,template.scope_id,template.channel,template.event_type,template.version,
      template.variable_schema,template.provider_template,template.subject,template.body,template.status,template.created_at,template.purpose,template.mandatory,
      coalesce(preference.enabled,true) preference_enabled,
      case when template.channel='wechat' then case when endpoint.member_id is null then 'unknown'
        when endpoint.revoked_at is null then 'accepted' else 'rejected' end else 'unknown' end authorization_state,
      case when template.channel='wechat' and endpoint.member_id is not null then endpoint.consent_source
        else coalesce(preference.consent_source,'system') end consent_source,preference.quiet_start::text,preference.quiet_end::text,
      preference.quiet_timezone,coalesce(preference.version,0) preference_version
      from notification.template template left join notification.preference preference
      on preference.member_id=$2 and preference.channel=template.channel and preference.event_type=template.event_type
      left join notification.endpoint endpoint on endpoint.member_id=$2 and endpoint.channel=template.channel
      where template.scope_id=any($1::text[]) and template.event_type=$3 and template.status='active'
      and($2::text is not null or template.channel='inapp')
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
      recipient_ciphertext,recipient_key_version,recipient_ref,payload,subject,body,event_type,template_version,provider_template,
      variable_schema,purpose,mandatory,state,idempotency_key,available_at,attempt_count,max_attempts,created_at)
      values($1,$2,$3,$4,(select channel from notification.template where id=$4),$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,
      $15::jsonb,$16,$17,'queued',$18,$19,0,5,clock_timestamp()) on conflict(scope_id,idempotency_key) do nothing returning id`,
      [
        input.id,
        input.scope,
        input.member,
        input.template,
        input.recipientToken,
        input.recipientCiphertext,
        input.recipientKeyVersion,
        input.recipientRef,
        JSON.stringify(input.variables),
        input.subject,
        input.body,
        input.event,
        input.templateVersion,
        input.providerTemplate,
        JSON.stringify(input.variableSchema),
        input.purpose,
        input.mandatory,
        input.idempotency,
        input.availableAt,
      ]
    );
    if (queued.rows[0])
      await new PgRuntimeWriter(database).schedule({
        id: `job:notification:${randomUUID()}`,
        kind: 'notification',
        owner: 'notification',
        scope: input.scope,
        payload: { dispatch: queued.rows[0].id },
        priority: 20,
        availableAt: input.availableAt,
      });
  }

  async completeInbox(context: WriteTransactionContext, event: string): Promise<void> {
    if (!(await new PgRuntimeWriter(this.transactions.database(context)).completeInbox('job:notification', event))) throw new Error('NOTIFICATION_INBOX_LEASE_LOST');
  }

  async claim(context: WriteTransactionContext, id: string): Promise<DispatchRecord | null> {
    const result = await this.transactions.database(context).query<DispatchRecord>(
      `with claimed as(
        update notification.dispatch set state='sending',attempt_count=attempt_count+1,last_attempt_at=clock_timestamp()
        where id=$1 and state in('queued','retrying') and available_at<=clock_timestamp() and attempt_count<max_attempts
        returning id,scope_id,member_id,template_id,channel,event_type,template_version,provider_template,variable_schema,subject,body,
          payload,recipient_ciphertext,recipient_ref,purpose,mandatory,attempt_count attempt_sequence,max_attempts
      ) select claimed.id,claimed.scope_id,claimed.member_id,claimed.template_id,claimed.channel,claimed.event_type,
        claimed.template_version,claimed.provider_template,claimed.variable_schema,claimed.subject,claimed.body,claimed.payload,
        claimed.recipient_ciphertext,claimed.recipient_ref,claimed.purpose,claimed.mandatory,claimed.attempt_sequence,claimed.max_attempts,
        coalesce(preference.enabled,true) preference_enabled,
        case when claimed.channel='wechat' then case when endpoint.member_id is null then 'unknown'
          when endpoint.revoked_at is null then 'accepted' else 'rejected' end else 'unknown' end authorization_state,
        case when claimed.channel='wechat' and endpoint.member_id is not null then endpoint.consent_source
          else coalesce(preference.consent_source,'system') end consent_source,
        preference.quiet_start::text,preference.quiet_end::text,preference.quiet_timezone,
        coalesce(preference.version,0) preference_version
      from claimed left join notification.preference preference on preference.member_id=claimed.member_id
        and preference.channel=claimed.channel and preference.event_type=claimed.event_type
      left join notification.endpoint endpoint on endpoint.member_id=claimed.member_id and endpoint.channel=claimed.channel`,
      [id]
    );
    return result.rows[0] ? Object.freeze(result.rows[0]) : null;
  }

  async complete(context: WriteTransactionContext, dispatch: DispatchRecord, receipt: DeliveryReceipt, route: number): Promise<void> {
    const database = this.transactions.database(context);
    const completed = await database.query<{ id: string; scope: string; channel: string; fresh: boolean }>(
      `with selected as(select id,scope_id,member_id,channel,state from notification.dispatch where id=$1 and state in('sending','sent')),
      receipt as(insert into notification.providerreceipt(id,dispatch_id,scope_id,provider,external_id,received_at)
        select $2,id,scope_id,$3,$4,clock_timestamp() from selected where state='sending'
        on conflict(provider,external_id) do nothing returning dispatch_id),
      accepted as(select dispatch_id from receipt union all select existing.dispatch_id from notification.providerreceipt existing
        join selected on selected.id=existing.dispatch_id where existing.provider=$3 and existing.external_id=$4 and not exists(select 1 from receipt)),
      completed as(update notification.dispatch dispatch set state='sent',last_error_class=null,last_error_code=null
        from accepted where dispatch.id=accepted.dispatch_id and dispatch.state='sending' returning dispatch.id,dispatch.scope_id,dispatch.member_id,dispatch.channel)
      ,attempted as(insert into notification.attempt(id,dispatch_id,scope_id,member_id,provider,external_id,state,sequence,route_index,attempted_at)
      select $5,completed.id,completed.scope_id,completed.member_id,$3,$4,'sent',$6,$7,clock_timestamp() from completed
      returning dispatch_id)
      select completed.id,completed.scope_id scope,completed.channel,true fresh from completed
      union all select selected.id,selected.scope_id,selected.channel,false fresh from selected join accepted on accepted.dispatch_id=selected.id
      where selected.state='sent' and not exists(select 1 from completed)`,
      [dispatch.id, `receipt:${randomUUID()}`, receipt.provider, receipt.externalId, `attempt:${randomUUID()}`, dispatch.attempt_sequence, route]
    );
    const row = completed.rows[0];
    if (!row) throw new Error('NOTIFICATION_DELIVERY_STATE_LOST');
    if (row.fresh) {
      const event = `event:${randomUUID()}`;
      await new PgRuntimeWriter(database).append({ id: event, type: 'notification.delivered', aggregateType: 'dispatch', aggregate: row.id, scope: row.scope, payload: { dispatch: row.id, channel: row.channel }, trace: event });
    }
  }

  async recordFailure(context: WriteTransactionContext, dispatch: DispatchRecord, provider: string, route: number, failure: Readonly<{ kind: import('../../domain/model/Dispatch').DeliveryFailureClass; code: string }>): Promise<void> {
    await this.transactions.database(context).query(
      `insert into notification.attempt(id,dispatch_id,scope_id,member_id,provider,state,error_class,error_code,sequence,route_index,attempted_at)
      select $2,id,scope_id,member_id,$3,case when $5='ambiguous' then 'ambiguous' else 'failed' end,$5,$6,$7,$4,clock_timestamp()
      from notification.dispatch where id=$1 and state='sending'`,
      [dispatch.id, `attempt:${randomUUID()}`, provider, route, failure.kind, failure.code, dispatch.attempt_sequence]
    );
  }

  async fail(context: WriteTransactionContext, dispatch: DispatchRecord, provider: string, route: number, failure: Readonly<{ kind: import('../../domain/model/Dispatch').DeliveryFailureClass; code: string }>): Promise<boolean> {
    const result = await this.transactions.database(context).query<{ terminal: boolean }>(
      `with failed as(update notification.dispatch set
        state=case when $5 in('permanent','ambiguous') or attempt_count>=max_attempts then 'dead' else 'retrying' end,
        available_at=case when $5 in('permanent','ambiguous') or attempt_count>=max_attempts then available_at
          else clock_timestamp()+make_interval(secs=>least(3600,(2^least(attempt_count,10))*15)::integer) end,
        last_error_class=$5,last_error_code=$6
      where id=$1 and state='sending' returning id,scope_id,member_id,attempt_count,max_attempts,state='dead' terminal)
      insert into notification.attempt(id,dispatch_id,scope_id,member_id,provider,state,error_class,error_code,sequence,route_index,attempted_at)
      select $2,id,scope_id,member_id,$3,case when $5='ambiguous' then 'ambiguous' else 'failed' end,$5,$6,attempt_count,$4,clock_timestamp()
      from failed returning (select terminal from failed) terminal`,
      [dispatch.id, `attempt:${randomUUID()}`, provider, route, failure.kind, failure.code]
    );
    if (!result.rows[0]) throw new Error('NOTIFICATION_DELIVERY_STATE_LOST');
    return result.rows[0].terminal;
  }

  async cancel(context: WriteTransactionContext, dispatch: DispatchRecord, reason: string): Promise<void> {
    const result = await this.transactions.database(context).query(
      `update notification.dispatch set state='cancelled',attempt_count=greatest(0,attempt_count-1),last_error_class='permanent',last_error_code=$2
      where id=$1 and state='sending'`,
      [dispatch.id, `NOTIFICATION_${reason.toUpperCase()}`]
    );
    if (result.rowCount !== 1) throw new Error('NOTIFICATION_DELIVERY_STATE_LOST');
  }

  async defer(context: WriteTransactionContext, dispatch: DispatchRecord, availableAt: string): Promise<void> {
    const database = this.transactions.database(context);
    const result = await database.query(
      `update notification.dispatch set state='retrying',attempt_count=greatest(0,attempt_count-1),available_at=$2,last_error_class=null,last_error_code=null
      where id=$1 and state='sending'`,
      [dispatch.id, availableAt]
    );
    if (result.rowCount !== 1) throw new Error('NOTIFICATION_DELIVERY_STATE_LOST');
    await new PgRuntimeWriter(database).schedule({ id: `job:notification:defer:${randomUUID()}`, kind: 'notification', owner: 'notification', scope: dispatch.scope_id, payload: { dispatch: dispatch.id }, priority: 30, availableAt });
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
