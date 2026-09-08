import { Button, Dialog, ImportPanel, Status } from '@shop/design';
import { chineseDomainLabel, chineseReference } from '@shop/presentation';
import { formatDate } from '../../../shared/ui/Format';
import type { FinanceImportViewModel } from '../viewmodel/FinanceImportViewModel';
import './FinanceImport.css';

import { FinanceImportTemplateStep, FinanceImportUploadStep } from './FinanceImportSetup';
const steps = ['选择模板', '上传文件', '核对映射', '服务端预检', '确认执行', '任务收据'] as const;

export function FinanceImportDialog({ model }: Readonly<{ model: FinanceImportViewModel }>) {
  if (!model.open) return null;
  return (
    <Dialog open title="导入渠道账单" eyebrow="安全上传 · 权威预检 · 人工确认 · 可恢复任务" description="账单导入只创建 Statement 并触发对账，不写账本分录，也不直接修改余额。" onClose={model.actions.close} dismissable={!model.busy}>
      <ImportPanel className="financeimportwizard" stepsClassName="financeimportsteps" steps={steps} current={model.step} label="财务账单导入步骤">
        {model.step === 1 ? <FinanceImportTemplateStep model={model} /> : model.step === 2 ? <FinanceImportUploadStep model={model} /> : model.step === 3 ? <MappingStep model={model} /> : <TaskStep model={model} />}
      </ImportPanel>
    </Dialog>
  );
}

function MappingStep({ model }: Readonly<{ model: FinanceImportViewModel }>) {
  return (
    <form
      className="financeimportcontent"
      onSubmit={(event) => {
        event.preventDefault();
        model.actions.submit();
      }}
    >
      <header>
        <h3>核对 Provider 映射与账期</h3>
        <p>{model.provider?.label} 的原始字段由服务端适配器映射到以下标准列，未知列和公式不会执行。</p>
      </header>
      <div className="financeimportmapping" role="table" aria-label="账单字段映射">
        {model.template.mapping.map((column) => (
          <div key={column.key} role="row">
            <strong role="cell">{column.key}</strong>
            <span role="cell">{column.label}</span>
            <small role="cell">{column.description}</small>
          </div>
        ))}
      </div>
      <div className="financeimportfields">
        <label>
          结算伙伴
          <input value={model.draft.partnerId} maxLength={128} onChange={(event) => model.actions.partner(event.target.value)} placeholder="输入服务端登记的合作方引用" required />
        </label>
        <label>
          账期开始
          <input type="date" value={model.draft.periodStart} onChange={(event) => model.actions.start(event.target.value)} required />
        </label>
        <label>
          账期结束
          <input type="date" value={model.draft.periodEnd} onChange={(event) => model.actions.end(event.target.value)} required />
        </label>
        <label>
          期初余额（分）
          <input inputMode="numeric" value={model.draft.openingMinor} onChange={(event) => model.actions.opening(event.target.value)} required />
        </label>
        <label>
          期末余额（分）
          <input inputMode="numeric" value={model.draft.closingMinor} onChange={(event) => model.actions.closing(event.target.value)} required />
        </label>
        <label>
          币种
          <input value="CNY" readOnly aria-readonly="true" />
        </label>
      </div>
      <section className="financeimportchecks">
        <strong>服务端必须通过</strong>
        <ul>
          <li>渠道、账期、币种、期初、收支与期末余额守恒。</li>
          <li>每行业务凭证唯一，金额为安全整数，行哈希可复算。</li>
          <li>文件只形成账单和对账批次；任何差异进入复核，不直接写账本。</li>
        </ul>
      </section>
      <label className="financeimportconfirm">
        <input type="checkbox" checked={model.draft.confirmed} onChange={(event) => model.actions.confirmed(event.target.checked)} />
        我已核对来源、账期和余额，并确认预检完成后还需在任务中心再次确认执行。
      </label>
      {model.assurance < 2 ? (
        <Button tone="primary" onPress={model.actions.stepup}>
          完成二次验证
        </Button>
      ) : null}
      {model.error ? <p role="alert">{model.error}</p> : model.validation ? <p className="financeimporthint">{model.validation}</p> : null}
      {model.busy && model.draft.file ? (
        <div className="financeuploadprogress" role="status">
          <span>正在计算哈希并安全上传</span>
          <progress max={model.draft.file.size} value={model.uploaded}>
            {model.uploaded}
          </progress>
        </div>
      ) : null}
      <footer>
        <Button onPress={model.actions.back} isDisabled={model.busy}>
          返回上传
        </Button>
        <Button type="submit" tone="primary" isDisabled={model.busy || model.validation !== undefined}>
          {model.busy ? '正在安全上传…' : '提交并开始服务端预检'}
        </Button>
      </footer>
    </form>
  );
}

