import { Dialog } from '@shop/design';
import type { AnnouncementState } from '../model/Announcement';
import type { NotificationViewModel } from '../viewmodel/NotificationViewModel';
import { ApprovalPanel } from './ApprovalPanel';
import { DialogFooter } from './DialogFooter';
import { PreviewPanel } from './PreviewPanel';

export function AnnouncementDialog({ model }: Readonly<{ model: NotificationViewModel }>) {
  const editor = model.editor;
  if (editor?.kind !== 'announcement') return null;
  return (
    <Dialog open title={editor.original ? '编辑与发布公告' : '新建公告'} eyebrow="受众范围 · 生效时间 · 双人复核 · 异步提醒" onClose={model.actions.close} dismissable={!model.saving.busy}>
      <form
        className="notificationform"
        onSubmit={(event) => {
          event.preventDefault();
          model.actions.submit();
        }}
      >
        <label>
          公告标题
          <input value={editor.title} disabled={model.reviewing} maxLength={500} onChange={(event) => model.actions.title(event.target.value)} required />
        </label>
        <label>
          公告正文
          <textarea value={editor.body} disabled={model.reviewing} maxLength={20_000} onChange={(event) => model.actions.body(event.target.value)} required />
        </label>
        <fieldset disabled={model.reviewing}>
          <legend>展示受众</legend>
          <label>
            <input type="radio" checked={editor.audience === 'all'} onChange={() => model.actions.audience('all')} />
            当前范围全部成员
          </label>
          <label>
            <input type="radio" checked={editor.audience === 'members'} onChange={() => model.actions.audience('members')} />
            指定成员
          </label>
        </fieldset>
        {editor.audience === 'members' ? (
          <label>
            成员标识
            <textarea value={editor.members} disabled={model.reviewing} onChange={(event) => model.actions.members(event.target.value)} placeholder="每行填写一个成员标识，最多 1,000 个" required />
          </label>
        ) : null}
        <div className="notificationgrid">
          <label>
            开始时间
            <input type="datetime-local" value={editor.startsAt} disabled={model.reviewing} onChange={(event) => model.actions.startsAt(event.target.value)} required />
          </label>
          <label>
            结束时间（可选）
            <input type="datetime-local" value={editor.endsAt} disabled={model.reviewing} onChange={(event) => model.actions.endsAt(event.target.value)} />
          </label>
        </div>
        <label>
          目标状态
          <select value={editor.state} disabled={model.reviewing} onChange={(event) => model.actions.announcementState(event.target.value as AnnouncementState)}>
            <option value="draft">草稿</option>
            <option value="published">发布</option>
            <option value="retired">停用</option>
          </select>
        </label>
        <p className="notificationnote">公告保存与展示状态在本次事务中完成；需要提醒成员时，通知投递任务在事务提交后异步执行，失败会重试，不阻塞公告保存。</p>
        <PreviewPanel model={model} />
        <ApprovalPanel model={model} />
        <DialogFooter model={model} />
      </form>
    </Dialog>
  );
}
