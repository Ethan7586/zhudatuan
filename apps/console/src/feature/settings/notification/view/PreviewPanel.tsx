import type { NotificationViewModel } from '../viewmodel/NotificationViewModel';

export function PreviewPanel({ model }: Readonly<{ model: NotificationViewModel }>) {
  const editor = model.editor;
  if (!editor || !model.reviewing) return null;
  if (editor.kind === 'announcement')
    return (
      <section className="notificationpreview" aria-label="公告发布预览">
        <header>
          <span>公告真实预览</span>
          <strong>{editor.state === 'published' ? '发布后按开始时间展示' : editor.state === 'retired' ? '将停止展示' : '保存为草稿'}</strong>
        </header>
        <h3>{editor.title.trim()}</h3>
        <p className="notificationbody">{editor.body.trim()}</p>
        <small>受众：{editor.audience === 'all' ? '当前范围全部成员' : '指定成员'} · 发送提醒由异步通知任务处理，不阻塞本次保存。</small>
      </section>
    );
  const preview = model.preview;
  return (
    <section className="notificationpreview" aria-label="通知模板真实预览">
      <header>
        <span>{editor.channel === 'sms' ? '短信内容预览' : '通知内容预览'}</span>
        <strong>{editor.status === 'active' ? '确认后启用' : editor.status === 'retired' ? '确认后停用' : '保存为草稿'}</strong>
      </header>
      {preview?.subject ? <h3>{preview.subject}</h3> : null}
      <p className="notificationbody">{preview?.body}</p>
      {editor.channel === 'sms' ? (
        <small>
          {preview?.characters ?? 0} 个字符 · 最多按 Unicode 70 字/条保守估算为 {preview?.segments ?? 1} 条；最终拆分和计费以供应商回执为准。
        </small>
      ) : null}
    </section>
  );
}
