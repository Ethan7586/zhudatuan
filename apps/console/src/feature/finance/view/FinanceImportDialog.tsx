import { Button, Dialog, Status } from '@shop/design';
import { chineseDomainLabel, chineseReference } from '@shop/presentation';
import { formatDate } from '../../../shared/ui/Format';
import type { FinanceImportViewModel } from '../viewmodel/FinanceImportViewModel';
import './FinanceImport.css';

const steps = ['选择模板', '上传文件', '核对映射', '服务端预检', '确认执行', '任务收据'] as const;

export function FinanceImportDialog({ model }: Readonly<{ model: FinanceImportViewModel }>) {
  if (!model.open) return null;
  return <Dialog open title="导入渠道账单" eyebrow="安全上传 · 权威预检 · 人工确认 · 可恢复任务" description="账单导入只创建 Statement 并触发对账，不写账本分录，也不直接修改余额。" onClose={model.actions.close} dismissable={!model.busy}>
    <div className="financeimportwizard">
      <ol className="financeimportsteps" aria-label="财务账单导入步骤">{steps.map((label, index) => <li key={label} className={index + 1 === model.step ? 'isactive' : index + 1 < model.step ? 'iscomplete' : undefined}><span>{index + 1}</span>{label}</li>)}</ol>
      {model.step === 1 ? <TemplateStep model={model} /> : model.step === 2 ? <UploadStep model={model} /> : model.step === 3 ? <MappingStep model={model} /> : <TaskStep model={model} />}
    </div>
  </Dialog>;
}

function TemplateStep({ model }: Readonly<{ model: FinanceImportViewModel }>) {
  return <section className="financeimportcontent">
    <header><h3>{model.template.title}</h3><p>{model.template.description}</p></header>
    {model.providers.pending ? <section className="financeimportnotice" role="status"><strong>正在读取渠道目录</strong><p>只显示当前范围已启用、健康且声明 Statement 能力的 Provider。</p></section>
      : model.providers.error ? <section className="financeimportnotice" role="alert"><strong>渠道目录暂时不可用</strong><p>{model.providers.error}</p></section>
      : model.providers.items.length === 0 ? <section className="financeimportnotice"><strong>暂无可用账单渠道</strong><p>{model.providers.reason}</p></section>
      : <label>账单来源渠道<select aria-label="账单来源渠道" value={model.draft.provider} onChange={(event) => model.actions.provider(event.target.value)}><option value="">请选择渠道</option>{model.providers.items.map((provider) => <option key={provider.value} value={provider.value}>{provider.label} · {provider.business}</option>)}</select></label>}
    {model.provider ? <section className="financeprovidercard" aria-label="所选渠道映射"><div><strong>{model.provider.label}</strong><Status tone="success">连接健康</Status></div><p>{model.provider.help}</p><dl><div><dt>连接</dt><dd>{chineseReference('渠道连接', model.provider.connection)}</dd></div><div><dt>协议版本</dt><dd>{model.provider.contractVersion}</dd></div><div><dt>区域</dt><dd>{model.provider.region}</dd></div></dl></section> : null}
    <section className="financeimporttemplate"><strong>统一账单列</strong><p>{model.template.columns.join('、')}</p><small>Provider 适配器在服务端完成字段规范化；浏览器不读取业务行，也不会猜测未知列。</small><Button onPress={model.actions.download}>下载 CSV 模板</Button></section>
    {model.providers.items.length > 0 && model.validation ? <p className="financeimporthint">{model.validation}</p> : null}
    <footer><Button onPress={model.actions.close}>取消</Button><Button tone="primary" onPress={model.actions.next} isDisabled={model.validation !== undefined}>下一步：上传文件</Button></footer>
  </section>;
}

function UploadStep({ model }: Readonly<{ model: FinanceImportViewModel }>) {
  return <section className="financeimportcontent">
    <header><h3>上传待预检账单</h3><p>支持 CSV 与 XLSX。系统流式计算完整文件哈希并直传隔离区，不在浏览器解析账单行。</p></header>
    <label>选择账单文件<input type="file" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => model.actions.file(event.target.files?.[0] ?? null)} /></label>
    {model.draft.file ? <section className="financefilecard"><strong>{model.draft.file.name}</strong><span>{formatBytes(model.draft.file.size)}</span><small>提交后先执行恶意内容扫描、格式校验与完整性校验。</small></section> : null}
    {model.validation ? <p className="financeimporthint">{model.validation}</p> : null}
    <footer><Button onPress={model.actions.back}>返回模板</Button><Button tone="primary" onPress={model.actions.next} isDisabled={model.validation !== undefined}>下一步：核对映射</Button></footer>
  </section>;
}

