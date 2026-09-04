import { Dialog } from '@shop/design';
import type { NotificationChannel, TemplateStatus } from '../model/Template';
import type { NotificationViewModel } from '../viewmodel/NotificationViewModel';
import { ApprovalPanel } from './ApprovalPanel';
import { DialogFooter } from './DialogFooter';
import { PreviewPanel } from './PreviewPanel';

export function TemplateDialog({ model }: Readonly<{ model: NotificationViewModel }>) {
  const editor = model.editor;
  if (editor?.kind !== 'template') return null;
  const locked = model.reviewing || editor.mode === 'status';
  const title = editor.mode === 'create' ? '新建通知模板' : editor.mode === 'revise' ? `新建 v${editor.version} 版本` : '变更模板状态';
  return (
    <Dialog open title={title} eyebrow="变量校验 · 真实预览 · 双人复核 · 权威重读" onClose={model.actions.close} dismissable={!model.saving.busy}>
      <form
        className="notificationform"
        onSubmit={(event) => {
          event.preventDefault();
          model.actions.submit();
        }}
      >
        <div className="notificationgrid">
          <label>
            通知渠道
            <select value={editor.channel} disabled={locked} onChange={(event) => model.actions.channel(event.target.value as NotificationChannel)}>
              <option value="inapp">站内信</option>
              <option value="sms">短信</option>
              <option value="email">邮件</option>
              <option value="wechat">微信</option>
            </select>
          </label>
          <label>
            内容版本
            <input value={`v${editor.version}`} readOnly />
          </label>
        </div>
        <label>
          事件类型
          <input value={editor.eventType} disabled={locked} onChange={(event) => model.actions.eventType(event.target.value)} placeholder="order.paid" autoComplete="off" required />
        </label>
        {editor.channel !== 'inapp' ? (
          <label>
            {editor.channel === 'sms' ? '短信供应商模板标识' : '供应商模板标识'}
            <input value={editor.providerTemplate} disabled={locked} onChange={(event) => model.actions.providerTemplate(event.target.value)} placeholder="只填写供应商模板标识，不填写密钥" autoComplete="off" required />
          </label>
        ) : null}
        <label>
          主题（可选）
          <input value={editor.subject} disabled={locked} maxLength={500} onChange={(event) => model.actions.subject(event.target.value)} placeholder="支持 {{variableName}} 占位符" />
        </label>
        <label>
          正文
          <textarea value={editor.body} disabled={locked} maxLength={10_000} onChange={(event) => model.actions.body(event.target.value)} placeholder="示例：您好，订单 {{orderId}} 已完成。" required />
        </label>
        <div className="notificationgrid">
          <label>
            变量定义（JSON）
            <textarea value={editor.variables} disabled={locked} spellCheck={false} onChange={(event) => model.actions.variables(event.target.value)} placeholder={'{\n  "orderId": "string"\n}'} />
          </label>
          <label>
            预览数据（JSON）
            <textarea value={editor.samples} disabled={model.reviewing} spellCheck={false} onChange={(event) => model.actions.samples(event.target.value)} placeholder={'{\n  "orderId": "ORDER-1001"\n}'} />
          </label>
        </div>
        <label>
          目标状态
          <select value={editor.status} disabled={model.reviewing} onChange={(event) => model.actions.templateStatus(event.target.value as TemplateStatus)}>
            <option value="draft">草稿</option>
            <option value="active">启用</option>
            <option value="retired">停用</option>
          </select>
        </label>
        <p className="notificationnote">{editor.mode === 'status' ? '模板正文和变量定义不可原地修改；若内容需要调整，请返回列表选择“新建版本”。' : '短信、邮件和微信密钥只存在服务端密钥引用中，本页面不会读取、回显或保存任何供应商密钥。'}</p>
        <PreviewPanel model={model} />
        <ApprovalPanel model={model} />
        <DialogFooter model={model} />
      </form>
    </Dialog>
  );
}
