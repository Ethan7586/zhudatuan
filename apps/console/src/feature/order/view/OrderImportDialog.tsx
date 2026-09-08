import { Button, Dialog, ImportPanel } from '@shop/design';
import { chineseDomainLabel, chineseReference } from '@shop/presentation';
import type { ListViewModel } from '../viewmodel/ListViewModel';

export function OrderImportDialog({ model }: Readonly<{ model: ListViewModel }>) {
  const current = model.importing.editor;
  if (!current) return null;
  const result = model.importing.result;
  const template = model.importing.template;
  const stage = result ? 4 : current.step;
  return (
    <Dialog open title="导入外部订单" eyebrow="受控导入 · 权威预检 · 可恢复任务" onClose={model.actions.closeImport} dismissable={!model.importing.busy}>
      <ImportPanel className="orderactiondialog" stepsClassName="orderwizard" steps={['模板', '上传', '映射', '预检', '确认执行', '任务收据']} current={stage} label="外部订单导入步骤">
        {result ? (
          <section className="orderactionsuccess" role="status">
            <strong>预检任务已创建</strong>
            <p>文件已进入安全隔离区。服务端将流式完成字段识别、来源证明、金额守恒和重复项校验；预检完成后必须在任务收据页再次确认，才会分片写入有效订单。</p>
            <dl>
              <div>
                <dt>当前阶段</dt>
                <dd>{chineseDomainLabel(result.state)}</dd>
              </div>
              <div>
                <dt>任务编号</dt>
                <dd>{chineseReference('导入任务', result.id)}</dd>
              </div>
            </dl>
            <Button tone="primary" onPress={model.actions.openImportTask}>
              查看预检、确认与任务收据
            </Button>
          </section>
        ) : current.step === 1 ? (
          <section className="orderwizardcontent">
            <h3>{template.title}标准模板</h3>
            <p>{template.description} 文件须使用标准列名，浏览器不会本地解析或直接写订单。</p>
            <details>
              <summary>查看 {template.columns.length} 个标准字段</summary>
              <p>{template.columns.join('、')}</p>
            </details>
            <Button onPress={model.actions.downloadImportTemplate}>下载 CSV 模板</Button>
            <footer>
              <Button onPress={model.actions.closeImport}>取消</Button>
              <Button tone="primary" onPress={() => model.actions.importStep(2)}>
                下一步：上传文件
              </Button>
            </footer>
          </section>
        ) : current.step === 2 ? (
          <section className="orderwizardcontent">
            <h3>上传待预检文件</h3>
            <label>
              选择外部订单文件
              <input type="file" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => model.actions.importFile(event.target.files?.[0] ?? null)} />
            </label>
            {current.file ? (
              <p>
                已选择 {current.file.name}（{formatBytes(current.file.size)}），提交时会流式计算完整性哈希并直传安全隔离区。
              </p>
            ) : (
              <p>支持 CSV（最大 1 GiB）或 XLSX（最大 32 MiB），不会在浏览器内存中读取完整文件。</p>
            )}
            {model.importing.validation ? <p>{model.importing.validation}</p> : null}
            <footer>
              <Button onPress={() => model.actions.importStep(1)}>返回模板</Button>
              <Button tone="primary" onPress={() => model.actions.importStep(3)} isDisabled={model.importing.validation !== undefined}>
                下一步：核对映射
              </Button>
            </footer>
          </section>
        ) : (
          <form
            className="orderwizardcontent"
            onSubmit={(event) => {
              event.preventDefault();
              model.actions.submitImport();
            }}
          >
            <h3>核对字段映射与预检规则</h3>
            <section className="orderimportmapping">
              <strong>标准列自动映射</strong>
              <p>{template.columns.join('、')}</p>
              <small>文件列 → 外部订单标准字段；未知列不会被猜测写入。</small>
            </section>
            <section className="orderimportchecks">
              <strong>服务端预检</strong>
              <ul>
                <li>来源、外部订单号、商城、成员和下单时间必须可验证。</li>
                <li>行项、优惠、应付和订单总额必须守恒，币种必须一致。</li>
                <li>已支付声明必须匹配可验证的支付或账单引用，否则进入待核验且禁止履约、开票和结算。</li>
              </ul>
            </section>
            <section className="orderimportchecks">
              <strong>重复项处理</strong>
              <p>来源 + 外部订单号是幂等键；文件内重复和系统已存在订单进入错误报告，不会创建第二张订单，也不会覆盖历史事实。</p>
            </section>
            <label className="orderactionconfirm">
              <input type="checkbox" checked={current.confirmed} onChange={(event) => model.actions.importConfirmed(event.target.checked)} />
              我确认由服务端完成字段映射、来源证明、金额与重复项预检，并以持久化任务结果为准。
            </label>
            {model.assurance < 3 ? <Button onPress={model.actions.stepup}>完成高强度二次验证</Button> : null}
            {model.importing.error ? <p role="alert">{model.importing.error}</p> : model.importing.validation ? <p>{model.importing.validation}</p> : null}
            <footer>
              <Button onPress={() => model.actions.importStep(2)} isDisabled={model.importing.busy}>
                返回上传
              </Button>
              <Button tone="primary" type="submit" isDisabled={model.importing.busy || model.importing.validation !== undefined}>
                {model.importing.busy ? '正在安全上传…' : '提交并开始服务端预检'}
              </Button>
            </footer>
          </form>
        )}
      </ImportPanel>
    </Dialog>
  );
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}
