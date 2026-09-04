import { array, boolean, discriminatedUnion, literal, null as nullSchema, optional, record, strictObject, string, union } from 'zod/mini';
import { ContractJsonValueSchema } from './JsonSchema';
import { isoUtc, pageOutput, pageQuery, version } from './Primitives';

const nullableText = union([string(), nullSchema()]);
const nullableTime = union([isoUtc, nullSchema()]);
const channel = literal(['sms', 'email', 'wechat', 'inapp']);
const authorization = literal(['unknown', 'accepted', 'rejected']);
const notification = strictObject({ id: string(), kind: literal(['dispatch', 'announcement']), event_type: string(), channel, subject: nullableText, body: string(), state: string(), created_at: isoUtc, read_at: nullableTime });
const preference = strictObject({ channel, event_type: string(), provider_template: nullableText, enabled: boolean(), authorization_state: authorization, authorized_at: nullableTime, cursor_id: string() });
const changedPreference = strictObject({ member_id: string(), channel, event_type: string(), enabled: boolean(), updated_at: isoUtc, authorization_state: authorization, authorized_at: nullableTime });
const template = strictObject({
  id: string(),
  scope_id: string(),
  channel,
  event_type: string(),
  version,
  variable_schema: record(string(), ContractJsonValueSchema),
  provider_template: nullableText,
  subject: nullableText,
  body: string(),
  status: literal(['draft', 'active', 'retired']),
  created_at: isoUtc,
});
const audience = discriminatedUnion('kind', [strictObject({ kind: literal('all') }), strictObject({ kind: literal('members'), members: array(string()) })]);
const announcementRead = strictObject({
  id: string(),
  title: string(),
  body: string(),
  audience,
  state: literal(['draft', 'published', 'retired']),
  starts_at: isoUtc,
  ends_at: nullableTime,
  version,
  created_at: isoUtc,
  updated_at: isoUtc,
});
const announcement = strictObject({ ...announcementRead.shape, scope_id: string() });

export const NOTIFICATION_BODY_SCHEMAS = {
  NotificationNotificationsAckInput: strictObject({}),
  NotificationPreferencesManageInput: strictObject({ enabled: boolean(), authorization: optional(literal(['accepted', 'rejected'])) }),
  NotificationEndpointsManageInput: strictObject({ enabled: boolean(), authorization: optional(literal('accepted')), address: optional(string()) }),
  NotificationTemplatesManageInput: strictObject({
    channel,
    eventType: string(),
    version,
    variables: record(string(), ContractJsonValueSchema),
    providerTemplate: optional(nullableText),
    subject: optional(nullableText),
    body: string(),
    status: optional(literal(['draft', 'active', 'retired'])),
  }),
  NotificationAnnouncementsManageInput: strictObject({ title: string(), body: string(), audience, startsAt: isoUtc, endsAt: optional(nullableTime), state: literal(['draft', 'published', 'retired']) }),
} as const;

export const NOTIFICATION_QUERY_SCHEMAS = {
  NotificationNotificationsReadInput: strictObject(pageQuery),
  NotificationPreferencesReadInput: strictObject(pageQuery),
  NotificationTemplatesReadInput: strictObject({ ...pageQuery, channel: optional(channel) }),
  NotificationAnnouncementsReadInput: strictObject(pageQuery),
} as const;

export const NOTIFICATION_OUTPUT_SCHEMAS = {
  NotificationNotificationsReadOutput: pageOutput(notification),
  NotificationPreferencesReadOutput: pageOutput(preference),
  NotificationNotificationsAckOutput: strictObject({ id: string(), readAt: isoUtc }),
  NotificationPreferencesManageOutput: changedPreference,
  NotificationEndpointsManageOutput: union([
    strictObject({ member_id: string(), channel: literal(['sms', 'email', 'wechat']), consent_at: isoUtc, revoked_at: nullSchema() }),
    strictObject({ member_id: string(), channel: literal(['sms', 'email', 'wechat']), revoked_at: isoUtc }),
    strictObject({}),
  ]),
  NotificationTemplatesManageOutput: strictObject({ ...template.shape, matches: boolean(), inserted: boolean() }),
  NotificationTemplatesReadOutput: pageOutput(template),
  NotificationAnnouncementsReadOutput: pageOutput(announcementRead),
  NotificationAnnouncementsManageOutput: announcement,
} as const;
