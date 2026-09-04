import type { Announcement, AnnouncementAudience, AnnouncementChange, AnnouncementState } from './Announcement';
import { createTemplatePreview, readVariableSchema, type TemplatePreview } from './Preview';
import type { NotificationChannel, NotificationPurpose, NotificationTemplate, TemplateChange, TemplateStatus } from './Template';

export interface TemplateEditor {
  readonly kind: 'template';
  readonly mode: 'create' | 'revise' | 'status';
  readonly original?: NotificationTemplate;
  readonly id: string;
  readonly channel: NotificationChannel;
  readonly eventType: string;
  readonly version: number;
  readonly variables: string;
  readonly samples: string;
  readonly providerTemplate: string;
  readonly subject: string;
  readonly body: string;
  readonly purpose: NotificationPurpose;
  readonly mandatory: boolean;
  readonly status: TemplateStatus;
  readonly proof: string;
  readonly confirmed: boolean;
}

export interface AnnouncementEditor {
  readonly kind: 'announcement';
  readonly original?: Announcement;
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly audience: AnnouncementAudience['kind'];
  readonly members: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly state: AnnouncementState;
  readonly proof: string;
  readonly confirmed: boolean;
}

export type NotificationEditor = TemplateEditor | AnnouncementEditor;

export function templateChange(editor: TemplateEditor): Readonly<{ change: TemplateChange; preview: TemplatePreview }> {
  const variables = readVariableSchema(editor.variables);
  if (!/^[a-z][a-z0-9.]{1,127}$/.test(editor.eventType.trim())) throw new Error('事件类型需以小写字母开头，只能包含小写字母、数字和点。');
  if (editor.channel !== 'inapp' && !editor.providerTemplate.trim()) throw new Error('短信、邮件和微信模板必须填写供应商模板标识。');
  if (editor.purpose === 'marketing' && editor.mandatory) throw new Error('营销通知不能设为依法必须送达。');
  if (editor.mode === 'status' && editor.original?.status === editor.status) throw new Error('请先选择新的模板状态。');
  if (editor.mode === 'status' && !validTransition(editor.original?.status, editor.status)) throw new Error('该模板状态不能执行所选变更。');
  const providerTemplate = editor.providerTemplate.trim() || null;
  const subject = editor.subject.trim() || null;
  const preview = createTemplatePreview(subject, editor.body, variables, editor.samples);
  return Object.freeze({
    change: Object.freeze({
      id: editor.id,
      channel: editor.channel,
      eventType: editor.eventType.trim(),
      version: editor.version,
      variables,
      providerTemplate,
      subject,
      body: editor.body,
      purpose: editor.purpose,
      mandatory: editor.mandatory,
      status: editor.status,
      expectedVersion: editor.mode === 'status' ? (editor.original?.version ?? 0) : 0,
    }),
    preview,
  });
}

export function announcementChange(editor: AnnouncementEditor): AnnouncementChange {
  const title = editor.title.trim();
  const body = editor.body.trim();
  if (!title || title.length > 500) throw new Error('公告标题必填且最多 500 个字符。');
  if (!body || body.length > 20_000) throw new Error('公告正文必填且最多 20,000 个字符。');
  const startsAt = iso(editor.startsAt, '请选择有效的开始时间。');
  const endsAt = editor.endsAt ? iso(editor.endsAt, '请选择有效的结束时间。') : null;
  if (endsAt !== null && Date.parse(endsAt) <= Date.parse(startsAt)) throw new Error('结束时间必须晚于开始时间。');
  const audience = audienceValue(editor.audience, editor.members);
  const change = Object.freeze({ id: editor.id, title, body, audience, startsAt, endsAt, state: editor.state, expectedVersion: editor.original?.version ?? 0 });
  if (
    editor.original &&
    title === editor.original.title &&
    body === editor.original.body &&
    editor.state === editor.original.state &&
    startsAt === editor.original.startsAt &&
    endsAt === editor.original.endsAt &&
    JSON.stringify(audience) === JSON.stringify(editor.original.audience)
  )
    throw new Error('请先修改公告内容、受众、时间或状态。');
  return change;
}

function audienceValue(kind: AnnouncementAudience['kind'], source: string): AnnouncementAudience {
  if (kind === 'all') return Object.freeze({ kind: 'all' });
  const members = [
    ...new Set(
      source
        .split(/\r?\n|,/)
        .map((value) => value.trim())
        .filter(Boolean)
    ),
  ];
  if (members.length === 0 || members.length > 1_000 || members.some((member) => member.length > 200)) throw new Error('定向公告需填写 1 至 1,000 个有效成员标识，每行一个。');
  return Object.freeze({ kind: 'members', members: Object.freeze(members) });
}

function iso(value: string, message: string): string {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw new Error(message);
  return date.toISOString();
}

function validTransition(current: TemplateStatus | undefined, next: TemplateStatus): boolean {
  return current === next || (current === 'draft' && (next === 'active' || next === 'retired')) || (current === 'active' && next === 'retired');
}
