import type { AnnouncementChange } from './Announcement';
import type { TemplateChange } from './Template';

export type NotificationCommand = Readonly<{ kind: 'template'; change: TemplateChange; proof: string; identity: string }> | Readonly<{ kind: 'announcement'; change: AnnouncementChange; proof: string; identity: string }>;

export function templateInput(change: TemplateChange) {
  return Object.freeze({
    path: Object.freeze({ templateid: change.id }),
    body: Object.freeze({
      channel: change.channel,
      eventType: change.eventType,
      version: change.version,
      variables: change.variables,
      providerTemplate: change.providerTemplate,
      subject: change.subject,
      body: change.body,
      purpose: change.purpose,
      mandatory: change.mandatory,
      status: change.status,
    }),
  });
}

export function announcementInput(change: AnnouncementChange) {
  return Object.freeze({
    path: Object.freeze({ announcementid: change.id }),
    body: Object.freeze({ title: change.title, body: change.body, audience: change.audience, startsAt: change.startsAt, endsAt: change.endsAt, state: change.state }),
  });
}
