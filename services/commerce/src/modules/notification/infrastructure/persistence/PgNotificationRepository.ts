import { randomUUID } from 'node:crypto';
import type { QueryResult, QueryResultRow } from 'pg';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { DeliveryReceipt } from '../../application/port/DeliveryChannel';
import type { ChallengeRecord, DispatchRecord, EndpointRecord, MemberContext, NotificationRepository, QueuedDispatch, TemplateRecord } from '../../application/port/NotificationRepository';
import type { DeliveryChannelId } from '../../domain/model/Template';
import type { NotificationIdentityPort } from '../../../identity/public/index';
import type { MemberAccessPort } from '../../../access/public';
import type { OrganizationReadPort } from '../../../organization/public';

export class PgNotificationRepository implements NotificationRepository {
  constructor(
    private readonly database: OperationDatabase,
    private readonly identity: NotificationIdentityPort,
    private readonly members: MemberAccessPort,
    private readonly organizations: OrganizationReadPort
  ) {}

  async member(membership: string): Promise<MemberContext> {
    const member = await this.members.profile(this.database, membership);
    if (member.status !== 'active') throw new Error('MEMBERSHIP_NOT_FOUND');
    return Object.freeze({ member: member.member, organization: member.organization });
  }

  async preferences(member: string, organization: string, cursor: string | null, fetch: number): Promise<QueryResult<QueryResultRow>> {
    const scopes = await this.notificationScopes(organization);
    return this.database.query(
      `select selected.channel,selected.event_type,selected.provider_template,selected.enabled,
      selected.authorization_state,selected.authorized_at,selected.cursor_id
      from(select distinct on(template.channel,template.event_type) template.channel,template.event_type,
      template.provider_template,coalesce(preference.enabled,true) enabled,coalesce(preference.authorization_state,'unknown') authorization_state,
      preference.authorized_at,template.channel||':'||template.event_type cursor_id from notification.template template
      left join notification.preference preference on preference.member_id=$1 and preference.channel=template.channel
      and preference.event_type=template.event_type where template.scope_id=any($2::text[]) and template.status='active'
      order by template.channel,template.event_type,array_position($2::text[],template.scope_id),template.version desc) selected
      where($3::text is null or cursor_id>$3) order by cursor_id limit $4`,
      [member, scopes, cursor, fetch]
    );
  }

  async changePreference(member: string, organization: string, channel: DeliveryChannelId, event: string, enabled: boolean, authorization: string) {
    const scopes = await this.notificationScopes(organization);
    return this.database.query(
      `insert into notification.preference(member_id,channel,event_type,enabled,authorization_state,authorized_at,updated_at)
      select $1,$3,$4,$5,$6,case when $6='accepted' then clock_timestamp() else null end,clock_timestamp()
      where exists(select 1 from notification.template template where template.scope_id=any($2::text[])
        and template.channel=$3 and template.event_type=$4 and template.status='active')
      on conflict(member_id,channel,event_type) do update set enabled=excluded.enabled,authorization_state=excluded.authorization_state,
      authorized_at=excluded.authorized_at,updated_at=excluded.updated_at returning *`,
      [member, scopes, channel, event, enabled, authorization]
    );
  }

  wechatIdentity(membership: string) {
    return this.identity.recipient(this.database, membership);
  }

  revokeEndpoint(member: string, channel: DeliveryChannelId) {
    return this.database.query(
      `update notification.endpoint set revoked_at=clock_timestamp() where member_id=$1 and channel=$2
      and revoked_at is null returning member_id,channel,revoked_at`,
      [member, channel]
    );
  }

  saveEndpoint(member: string, channel: DeliveryChannelId, envelope: Readonly<{ ciphertext: string; fingerprint: string; keyVersion: string }>) {
    return this.database.query(
      `insert into notification.endpoint(member_id,channel,address_ciphertext,address_token,address_key_version,consent_at,revoked_at)
      values($1,$2,$3,$4,$5,clock_timestamp(),null) on conflict(member_id,channel) do update set address_ciphertext=excluded.address_ciphertext,
      address_token=excluded.address_token,address_key_version=excluded.address_key_version,consent_at=excluded.consent_at,revoked_at=null
      returning member_id,channel,consent_at,revoked_at`,
      [member, channel, envelope.ciphertext, envelope.fingerprint, envelope.keyVersion]
    );
  }

  notifications(membership: string, includeScope: boolean, cursorTime: string | null, cursorId: string | null, fetch: number) {
    return this.database.query(
      `select visible.id,visible.kind,visible.event_type,visible.channel,visible.subject,visible.body,visible.state,
      visible.created_at,receipt.read_at from notification.visible_notifications($1,$2) visible
      left join notification.receipt receipt on receipt.member_id=visible.member_id and receipt.notification_id=visible.id
      where ($3::timestamptz is null or(visible.created_at,visible.id)<($3::timestamptz,$4))
      order by visible.created_at desc,visible.id desc limit $5`,
      [membership, includeScope, cursorTime, cursorId, fetch]
    );
  }

