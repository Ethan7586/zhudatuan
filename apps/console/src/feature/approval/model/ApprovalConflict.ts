import type { ApprovalEditor, ApprovalInstance, ApprovalResource, ApprovalTask, ApprovalTemplate } from './Approval';

export interface ApprovalConflict {
  readonly title: string;
  readonly details: readonly string[];
  readonly next?: ApprovalEditor;
}

export function approvalConflict(editor: ApprovalEditor, resource: ApprovalResource | undefined, instance: ApprovalInstance | undefined): ApprovalConflict {
  const next = rebase(editor, resource, instance);
  return Object.freeze({
    title: next === undefined ? '审批目标已被删除或不再可处理' : '审批目标版本已变化',
    details: Object.freeze(details(editor, next)),
    ...(next === undefined ? {} : { next }),
  });
}

function rebase(editor: ApprovalEditor, resource: ApprovalResource | undefined, instance: ApprovalInstance | undefined): ApprovalEditor | undefined {
  if (editor.command === 'create') return undefined;
  if (editor.command === 'revise' || editor.command === 'enable' || editor.command === 'disable') {
    const template = currentTemplate(editor.template.id, resource);
    if (template === undefined || (editor.command === 'enable' && template.state === 'enabled') || (editor.command === 'disable' && template.state !== 'enabled')) return undefined;
    return Object.freeze({ ...editor, template });
  }
  const task = currentTask(editor.task.id, resource, instance);
  if (task === undefined || (task.state !== 'pending' && task.state !== 'escalated')) return undefined;
  return Object.freeze({ ...editor, task });
}

function currentTemplate(id: string, resource: ApprovalResource | undefined): ApprovalTemplate | undefined {
  if (resource?.kind === 'template') return resource.template.id === id ? resource.template : undefined;
  return resource?.kind === 'templates' ? resource.items.find((item) => item.id === id) : undefined;
}

function currentTask(id: string, resource: ApprovalResource | undefined, instance: ApprovalInstance | undefined): ApprovalTask | undefined {
  const pageTask = resource?.kind === 'tasks' ? resource.items.find((item) => item.id === id) : undefined;
  return pageTask ?? instance?.tasks.find((item) => item.id === id);
}

function details(previous: ApprovalEditor, next: ApprovalEditor | undefined): string[] {
  if (next === undefined) return ['权威回读后目标不存在或已进入终态，系统没有重复执行决定。'];
  if (previous.command === 'create' || next.command === 'create') return ['规则编码已被并发占用，请核对最新规则列表。'];
  if ('template' in previous && 'template' in next) return templateDetails(previous.template, next.template);
  if ('task' in previous && 'task' in next) return [
    `待办版本：v${previous.task.version} → v${next.task.version}`,
    `待办状态：${previous.task.state} → ${next.task.state}`,
    `同意进度：${previous.task.approvalCount}/${previous.task.minimumApprovals} → ${next.task.approvalCount}/${next.task.minimumApprovals}`,
  ];
  return ['审批目标类型已变化，请重新选择。'];
}

function templateDetails(previous: ApprovalTemplate, next: ApprovalTemplate): string[] {
  const result = [`规则版本：v${previous.version} → v${next.version}`];
  if (previous.name !== next.name) result.push(`规则名称：${previous.name} → ${next.name}`);
  if (previous.state !== next.state) result.push(`规则状态：${previous.state} → ${next.state}`);
  if (previous.activeVersion !== next.activeVersion) result.push(`生效版本：${previous.activeVersion ?? '无'} → ${next.activeVersion ?? '无'}`);
  return result;
}
