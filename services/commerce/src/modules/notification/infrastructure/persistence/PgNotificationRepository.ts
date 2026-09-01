import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { MemberAccessPort } from '../../../access/public';
import type { NotificationIdentityPort } from '../../../identity/public';
import type { OrganizationReadPort } from '../../../organization/public';
import type { NotificationRepository, NotificationTemplate, SavedTemplate, WechatRecipient } from '../../application/port/NotificationRepository';
import type { DeliveryChannelId } from '../../domain/model/Template';
interface TemplateRow {
  readonly id: string;
  readonly scope_id: string;
  readonly channel: DeliveryChannelId;
  readonly event_type: string;
  readonly version: number;
  readonly variable_schema: NotificationTemplate['variableSchema'];
  readonly provider_template: string | null;
  readonly subject: string | null;
  readonly body: string;
  readonly status: NotificationTemplate['status'];
  readonly created_at: string;
}
export class PgNotificationRepository implements NotificationRepository {
  constructor(
    private readonly transactions: PgTransactionAccess,
    private readonly identity: NotificationIdentityPort,
    private readonly members: MemberAccessPort,
    private readonly organizations: OrganizationReadPort
  ) {}
  async member(context: ReadTransactionContext, membership: string) {
    const database = this.transactions.database(context);
    const member = await this.members.profile(context, membership);
    if (member.status !== 'active') throw new Error('MEMBERSHIP_NOT_FOUND');
    return Object.freeze({ member: member.member, organization: member.organization });
  }
  async preferences(context: ReadTransactionContext, member: string, organization: string, cursor: string | null, fetch: number) {
    const database = this.transactions.database(context);
    const scopes = await this.notificationScopes(context, organization);
    const result = await database.query(
      `select selected.channel,selected.event_type,selected.provider_template,selected.enabled,
      selected.authorization_state,selected.authorized_at,selected.cursor_id from(
      select distinct on(template.channel,template.event_type) template.channel,template.event_type,
      template.provider_template,coalesce(preference.enabled,true) enabled,coalesce(preference.authorization_state,'unknown') authorization_state,
      preference.authorized_at,template.channel||':'||template.event_type cursor_id from notification.template template
      left join notification.preference preference on preference.member_id=$1 and preference.channel=template.channel
      and preference.event_type=template.event_type where template.scope_id=any($2::text[]) and template.status='active'
      order by template.channel,template.event_type,array_position($2::text[],template.scope_id),template.version desc) selected
      where($3::text is null or cursor_id>$3) order by cursor_id limit $4`,
      [member, scopes, cursor, fetch]
    );
    return result.rows.map((row) => Object.freeze({ ...row }));
  }
  async changePreference(context: WriteTransactionContext, member: string, organization: string, channel: DeliveryChannelId, event: string, enabled: boolean, authorization: string) {
    const database = this.transactions.database(context);
    const scopes = await this.notificationScopes(context, organization);
    const result = await database.query(
      `insert into notification.preference(member_id,channel,event_type,enabled,authorization_state,authorized_at,updated_at)
      select $1,$3,$4,$5,$6,case when $6='accepted' then clock_timestamp() else null end,clock_timestamp()
      where exists(select 1 from notification.template template where template.scope_id=any($2::text[])
        and template.channel=$3 and template.event_type=$4 and template.status='active')
      on conflict(member_id,channel,event_type) do update set enabled=excluded.enabled,authorization_state=excluded.authorization_state,
      authorized_at=excluded.authorized_at,updated_at=excluded.updated_at returning *`,
      [member, scopes, channel, event, enabled, authorization]
    );
    return result.rows[0] ? Object.freeze({ ...result.rows[0] }) : null;
  }
  async wechatRecipient(context: ReadTransactionContext, membership: string): Promise<WechatRecipient | null> {
    const database = this.transactions.database(context);
    return this.identity.recipient(context, membership);
  }
  async revokeEndpoint(context: WriteTransactionContext, member: string, channel: DeliveryChannelId) {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query(
      `update notification.endpoint set revoked_at=clock_timestamp() where member_id=$1 and channel=$2
      and revoked_at is null returning member_id,channel,revoked_at`,
      [member, channel]
    );
    return result.rows[0] ? Object.freeze({ ...result.rows[0] }) : null;
  }
  async saveEndpoint(
    context: WriteTransactionContext,
    member: string,
    channel: DeliveryChannelId,
    envelope: Readonly<{
      ciphertext: string;
      fingerprint: string;
      keyVersion: string;
    }>
  ) {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query(
      `insert into notification.endpoint(member_id,channel,address_ciphertext,address_token,address_key_version,consent_at,revoked_at)
      values($1,$2,$3,$4,$5,clock_timestamp(),null) on conflict(member_id,channel) do update set address_ciphertext=excluded.address_ciphertext,
      address_token=excluded.address_token,address_key_version=excluded.address_key_version,consent_at=excluded.consent_at,revoked_at=null
      returning member_id,channel,consent_at,revoked_at`,
      [member, channel, envelope.ciphertext, envelope.fingerprint, envelope.keyVersion]
    );
    return Object.freeze({ ...result.rows[0]! });
  }
  async notifications(context: ReadTransactionContext, membership: string, includeScope: boolean, cursorTime: string | null, cursorId: string | null, fetch: number) {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query(
      `select visible.id,visible.kind,visible.event_type,visible.channel,visible.subject,visible.body,visible.state,
      visible.created_at,receipt.read_at from notification.visible_notifications($1,$2) visible
      left join notification.receipt receipt on receipt.member_id=visible.member_id and receipt.notification_id=visible.id
      where ($3::timestamptz is null or(visible.created_at,visible.id)<($3::timestamptz,$4))
      order by visible.created_at desc,visible.id desc limit $5`,
      [membership, includeScope, cursorTime, cursorId, fetch]
    );
    return result.rows.map((row) => Object.freeze({ ...row }));
  }
  async acknowledge(context: WriteTransactionContext, membership: string, notification: string) {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<{
      id: string;
      readAt: Date;
    }>(
      `with visible as(select member_id,id,kind from notification.visible_notifications($1,false) where id=$2),
      saved as(insert into notification.receipt(member_id,notification_id,kind,read_at)
        select member_id,id,kind,clock_timestamp() from visible on conflict(member_id,notification_id)
        do update set read_at=notification.receipt.read_at returning notification_id id,read_at "readAt")
      select id,"readAt" from saved`,
      [membership, notification]
    );
    const row = result.rows[0];
    return row ? Object.freeze({ id: row.id, readAt: row.readAt.toISOString() }) : null;
  }
  async templates(context: ReadTransactionContext, scope: string, cursor: string | null, fetch: number) {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<TemplateRow>(
      `select id,scope_id,channel,event_type,version,variable_schema,provider_template,subject,body,status,created_at
      from notification.template where scope_id=$1 and($2::text is null or id>$2) order by id limit $3`,
      [scope, cursor, fetch]
    );
    return result.rows.map(template);
  }
  async saveTemplate(context: WriteTransactionContext, input: Omit<NotificationTemplate, 'createdAt'>): Promise<SavedTemplate | null> {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<
      TemplateRow & {
        matches: boolean;
        inserted: boolean;
      }
    >(
      `with existing as materialized(select id,scope_id,channel,event_type,version,variable_schema,provider_template,subject,body,status,created_at
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
      select existing.id,existing.scope_id,existing.channel,existing.event_type,existing.version,existing.variable_schema,existing.provider_template,
        existing.subject,existing.body,existing.status,existing.created_at,false matches,false inserted from existing where not exists(select 1 from saved)`,
      [input.id, input.scopeId, input.channel, input.eventType, input.version, JSON.stringify(input.variableSchema), input.providerTemplate, input.subject, input.body, input.status]
    );
    const row = result.rows[0];
    return row ? Object.freeze({ ...template(row), matches: row.matches, inserted: row.inserted }) : null;
  }
  async announcements(context: ReadTransactionContext, scope: string, cursor: string | null, fetch: number) {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query(
      `select id,title,body,audience,state,starts_at,ends_at,version,created_at,updated_at
      from notification.announcement where scope_id=$1 and($2::text is null or id>$2) order by id limit $3`,
      [scope, cursor, fetch]
    );
    return result.rows.map((row) => Object.freeze({ ...row }));
  }
  async saveAnnouncement(
    context: WriteTransactionContext,
    input: Readonly<{
      id: string;
      scope: string;
      title: string;
      body: string;
      audience: unknown;
      state: string;
      startsAt: string;
      endsAt: string | null;
      expected: number | null;
    }>
  ) {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query(
      `insert into notification.announcement(id,scope_id,title,body,audience,state,starts_at,ends_at,version,created_at,updated_at)
      values($1,$2,$3,$4,$5::jsonb,$6,$7,$8,0,clock_timestamp(),clock_timestamp()) on conflict(id) do update set title=excluded.title,
      body=excluded.body,audience=excluded.audience,state=excluded.state,starts_at=excluded.starts_at,ends_at=excluded.ends_at,
      version=notification.announcement.version+1,updated_at=clock_timestamp() where notification.announcement.scope_id=$2
      and $9::bigint is not null and notification.announcement.version=$9 returning *`,
      [input.id, input.scope, input.title, input.body, JSON.stringify(input.audience), input.state, input.startsAt, input.endsAt, input.expected]
    );
    return result.rows[0] ? Object.freeze({ ...result.rows[0] }) : null;
  }
  private async notificationScopes(context: ReadTransactionContext, scope: string): Promise<readonly string[]> {
    const snapshot = await this.organizations.scope(context, scope);
    return Object.freeze([snapshot.id, ...snapshot.ancestors]);
  }
}
function template(row: TemplateRow): NotificationTemplate {
  return Object.freeze({
    id: row.id,
    scopeId: row.scope_id,
    channel: row.channel,
    eventType: row.event_type,
    version: row.version,
    variableSchema: row.variable_schema,
    providerTemplate: row.provider_template,
    subject: row.subject,
    body: row.body,
    status: row.status,
    createdAt: row.created_at,
  });
}