  acknowledge(membership: string, notification: string) {
    return this.database.query<{ id: string; readAt: Date }>(
      `with visible as(select member_id,id,kind from notification.visible_notifications($1,false) where id=$2),
      saved as(insert into notification.receipt(member_id,notification_id,kind,read_at)
        select member_id,id,kind,clock_timestamp() from visible on conflict(member_id,notification_id)
        do update set read_at=notification.receipt.read_at returning notification_id id,read_at "readAt")
      select id,"readAt" from saved`,
      [membership, notification]
    );
  }

  templates(scope: string, cursor: string | null, fetch: number) {
    return this.database.query<TemplateRecord>(
      `select id,scope_id,channel,event_type,version,variable_schema,provider_template,subject,body,status,created_at
      from notification.template where scope_id=$1 and($2::text is null or id>$2) order by id limit $3`,
      [scope, cursor, fetch]
    );
  }

  saveTemplate(input: Omit<TemplateRecord, 'created_at'>) {
    return this.database.query<TemplateRecord & { matches: boolean; inserted: boolean }>(
      `with existing as materialized(
      select id,scope_id,channel,event_type,version,variable_schema,provider_template,subject,body,status,created_at
      from notification.template where id=$1), saved as(
      insert into notification.template(id,scope_id,channel,event_type,version,variable_schema,provider_template,subject,body,status,created_at)
      values($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,clock_timestamp()) on conflict(id) do update set status=excluded.status
      where notification.template.scope_id=$2 and notification.template.channel=$3 and notification.template.event_type=$4
        and notification.template.version=$5 and notification.template.variable_schema=$6::jsonb
        and notification.template.provider_template is not distinct from $7 and notification.template.subject is not distinct from $8
        and notification.template.body=$9 and(notification.template.status=excluded.status or notification.template.status='draft'
          and excluded.status in('active','retired') or notification.template.status='active' and excluded.status='retired') returning *)
      select saved.id,saved.scope_id,saved.channel,saved.event_type,saved.version,saved.variable_schema,saved.provider_template,
        saved.subject,saved.body,saved.status,saved.created_at,true matches,not exists(select 1 from existing) inserted from saved union all
      select existing.id,existing.scope_id,existing.channel,existing.event_type,existing.version,existing.variable_schema,
        existing.provider_template,existing.subject,existing.body,existing.status,existing.created_at,false matches,false inserted
        from existing where not exists(select 1 from saved)`,
      [input.id, input.scope_id, input.channel, input.event_type, input.version, JSON.stringify(input.variable_schema), input.provider_template, input.subject, input.body, input.status]
    );
  }

  announcements(scope: string, cursor: string | null, fetch: number) {
    return this.database.query(
      `select id,title,body,audience,state,starts_at,ends_at,version,created_at,updated_at
      from notification.announcement where scope_id=$1 and($2::text is null or id>$2) order by id limit $3`,
      [scope, cursor, fetch]
    );
  }

  saveAnnouncement(input: Readonly<{ id: string; scope: string; title: string; body: string; audience: unknown; state: string; startsAt: string; endsAt: string | null; expected: number | null }>) {
    return this.database.query(
      `insert into notification.announcement(id,scope_id,title,body,audience,state,starts_at,ends_at,version,created_at,updated_at)
      values($1,$2,$3,$4,$5::jsonb,$6,$7,$8,0,clock_timestamp(),clock_timestamp()) on conflict(id) do update set title=excluded.title,
      body=excluded.body,audience=excluded.audience,state=excluded.state,starts_at=excluded.starts_at,ends_at=excluded.ends_at,
      version=notification.announcement.version+1,updated_at=clock_timestamp() where notification.announcement.scope_id=$2
      and $9::bigint is not null and notification.announcement.version=$9 returning *`,
      [input.id, input.scope, input.title, input.body, JSON.stringify(input.audience), input.state, input.startsAt, input.endsAt, input.expected]
    );
  }

  jobScope(job: string) {
    return this.database.query<{ scope_id: string | null }>('select scope_id from runtime.job where id=$1', [job]);
  }

