import { array, boolean, discriminatedUnion, literal, null as nullSchema, optional, record, strictObject, string, union } from 'zod/mini';
import { isoUtc, pageOutput, pageQuery, version } from './Primitives';
import {
  NOTIFICATION_ANNOUNCEMENT_STATES,
  NOTIFICATION_AUTHORIZATIONS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_CONSENT_SOURCES,
  NOTIFICATION_KINDS,
  NOTIFICATION_PURPOSES,
  NOTIFICATION_TEMPLATE_STATES,
  NOTIFICATION_VARIABLE_TYPES,
} from '../Vocabulary';

const nullableText = union([string(), nullSchema()]);
const nullableTime = union([isoUtc, nullSchema()]);
const channel = literal(NOTIFICATION_CHANNELS);
const authorization = literal(NOTIFICATION_AUTHORIZATIONS);
const consentSource = literal(NOTIFICATION_CONSENT_SOURCES);
const quietHours = strictObject({ start: string(), end: string(), timezone: string() });
const purpose = literal(NOTIFICATION_PURPOSES);
const templateState = literal(NOTIFICATION_TEMPLATE_STATES);
const announcementState = literal(NOTIFICATION_ANNOUNCEMENT_STATES);
const notification = strictObject({ id: string(), kind: literal(NOTIFICATION_KINDS), event_type: string(), channel, subject: nullableText, body: string(), state: string(), created_at: isoUtc, read_at: nullableTime });
const preference = strictObject({ channel, event_type: string(), provider_template: nullableText, enabled: boolean(), authorization_state: authorization, authorized_at: nullableTime, consent_source: consentSource, quiet_start: nullableText, quiet_end: nullableText, quiet_timezone: nullableText, version, cursor_id: string() });
const changedPreference = strictObject({ member_id: string(), channel, event_type: string(), enabled: boolean(), updated_at: isoUtc, authorization_state: authorization, authorized_at: nullableTime, consent_source: consentSource, quiet_start: nullableText, quiet_end: nullableText, quiet_timezone: nullableText, version });
const template = strictObject({
  id: string(),
  scope_id: string(),
  channel,
  event_type: string(),
  version,
  variable_schema: record(string(), literal(NOTIFICATION_VARIABLE_TYPES)),
  provider_template: nullableText,
  subject: nullableText,
  body: string(),
  purpose,
  mandatory: boolean(),
  status: templateState,
  created_at: isoUtc,
});
const audience = discriminatedUnion('kind', [strictObject({ kind: literal('all') }), strictObject({ kind: literal('members'), members: array(string()) })]);
const announcementRead = strictObject({
  id: string(),
  title: string(),
  body: string(),
  audience,
  state: announcementState,
  starts_at: isoUtc,
  ends_at: nullableTime,
  version,
  created_at: isoUtc,
  updated_at: isoUtc,
});
const announcement = strictObject({ ...announcementRead.shape, scope_id: string() });

export const NOTIFICATION_BODY_SCHEMAS = {
  NotificationNotificationsAckInput: strictObject({}),
  NotificationPreferencesManageInput: strictObject({ enabled: boolean(), authorization: optional(literal(['accepted', 'rejected'])), quietHours: optional(union([quietHours, nullSchema()])) }),
  NotificationEndpointsManageInput: strictObject({ enabled: boolean(), authorization: optional(literal('accepted')), address: optional(string()) }),
  NotificationTemplatesManageInput: strictObject({
    channel,
    eventType: string(),
    version,
    variables: record(string(), literal(NOTIFICATION_VARIABLE_TYPES)),
    providerTemplate: optional(nullableText),
    subject: optional(nullableText),
    body: string(),
    purpose: optional(purpose),
    mandatory: optional(boolean()),
    status: optional(templateState),
  }),
  NotificationAnnouncementsManageInput: strictObject({ title: string(), body: string(), audience, startsAt: isoUtc, endsAt: optional(nullableTime), state: announcementState }),
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
    strictObject({ member_id: string(), channel: literal(['sms', 'email', 'wechat']), consent_source: consentSource, consent_at: isoUtc, revoked_at: nullSchema(), version }),
    strictObject({ member_id: string(), channel: literal(['sms', 'email', 'wechat']), consent_source: consentSource, revoked_at: isoUtc, version }),
    strictObject({}),
  ]),
  NotificationTemplatesManageOutput: strictObject({ ...template.shape, matches: boolean(), inserted: boolean() }),
  NotificationTemplatesReadOutput: pageOutput(template),
  NotificationAnnouncementsReadOutput: pageOutput(announcementRead),
  NotificationAnnouncementsManageOutput: announcement,
} as const;
