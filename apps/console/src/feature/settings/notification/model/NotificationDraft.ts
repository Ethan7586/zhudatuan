import type { NotificationCommand } from './Command';
import { announcementChange, templateChange, type AnnouncementEditor, type NotificationEditor, type TemplateEditor } from './Editor';
import { localTime } from '../../../../shared/format/Date';
import type { NotificationChannel } from './Template';

export type NotificationSection = 'templates' | 'sms' | 'announcements';
export type ResolvedNotification = Readonly<{ change?: NotificationCommand['change']; preview?: ReturnType<typeof templateChange>['preview']; error?: string }>;

export function resolveNotification(editor?: NotificationEditor): ResolvedNotification {
  if (!editor) return Object.freeze({});
  try {
    if (editor.kind === 'template') {
      const result = templateChange(editor);
      return Object.freeze({ change: result.change, preview: result.preview });
    }
    return Object.freeze({ change: announcementChange(editor) });
  } catch (cause) {
    return Object.freeze({ error: cause instanceof Error ? cause.message : '表单内容无效，请检查后重试。' });
  }
}

export function notificationCommand(editor: NotificationEditor | undefined, resolved: ResolvedNotification, identity: string): NotificationCommand | undefined {
  if (!editor || !resolved.change) return undefined;
  return editor.kind === 'template'
    ? { kind: 'template', change: resolved.change as ReturnType<typeof templateChange>['change'], proof: editor.proof, identity }
    : { kind: 'announcement', change: resolved.change as ReturnType<typeof announcementChange>, proof: editor.proof, identity };
}

export function notificationSection(value: string | null): NotificationSection {
  return value === 'sms' || value === 'announcements' ? value : 'templates';
}
export function emptyTemplate(id: string, channel: NotificationChannel): TemplateEditor {
  return { kind: 'template', mode: 'create', id, channel, eventType: '', version: 1, variables: '{}', samples: '{}', providerTemplate: '', subject: '', body: '', status: 'draft', proof: '', confirmed: false };
}
export function emptyAnnouncement(id: string): AnnouncementEditor {
  return { kind: 'announcement', id, title: '', body: '', audience: 'all', members: '', startsAt: localTime(new Date()), endsAt: '', state: 'draft', proof: '', confirmed: false };
}