  async eventTemplates(scope: string, event: string, member: string | null) {
    const scopes = await this.notificationScopes(scope);
    return this.database.query<TemplateRecord>(
      `select distinct on(template.channel) template.* from notification.template template left join notification.preference preference
      on preference.member_id=$2 and preference.channel=template.channel and preference.event_type=template.event_type
      where template.scope_id=any($1::text[]) and template.event_type=$3 and template.status='active'
      and($2::text is not null or template.channel='inapp') and coalesce(preference.enabled,true)
      and(template.channel<>'wechat' or preference.authorization_state='accepted')
      order by template.channel,array_position($1::text[],template.scope_id),template.version desc`,
      [scopes, member, event]
    );
  }

  private async notificationScopes(scope: string): Promise<readonly string[]> {
    const snapshot = await this.organizations.scope(this.database, scope);
    return Object.freeze([snapshot.id, ...snapshot.ancestors]);
  }

  endpoint(member: string, channel: DeliveryChannelId) {
    return this.database.query<EndpointRecord>(
      `select address_ciphertext,address_token from notification.endpoint
      where member_id=$1 and channel=$2 and revoked_at is null`,
      [member, channel]
    );
  }

  queue(input: QueuedDispatch): Promise<QueryResult<QueryResultRow>> {
    return this.database.query(
      `with queued as(insert into notification.dispatch(id,scope_id,member_id,template_id,channel,recipient_token,
      recipient_ciphertext,recipient_key_version,recipient_ref,payload,subject,body,state,idempotency_key,available_at,created_at)
      values($1,$2,$3,$4,(select channel from notification.template where id=$4),$5,$6,$7,$8,$9::jsonb,$10,$11,'queued',$12,
        clock_timestamp(),clock_timestamp()) on conflict(scope_id,idempotency_key) do nothing returning id),
      job as(insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
        select $13,'notification','notification',$2,jsonb_build_object('dispatch',id),'queued',20,clock_timestamp(),clock_timestamp(),clock_timestamp()
        from queued returning id) select id from queued`,
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
        input.idempotency,
        `job:${randomUUID()}`,
      ]
    );
  }

  completeInbox(event: string) {
    return this.database.query(
      `update runtime.inbox set processed_at=clock_timestamp(),attempts=attempts+1
      where consumer='job:notification' and event_id=$1 and processed_at is null`,
      [event]
    );
  }

  claim(id: string) {
    return this.database.query<DispatchRecord>(
      `update notification.dispatch dispatch set state='sending' from notification.template template
      where dispatch.id=$1 and template.id=dispatch.template_id and dispatch.state in('queued','failed')
      returning dispatch.id,dispatch.scope_id,dispatch.member_id,dispatch.template_id,dispatch.channel,template.event_type,template.version,
        template.provider_template,template.variable_schema,dispatch.subject,dispatch.body,dispatch.payload,dispatch.recipient_ciphertext,
        dispatch.recipient_ref,template.status`,
      [id]
    );
  }

  complete(dispatch: DispatchRecord, receipt: DeliveryReceipt) {
    return this.database.query(
      `with completed as(update notification.dispatch set state='sent' where id=$1 and state='sending' returning id,scope_id,channel),
      attempted as(insert into notification.attempt(id,dispatch_id,scope_id,member_id,provider,external_id,state,attempted_at)
        select $2,completed.id,completed.scope_id,$3,$4,$5,'sent',clock_timestamp() from completed),
      published as(insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
        select $6,'notification.delivered',1,'dispatch',id,scope_id,jsonb_build_object('dispatch',id,'channel',channel),$6,
        clock_timestamp(),clock_timestamp() from completed) select id from completed`,
      [dispatch.id, `attempt:${randomUUID()}`, dispatch.member_id, receipt.provider, receipt.externalId, `event:${randomUUID()}`]
    );
  }

  fail(dispatch: DispatchRecord, provider: string, code: string) {
    return this.database.query(
      `with failed as(update notification.dispatch set state='failed',available_at=clock_timestamp()
      where id=$1 and state='sending' returning id,scope_id,member_id) insert into notification.attempt
      (id,dispatch_id,scope_id,member_id,provider,state,error_code,attempted_at)
      select $2,id,scope_id,member_id,$3,'failed',$4,clock_timestamp() from failed`,
      [`${dispatch.id}`, `attempt:${randomUUID()}`, provider, code]
    );
  }

  challenge(id: string) {
    return this.identity.challenge(this.database, id);
  }

  beginChallengeAttempt(id: string, provider: string) {
    return this.identity.beginAttempt(this.database, id, provider);
  }
  completeChallengeAttempt(id: string, sequence: number, provider: string, external: string) {
    return this.identity.completeAttempt(this.database, id, sequence, provider, external);
  }
  failChallengeAttempt(id: string, sequence: number, code: string) {
    return this.identity.failAttempt(this.database, id, sequence, code);
  }
  ambiguousChallengeAttempt(id: string, sequence: number, code: string) {
    return this.identity.ambiguousAttempt(this.database, id, sequence, code);
  }
}
