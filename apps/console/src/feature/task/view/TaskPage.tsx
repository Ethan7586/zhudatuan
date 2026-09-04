import { Button, DataTable, Dialog, ResourcePanel, Status, type DataColumn } from '@shop/design';
import { chineseReference, chineseSectionLabel } from '@shop/presentation';
import { formatCount, formatDate } from '../../../shared/ui/Format';
import type { Task, TaskState, TaskType } from '../model/Task';
import type { TaskViewModel } from '../viewmodel/TaskViewModel';
import './Task.css';

export function TaskPage({ title, model }: Readonly<{ title: string; model: TaskViewModel }>) {
  const columns: readonly DataColumn<Task>[] = [
    { key: 'task', label: '任务', render: (task) => <TaskName task={task} /> },
    { key: 'source', label: '来源', render: (task) => ownerText(task.owner) },
    { key: 'progress', label: '进度', render: (task) => <TaskProgress task={task} compact /> },
    { key: 'state', label: '状态', render: (task) => <Status tone={stateTone(task.state)}>{stateText(task.state)}</Status> },
    { key: 'updated', label: '最近更新', render: (task) => formatDate(task.updatedAt) },
    { key: 'actions', label: '操作', render: (task) => <TaskActions task={task} model={model} /> },
  ];
  const detail = model.selection !== undefined ? model.selected : undefined;
  return <>
    <ResourcePanel
      title={title}
      eyebrow={chineseSectionLabel('全局任务中心')}
      description={detail
        ? `${typeText(detail.type)}的进度、状态和可恢复项均来自服务端持久化记录。`
        : '集中查看导入、导出、同步、发放、对账和后台作业；支持真实取消、失败项重试及来源回溯。'}
      condition={model.condition}
      {...(model.error ? { error: model.error } : {})}
      retry={model.actions.refresh}
      actions={<>
        {model.assurance < 2 ? <Button tone="primary" onPress={model.actions.stepup}>完成二次验证</Button> : null}
        {!detail && model.canCreateImport ? <Button tone="primary" onPress={model.actions.openImport}>发起数据导入</Button> : null}
        {detail ? <Button onPress={model.actions.center}>返回全部任务</Button> : null}
        <Button onPress={model.actions.refresh} isDisabled={model.fetching}>{model.fetching ? '正在刷新…' : '刷新任务'}</Button>
      </>}
      notice={model.receipt ? <section className="taskreceipt" role="status"><strong>操作已完成</strong><span>{model.receipt}</span><Button onPress={model.actions.dismissReceipt}>知道了</Button></section> : undefined}
    >
      {detail ? <TaskDetail task={detail} model={model} /> : model.page ? <div className="taskworkspace">
        <TaskFilters model={model} />
        <DataTable caption="后台任务" rows={model.page.items} columns={columns} rowKey={(task) => `${task.type}:${task.id}`} />
        <footer className="pagination"><span>本页 {formatCount(model.page.count)} 条</span><div>{model.filter.cursor ? <Button onPress={model.actions.first}>返回第一页</Button> : null}{model.page.nextCursor ? <Button onPress={() => model.actions.next(model.page!.nextCursor!)}>下一页</Button> : null}</div></footer>
      </div> : null}
    </ResourcePanel>
    <TaskDialog model={model} />
    <TaskImportDialog model={model} />
  </>;
}

function TaskFilters({ model }: Readonly<{ model: TaskViewModel }>) {
  return <form className="taskfilters" aria-label="任务筛选" onSubmit={(event) => event.preventDefault()}>
    <label>任务类型<select value={model.filter.type ?? ''} onChange={(event) => model.actions.filter('type', event.target.value)}><option value="">全部类型</option><option value="job">后台作业</option><option value="import">数据导入</option><option value="export">文件导出</option></select></label>
    <label>任务状态<select value={model.filter.state ?? ''} onChange={(event) => model.actions.filter('state', event.target.value)}><option value="">全部状态</option><option value="queued">等待执行</option><option value="validating">正在预检</option><option value="ready">等待确认</option><option value="running">正在执行</option><option value="completed">已完成</option><option value="failed">执行失败</option><option value="cancelled">已取消</option><option value="expired">已过期</option></select></label>
    <label>业务来源<select value={model.filter.owner ?? ''} onChange={(event) => model.actions.filter('owner', event.target.value)}><option value="">全部来源</option><option value="member">成员</option><option value="catalog">商品</option><option value="inventory">库存</option><option value="order">订单</option><option value="finance">财务</option><option value="voucher">卡券</option><option value="channel">渠道</option><option value="reporting">报表</option></select></label>
    <label>每页数量<select value={String(model.filter.limit)} onChange={(event) => model.actions.filter('limit', event.target.value)}><option value="20">20 条</option><option value="50">50 条</option></select></label>
    {model.filter.type || model.filter.state || model.filter.owner || model.filter.limit !== 20 ? <Button onPress={model.actions.reset}>清除筛选</Button> : null}
  </form>;
}