function MappingStep({ model }: Readonly<{ model: FinanceImportViewModel }>) {
  return <form className="financeimportcontent" onSubmit={(event) => { event.preventDefault(); model.actions.submit(); }}>
    <header><h3>核对 Provider 映射与账期</h3><p>{model.provider?.label} 的原始字段由服务端适配器映射到以下标准列，未知列和公式不会执行。</p></header>
    <div className="financeimportmapping" role="table" aria-label="账单字段映射">{model.template.mapping.map((column) => <div key={column.key} role="row"><strong role="cell">{column.key}</strong><span role="cell">{column.label}</span><small role="cell">{column.description}</small></div>)}</div>
    <div className="financeimportfields">
      <label>结算伙伴<input value={model.draft.partnerId} maxLength={128} onChange={(event) => model.actions.partner(event.target.value)} placeholder="输入服务端登记的合作方引用" required /></label>
      <label>账期开始<input type="date" value={model.draft.periodStart} onChange={(event) => model.actions.start(event.target.value)} required /></label>
      <label>账期结束<input type="date" value={model.draft.periodEnd} onChange={(event) => model.actions.end(event.target.value)} required /></label>
      <label>期初余额（分）<input inputMode="numeric" value={model.draft.openingMinor} onChange={(event) => model.actions.opening(event.target.value)} required /></label>
      <label>期末余额（分）<input inputMode="numeric" value={model.draft.closingMinor} onChange={(event) => model.actions.closing(event.target.value)} required /></label>
      <label>币种<input value="CNY" readOnly aria-readonly="true" /></label>
    </div>
    <section className="financeimportchecks"><strong>服务端必须通过</strong><ul><li>渠道、账期、币种、期初、收支与期末余额守恒。</li><li>每行业务凭证唯一，金额为安全整数，行哈希可复算。</li><li>文件只形成账单和对账批次；任何差异进入复核，不直接写账本。</li></ul></section>
    <label className="financeimportconfirm"><input type="checkbox" checked={model.draft.confirmed} onChange={(event) => model.actions.confirmed(event.target.checked)} />我已核对来源、账期和余额，并确认预检完成后还需在任务中心再次确认执行。</label>
    {model.assurance < 2 ? <Button tone="primary" onPress={model.actions.stepup}>完成二次验证</Button> : null}
    {model.error ? <p role="alert">{model.error}</p> : model.validation ? <p className="financeimporthint">{model.validation}</p> : null}
    {model.busy && model.draft.file ? <div className="financeuploadprogress" role="status"><span>正在计算哈希并安全上传</span><progress max={model.draft.file.size} value={model.uploaded}>{model.uploaded}</progress></div> : null}
    <footer><Button onPress={model.actions.back} isDisabled={model.busy}>返回上传</Button><Button type="submit" tone="primary" isDisabled={model.busy || model.validation !== undefined}>{model.busy ? '正在安全上传…' : '提交并开始服务端预检'}</Button></footer>
  </form>;
}

function TaskStep({ model }: Readonly<{ model: FinanceImportViewModel }>) {
  const task = model.task;
  if (!task) return <section className="financeimportcontent"><p role="alert">未取得导入任务，请保持相同文件和参数后重试。</p><footer><Button onPress={model.actions.close}>关闭</Button><Button tone="primary" onPress={model.actions.retry}>重试创建任务</Button></footer></section>;
  const needsConfirmation = model.step === 5;
  return <section className="financeimportcontent">
    <header><h3>{needsConfirmation ? '预检完成，等待确认执行' : model.step === 6 ? '查看任务收据' : '服务端正在预检'}</h3><p>{needsConfirmation ? '服务端已锁定本次文件与预检哈希；确认前不会分片写入有效账单行。' : '任务进度来自服务端持久化检查点，关闭窗口不会中断任务。'}</p></header>
    <section className="financeimporttask" role="status"><div><strong>{chineseReference('导入任务', task.id)}</strong><Status tone={task.state === 'failed' ? 'danger' : task.state === 'ready' || task.state === 'completed' ? 'success' : 'neutral'}>{chineseDomainLabel(task.state)}</Status></div><progress max={task.total || 1} value={Math.min(task.processed, task.total || 1)}>{task.processed}</progress><dl><div><dt>已处理</dt><dd>{task.processed} / {task.total || '待识别'}</dd></div><div><dt>成功</dt><dd>{task.succeeded}</dd></div><div><dt>失败</dt><dd>{task.failed}</dd></div><div><dt>最近更新</dt><dd>{formatDate(task.updatedAt)}</dd></div></dl></section>
    {task.errors.length > 0 ? <section className="financeimporterrors"><strong>预检问题</strong><ul>{task.errors.slice(0, 5).map((error) => <li key={`${error.row}:${error.reason}`}>第 {error.row} 行 · {chineseDomainLabel(error.reason, '字段校验未通过')}{error.field ? ` · ${error.field}` : ''}</li>)}</ul><p>完整错误报告与可重试项请在任务中心查看。</p></section> : null}
    {model.error ? <p role="alert">{model.error}</p> : task.lastError ? <p role="alert">{chineseDomainLabel(task.lastError, '任务执行失败，请查看错误报告。')}</p> : null}
    <footer><Button onPress={model.actions.close}>关闭</Button>{model.step === 4 ? <Button onPress={model.actions.refresh} isDisabled={model.refreshing}>{model.refreshing ? '正在刷新…' : '刷新预检'}</Button> : null}<Button tone="primary" onPress={model.actions.task}>{needsConfirmation ? '前往核对并确认执行' : '查看完整任务收据'}</Button></footer>
  </section>;
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}
