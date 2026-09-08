import { Button, Dialog, ImportPanel } from '@shop/design';
import type { MemberViewModel } from '../viewmodel/MemberViewModel';

export function ImportDialog({ model }: Readonly<{ model: MemberViewModel }>) {
  const editor = model.importEditor;
  if (editor === undefined) return null;
  return (
    <Dialog open title="发起成员导入" eyebrow="CSV 文件 · 完整性校验 · 后台任务" onClose={model.actions.closeImport} dismissable={!model.importing.busy}>
      <ImportPanel steps={['选择文件', '服务端预检', '任务收据']} current={1} label="成员导入步骤">
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
            选择导入文件
            <input type="file" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => model.actions.importFile(event.target.files?.[0] ?? null)} />
          </label>
          {editor.file ? (
            <p className="membersecurity">已选择 {editor.file.name}。系统会流式计算 SHA-256、直传隔离区并完成恶意内容扫描；浏览器不会解析或保存成员数据。</p>
          ) : (
            <p className="membersecurity">支持 CSV（最大 1 GiB）和 XLSX（最大 32 MiB）。上传后先进入服务端预检，必须在任务中心确认结果才会执行。</p>
          )}
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
              {model.importing.busy ? '正在校验并上传…' : '上传并开始预检'}
            </Button>
          </footer>
        </form>
      </ImportPanel>
    </Dialog>
  );
}