function TaskDetail({ task, model }: Readonly<{ task: Task; model: TaskViewModel }>) {
  return <div className="taskdetail">
    <header><TaskName task={task} /><Status tone={stateTone(task.state)}>{stateText(task.state)}</Status></header>
    {task.type === 'import' ? <ImportLifecycle task={task} /> : null}
    <TaskProgress task={task} />
    <dl>
      <div><dt>任务类型</dt><dd>{typeText(task.type)}</dd></div>
      <div><dt>业务来源</dt><dd>{ownerText(task.owner)}</dd></div>
      <div><dt>任务分类</dt><dd>{kindText(task.kind)}</dd></div>
      <div><dt>创建时间</dt><dd>{formatDate(task.createdAt)}</dd></div>
      <div><dt>更新时间</dt><dd>{formatDate(task.updatedAt)}</dd></div>
      <div><dt>保留期限</dt><dd>{formatDate(task.expiresAt)}</dd></div>
      {task.fileName ? <div><dt>安全文件</dt><dd>{task.fileName}</dd></div> : null}
      {task.type === 'import' && task.columns.length > 0 ? <div><dt>识别字段</dt><dd>{task.columns.join('、')}</dd></div> : null}
      {task.type === 'import' ? <div><dt>预检问题</dt><dd>{task.validationErrors > 0 ? `${formatCount(task.validationErrors)} 项，请先核对错误报告` : '未发现阻断问题'}</dd></div> : null}
      <div><dt>结果文件</dt><dd>{task.downloadAvailable ? '已生成，请回到来源业务页领取短期下载凭证' : '暂无可下载结果'}</dd></div>
    </dl>
    <footer><TaskActions task={task} model={model} /></footer>
  </div>;
}

function TaskActions({ task, model }: Readonly<{ task: Task; model: TaskViewModel }>) {
  return <div className="taskactions">
    <Button onPress={() => model.actions.source(task)}>查看来源</Button>
    {model.canConfirm(task) ? <Button tone="primary" onPress={() => model.actions.begin('confirm', task)}>核对并开始导入</Button> : null}
    {model.canRetry(task) ? <Button tone="primary" onPress={() => model.actions.begin('retry', task)}>重试失败项</Button> : null}
    {model.canCancel(task) ? <Button tone="danger" onPress={() => model.actions.begin('cancel', task)}>取消任务</Button> : null}
  </div>;
}

function TaskName({ task }: Readonly<{ task: Task }>) {
  return <span className="taskname"><strong>{task.title}</strong><small>{typeText(task.type)} · {chineseReference('任务', task.id)}</small></span>;
}

function TaskProgress({ task, compact = false }: Readonly<{ task: Task; compact?: boolean }>) {
  const bounded = task.total > 0 ? Math.min(task.processed, task.total) : undefined;
  return <section className={`taskprogress${compact ? ' taskprogresscompact' : ''}`} aria-label={`${task.title}处理进度`}>
    <div><span>已处理 {formatCount(task.processed)}{task.total > 0 ? ` / ${formatCount(task.total)}` : ''}</span>{task.total > 0 ? <strong>{Math.floor((bounded! / task.total) * 100)}%</strong> : null}</div>
    <progress max={task.total || 1} {...(bounded === undefined ? {} : { value: bounded })}>{task.processed}</progress>
    <small>成功 {formatCount(task.succeeded)} · 失败 {formatCount(task.failed)}{task.retryableItems > 0 ? ` · 可重试 ${formatCount(task.retryableItems)}` : ''}</small>
  </section>;
}

