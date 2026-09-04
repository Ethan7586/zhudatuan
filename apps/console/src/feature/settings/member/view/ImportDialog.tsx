import { Button, Dialog } from '@shop/design';
import type { MemberViewModel } from '../viewmodel/MemberViewModel';

export function ImportDialog({ model }: Readonly<{ model: MemberViewModel }>) {
  const editor = model.importEditor;
  if (editor === undefined) return null;
  return (
    <Dialog open title="发起成员导入" eyebrow="CSV 文件 · 完整性校验 · 后台任务" onClose={model.actions.closeImport} dismissable={!model.importing.busy}>
      <form
        className="memberform"
        onSubmit={(event) => {
          event.preventDefault();
          model.actions.submitImport();
        }}
      >
        <section className="memberimportnote">
          <strong>导入不会阻塞当前页面</strong>
          <p>提交后立即进入长任务中心；校验、分批写入、失败行和结果报告均由服务端任务保存，刷新或离开页面不会中断。</p>
        </section>
        <label>
          安全文件引用
          <input value={editor.objectRef} maxLength={2048} onChange={(event) => model.actions.objectRef(event.target.value)} placeholder="粘贴安全文件上传完成后返回的对象引用" required />
        </label>
        <label>
          SHA-256 校验值
          <input value={editor.sha256} minLength={64} maxLength={64} autoComplete="off" spellCheck={false} onChange={(event) => model.actions.sha256(event.target.value)} placeholder="64 位小写十六进制校验值" required />
        </label>
        <p className="membersecurity">服务端仅接受已扫描为安全、类型为 CSV、大小不超过 32 MiB 且哈希完全一致的对象。</p>
        {model.assurance < 2 ? (
          <Button onPress={model.actions.stepup} tone="primary">
            立即完成二次验证
          </Button>
        ) : null}
        {model.importing.error ? (
          <p className="membererror" role="alert">
            {model.importing.error}
          </p>
        ) : null}
        {model.importValidation ? <p className="membervalidation">{model.importValidation}</p> : null}
        <footer>
          <Button onPress={model.actions.closeImport} isDisabled={model.importing.busy}>
            取消
          </Button>
          <Button type="submit" tone="primary" isDisabled={model.importing.busy || model.importValidation !== undefined}>
            {model.importing.busy ? '正在创建任务…' : '进入长任务中心'}
          </Button>
        </footer>
      </form>
    </Dialog>
  );
}
