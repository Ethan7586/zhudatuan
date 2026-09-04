import { Button, Dialog } from '@shop/design';
import type { DirectoryViewModel } from '../viewmodel/DirectoryViewModel';

export function SyncDialog({ model }: Readonly<{ model: DirectoryViewModel }>) {
  const editor = model.editor;
  if (!editor) return null;
  return (
    <Dialog open title={title(editor.action)} eyebrow="后台长任务 · 持久化游标 · 可恢复 · 可取消" onClose={model.actions.close} dismissable={!model.saving.busy}>
      <form
        className="directoryform"
        onSubmit={(event) => {
          event.preventDefault();
          model.actions.submit();
        }}
      >
        <section className="directoryimpact">
          <strong>{editor.directory.type === 'wecomcorp' ? '企业微信自建应用' : '企业微信第三方应用'}</strong>
          <p>{impact(editor.action, editor.mode)}</p>
        </section>
        {editor.action === 'start' ? (
          <fieldset>
            <legend>同步模式</legend>
            <label>
              <input type="radio" checked={editor.mode === 'incremental'} onChange={() => model.actions.mode('incremental')} />
              增量同步（推荐）
            </label>
            <label>
              <input type="radio" checked={editor.mode === 'full'} onChange={() => model.actions.mode('full')} />
              全量核对
            </label>
          </fieldset>
        ) : (
          <p>
            源任务：{editor.run?.id} · {editor.mode === 'full' ? '全量' : '增量'}模式
          </p>
        )}
        {model.assurance < 3 ? (
          <Button tone="primary" onPress={model.actions.stepup}>
            完成高强度二次验证
          </Button>
        ) : null}
        <label>
          一次性操作凭证
          <input value={editor.proof} onChange={(event) => model.actions.proof(event.target.value)} autoComplete="off" spellCheck={false} placeholder="粘贴 Step-up 签发的凭证" />
        </label>
        <label className="directoryconfirm">
          <input type="checkbox" checked={editor.confirmed} onChange={(event) => model.actions.confirmed(event.target.checked)} />
          我已核对目录连接、同步模式与影响范围
        </label>
        {model.saving.error ? (
          <p className="directoryerror" role="alert">
            {model.saving.error}
          </p>
        ) : null}
        {model.validation ? <p className="directoryvalidation">{model.validation}</p> : null}
        <footer>
          <Button onPress={model.actions.close} isDisabled={model.saving.busy}>
            取消
          </Button>
          <Button type="submit" tone={editor.action === 'cancel' ? 'danger' : 'primary'} isDisabled={model.saving.busy || model.validation !== undefined}>
            {model.saving.busy ? '正在提交…' : editor.action === 'cancel' ? '确认取消任务' : editor.action === 'resume' ? '确认恢复任务' : '确认启动任务'}
          </Button>
        </footer>
      </form>
    </Dialog>
  );
}

function title(action: 'start' | 'cancel' | 'resume') {
  return action === 'start' ? '启动通讯录同步' : action === 'cancel' ? '取消同步任务' : '恢复同步任务';
}
function impact(action: 'start' | 'cancel' | 'resume', mode: 'full' | 'incremental') {
  if (action === 'cancel') return '停止后续页面处理；已原子提交的页面不会回滚，水位和计数保留用于审计与恢复。';
  if (action === 'resume') return mode === 'incremental' ? '从服务端最近成功游标创建新任务，原失败/取消记录永久保留。' : '重新创建全量核对任务，原任务记录和处理证据永久保留。';
  return mode === 'incremental' ? '只拉取最近成功游标后的变化，适合日常同步。' : '从头核对全部目录；连续两次确认离职后才会冻结成员，避免瞬时缺失误伤。';
}