function TaskDialog({ model }: Readonly<{ model: TaskViewModel }>) {
  const command = model.command;
  if (command === undefined) return null;
  const cancelling = command.kind === 'cancel';
  const confirming = command.kind === 'confirm';
  return <Dialog open title={cancelling ? '取消任务' : confirming ? '确认预检并执行' : '重试失败项'} eyebrow="版本校验 · 幂等执行 · 权威回读" description={`${command.task.title}；当前状态为${stateText(command.task.state)}。`} onClose={model.actions.close} dismissable={!model.busy}>
    <form className="taskcommand" onSubmit={(event) => { event.preventDefault(); model.actions.submit(); }}>
      <p>{cancelling ? '正在执行的分片会在安全检查点停止；已经成功的业务结果不会回滚。' : confirming
        ? `服务端已识别 ${formatCount(command.task.total)} 行、${formatCount(command.task.columns.length)} 个字段。确认后将锁定本次预检版本并分片执行。`
        : `仅重置服务端标记为可恢复的 ${formatCount(command.task.retryableItems)} 个失败项，已成功项不会重复执行。`}</p>
      {confirming ? <section className="taskpreflight"><strong>执行前核对</strong><span>字段：{command.task.columns.join('、') || '等待识别'}</span><span>阻断问题：{formatCount(command.task.validationErrors)} 项</span><small>文件或预检结果发生变化时，服务端会拒绝提交并要求重新预检。</small></section>
        : <label>操作原因<textarea value={command.reason} minLength={2} maxLength={500} required onChange={(event) => model.actions.reason(event.target.value)} placeholder="请填写便于审计和后续排查的原因" /></label>}
      {model.assurance < 2 ? <><p role="alert">此操作需要完成二次验证。</p><Button tone="primary" onPress={model.actions.stepup}>立即验证</Button></> : null}
      {model.mutationError ? <p role="alert">{model.mutationError}</p> : null}
      <footer><Button onPress={model.actions.close} isDisabled={model.busy}>返回</Button><Button type="submit" tone={cancelling ? 'danger' : 'primary'} isDisabled={model.busy || model.assurance < 2 || (!confirming && command.reason.trim().length < 2) || (confirming && command.task.validationErrors > 0)}>{model.busy ? '正在提交…' : cancelling ? '确认取消' : confirming ? '确认并开始执行' : '确认重试'}</Button></footer>
    </form>
  </Dialog>;
}

function TaskImportDialog({ model }: Readonly<{ model: TaskViewModel }>) {
  const draft = model.importDraft;
  if (!draft) return null;
  const descriptor = model.imports.descriptor;
  if (!descriptor) return null;
  return <Dialog open title="发起数据导入" eyebrow="安全上传 · 服务端预检 · 人工确认 · 分片执行" description="统一导入不会在浏览器解析业务数据，也不会跳过预检直接写入。" onClose={model.actions.closeImport} dismissable={!model.importing.busy}>
    <form className="taskcommand taskimport" onSubmit={(event) => { event.preventDefault(); model.actions.submitImport(); }}>
      <ol className="tasksteps" aria-label="导入步骤"><li className={draft.step === 1 ? 'isactive' : 'iscomplete'}><span>1</span>模板</li><li className={draft.step === 2 ? 'isactive' : draft.step === 3 ? 'iscomplete' : undefined}><span>2</span>上传</li><li className={draft.step === 3 ? 'isactive' : undefined}><span>3</span>映射</li><li><span>4</span>预检</li><li><span>5</span>确认执行</li><li><span>6</span>任务收据</li></ol>
      {draft.step === 1 ? <>
        <label>导入业务<select value={draft.kind} onChange={(event) => model.actions.importKind(event.target.value as typeof draft.kind)}>
          {model.imports.options.map((option) => <option key={option.id} value={option.id} disabled={!model.canImport(option.id)}>{option.title}</option>)}
        </select></label>
        <section className="taskimportscope"><strong>{descriptor.title}导入模板</strong><p>{descriptor.description}</p><small>标准列：{descriptor.columns.join('、')}。可选列允许留空，但不要修改列名；XLSX 公式不会执行。</small><Button onPress={model.actions.downloadTemplate}>下载 CSV 模板</Button></section>
        <footer><Button onPress={model.actions.closeImport}>取消</Button><Button tone="primary" onPress={() => model.actions.importStep(2)} isDisabled={!model.canImport(draft.kind)}>下一步：上传文件</Button></footer>
      </> : draft.step === 2 ? <>
        <label>导入文件<input type="file" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required onChange={(event) => model.actions.importFile(event.target.files?.[0] ?? null)} /></label>
        {draft.file ? <small className="taskfile">已选择 {draft.file.name} · {formatBytes(draft.file.size)}</small> : <small className="taskfile">CSV 最大 1 GiB；XLSX 最大 32 MiB。系统流式计算哈希，不把整份大文件载入浏览器内存。</small>}
        {model.importValidation ? <p className="taskhint">{model.importValidation}</p> : null}
        <footer><Button onPress={() => model.actions.importStep(1)} isDisabled={model.importing.busy}>返回</Button><Button tone="primary" onPress={() => model.actions.importStep(3)} isDisabled={model.importValidation !== undefined}>下一步：核对映射</Button></footer>
      </> : <>
        <section className="taskimportscope"><strong>字段映射</strong><p>当前采用标准列名自动映射，服务端会再次校验每一行，不在浏览器写入业务数据。</p><dl>{descriptor.columns.map((column) => <div key={column}><dt>{column}</dt><dd>文件列 → {descriptor.title}字段</dd></div>)}</dl></section>
        {draft.kind === 'voucher' ? <label>卡号库<input value={draft.pool} maxLength={255} onChange={(event) => model.actions.importField('pool', event.target.value)} placeholder="例如 pool:2026-autumn" required /></label> : null}
        {draft.kind === 'finance' ? <div className="taskfinancefields">
          {model.providers.pending ? <section className="taskimportscope" role="status"><strong>正在读取渠道目录</strong><p>正在核对当前范围已启用并通过连通性检查的渠道连接。</p></section>
            : model.providers.error ? <section className="taskimportscope" role="alert"><strong>渠道目录读取失败</strong><p>{model.providers.error}</p></section>
            : model.providers.items.length > 0 ? <label>账单渠道<select value={draft.provider} onChange={(event) => model.actions.importField('provider', event.target.value)} required>
              <option value="">请选择已启用渠道</option>{model.providers.items.map((provider) => <option key={provider.value} value={provider.value}>{provider.label}</option>)}
            </select></label>
            : <section className="taskimportscope"><strong>暂无可用账单渠道</strong><p>{model.providers.reason ?? '请先配置并启用渠道连接，再发起账单导入。'}</p><Button onPress={model.actions.channels}>前往渠道工作台</Button></section>}
          <label>结算伙伴<input value={draft.partnerId} maxLength={128} onChange={(event) => model.actions.importField('partnerId', event.target.value)} required /></label>
          <label>账期开始<input type="date" value={draft.periodStart} onChange={(event) => model.actions.importField('periodStart', event.target.value)} required /></label>
          <label>账期结束<input type="date" value={draft.periodEnd} onChange={(event) => model.actions.importField('periodEnd', event.target.value)} required /></label>
          <label>期初余额（分）<input inputMode="numeric" value={draft.openingMinor} onChange={(event) => model.actions.importField('openingMinor', event.target.value)} required /></label>
          <label>期末余额（分）<input inputMode="numeric" value={draft.closingMinor} onChange={(event) => model.actions.importField('closingMinor', event.target.value)} required /></label>
        </div> : null}
        <label className="taskconfirm"><input type="checkbox" checked={draft.confirmed} onChange={(event) => model.actions.importConfirmed(event.target.checked)} />我已确认文件来源和业务类型；预检完成后还会再次核对并确认执行。</label>
        {model.assurance < 2 ? <Button tone="primary" onPress={model.actions.stepup}>完成二次验证</Button> : null}
        {model.importing.error ? <p role="alert">{model.importing.error}</p> : model.importValidation ? <p className="taskhint">{model.importValidation}</p> : null}
        <footer><Button onPress={() => model.actions.importStep(2)} isDisabled={model.importing.busy}>返回</Button><Button type="submit" tone="primary" isDisabled={model.importing.busy || model.importValidation !== undefined}>{model.importing.busy ? '正在校验并上传…' : '提交并开始服务端预检'}</Button></footer>
      </>}
    </form>
  </Dialog>;
}