function TaskStep({ model }: Readonly<{ model: FinanceImportViewModel }>) {
  const task = model.task;
  if (!task)
    return (
      <section className="financeimportcontent">
        <p role="alert">未取得导入任务，请保持相同文件和参数后重试。</p>
        <footer>
          <Button onPress={model.actions.close}>关闭</Button>
          <Button tone="primary" onPress={model.actions.retry}>
            重试创建任务
          </Button>
        </footer>
      </section>
    );
  const needsConfirmation = model.step === 5;
  return (
    <section className="financeimportcontent">
      <header>
        <h3>{needsConfirmation ? '预检完成，等待确认执行' : model.step === 6 ? '查看任务收据' : '服务端正在预检'}</h3>
        <p>{needsConfirmation ? '服务端已锁定本次文件与预检哈希；确认前不会分片写入有效账单行。' : '任务进度来自服务端持久化检查点，关闭窗口不会中断任务。'}</p>
      </header>
      <section className="financeimporttask" role="status">
        <div>
          <strong>{chineseReference('导入任务', task.id)}</strong>
          <Status tone={task.state === 'failed' ? 'danger' : task.state === 'ready' || task.state === 'completed' ? 'success' : 'neutral'}>{chineseDomainLabel(task.state)}</Status>
        </div>
        <progress max={task.total || 1} value={Math.min(task.processed, task.total || 1)}>
          {task.processed}
        </progress>
        <dl>
          <div>
            <dt>已处理</dt>
            <dd>
              {task.processed} / {task.total || '待识别'}
            </dd>
          </div>
          <div>
            <dt>成功</dt>
            <dd>{task.succeeded}</dd>
          </div>
          <div>
            <dt>失败</dt>
            <dd>{task.failed}</dd>
          </div>
          <div>
            <dt>最近更新</dt>
            <dd>{formatDate(task.updatedAt)}</dd>
          </div>
        </dl>
      </section>
      {task.errors.length > 0 ? (
        <section className="financeimporterrors">
          <strong>预检问题</strong>
          <ul>
            {task.errors.slice(0, 5).map((error) => (
              <li key={`${error.row}:${error.reason}`}>
                第 {error.row} 行 · {chineseDomainLabel(error.reason, '字段校验未通过')}
                {error.field ? ` · ${error.field}` : ''}
              </li>
            ))}
          </ul>
          <p>完整错误报告与可重试项请在任务中心查看。</p>
        </section>
      ) : null}
      {model.error ? <p role="alert">{model.error}</p> : task.lastError ? <p role="alert">{chineseDomainLabel(task.lastError, '任务执行失败，请查看错误报告。')}</p> : null}
      <footer>
        <Button onPress={model.actions.close}>关闭</Button>
        {model.step === 4 ? (
          <Button onPress={model.actions.refresh} isDisabled={model.refreshing}>
            {model.refreshing ? '正在刷新…' : '刷新预检'}
          </Button>
        ) : null}
        <Button tone="primary" onPress={model.actions.task}>
          {needsConfirmation ? '前往核对并确认执行' : '查看完整任务收据'}
        </Button>
      </footer>
    </section>
  );
}
