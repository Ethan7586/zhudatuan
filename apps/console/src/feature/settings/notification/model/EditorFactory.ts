import type { Announcement } from './Announcement';
import { localTime } from '../../../../shared/format/Date';
import type { AnnouncementEditor, TemplateEditor } from './Editor';
import type { NotificationTemplate } from './Template';

export function templateEditor(template: NotificationTemplate, mode: 'revise' | 'status', id: string): TemplateEditor {
  const variables = JSON.stringify(template.variables, null, 2);
  const samples = JSON.stringify(Object.fromEntries(Object.entries(template.variables).map(([name, type]) => [name, sample(type)])), null, 2);
  return Object.freeze({
    kind: 'template',
    mode,
    original: template,
    id,
    channel: template.channel,
    eventType: template.eventType,
    version: mode === 'revise' ? template.version + 1 : template.version,
    variables,
    samples,
    providerTemplate: template.providerTemplate ?? '',
    subject: template.subject ?? '',
    body: template.body,
    purpose: template.purpose,
    mandatory: template.mandatory,
    status: mode === 'revise' ? 'draft' : template.status,
    proof: '',
    confirmed: false,
  });
}

export function announcementEditor(value: Announcement): AnnouncementEditor {
  return Object.freeze({
    kind: 'announcement',
    original: value,
    id: value.id,
    title: value.title,
    body: value.body,
    audience: value.audience.kind,
    members: value.audience.kind === 'members' ? value.audience.members.join('\n') : '',
    startsAt: localTime(value.startsAt),
    endsAt: value.endsAt ? localTime(value.endsAt) : '',
    state: value.state,
    proof: '',
    confirmed: false,
  });
}

function sample(type: string): string | number | boolean {
  if (type === 'number') return 1;
  if (type === 'boolean') return true;
  if (type === 'date') return new Date().toISOString();
  return type === 'money' ? '100.00' : '示例';
}