function ImportLifecycle({ task }: Readonly<{ task: Task }>) {
  const position = task.state === 'queued' || task.state === 'validating' ? 4 : task.state === 'ready' ? 5 : 6;
  return <ol className="tasksteps taskdetailsteps" aria-label="导入任务阶段">{['模板', '上传', '映射', '预检', '确认执行', '任务收据'].map((label, index) => <li key={label} className={index + 1 === position ? 'isactive' : index + 1 < position ? 'iscomplete' : undefined}><span>{index + 1}</span>{label}</li>)}</ol>;
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}

function typeText(type: TaskType): string {
  return type === 'import' ? '数据导入' : type === 'export' ? '文件导出' : '后台作业';
}
function ownerText(owner: string): string {
  const labels: Readonly<Record<string, string>> = { member: '成员', catalog: '商品', inventory: '库存', order: '订单', finance: '财务', voucher: '卡券', channel: '渠道', reporting: '报表', approval: '审批', runtime: '系统运行' };
  return labels[owner] ?? '业务模块';
}
function kindText(kind: string): string {
  const labels: Readonly<Record<string, string>> = { member: '成员导入', catalog: '商品导入', inventory: '库存导入', statement: '财务账单导入', finance: '财务账单导入', voucher: '卡券凭证导入', order: '外部订单导入' };
  return labels[kind] ?? '后台任务';
}
function stateText(state: TaskState): string {
  const labels: Readonly<Record<TaskState, string>> = { queued: '等待执行', validating: '正在预检', ready: '等待确认', running: '正在执行', completed: '已完成', failed: '执行失败', cancelled: '已取消', expired: '已过期' };
  return labels[state];
}
function stateTone(state: TaskState): 'neutral' | 'success' | 'warning' | 'danger' {
  return state === 'completed' ? 'success' : state === 'failed' || state === 'expired' ? 'danger' : state === 'cancelled' ? 'neutral' : 'warning';
}
