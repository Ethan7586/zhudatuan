import { isActiveProductImport, presentProductImportFailure, presentProductImportField, presentProductImportIssue, presentProductImportState } from '@shop/presentation';
import type { ProductImport } from '../model/ProductImport';
import type { ProductImportViewModel } from '../viewmodel/ProductImportViewModel';

export function ProductImportOutcome({ viewmodel }: Readonly<{ viewmodel: ProductImportViewModel }>) {
  if (viewmodel.step === 4) return <ValidationStep viewmodel={viewmodel} />;
  if (viewmodel.step === 5 && viewmodel.task) return <SubmitStep viewmodel={viewmodel} task={viewmodel.task} />;
  if (viewmodel.step === 6 && viewmodel.task) return <TaskStep viewmodel={viewmodel} task={viewmodel.task} />;
  return null;
}

function ValidationStep({ viewmodel }: Readonly<{ viewmodel: ProductImportViewModel }>) {
  const failed = viewmodel.task?.state === 'failed';
  return (
    <>
      <section className="productimportstate" role="status">
        <span className="productimportspinner" aria-hidden="true" />
        <div>
          <strong>{failed ? '服务端预检未通过' : '服务端正在预检商品文件'}</strong>
          <p>{failed ? '文件未写入商品主档，可查看任务证据或更换文件后重试。' : '正在进行恶意内容扫描、格式识别、字段一致性检查和安全分片。'}</p>
        </div>
      </section>
      {viewmodel.file ? <Progress value={viewmodel.uploaded} total={viewmodel.file.size} label="文件哈希与上传进度" /> : null}
      {viewmodel.task ? <ImportIssues task={viewmodel.task} /> : null}
      {viewmodel.error ? (
        <p role="alert" className="productflowerror">
          {viewmodel.error}
        </p>
      ) : null}
      <footer className="productimportfooter">
        <button type="button" onClick={viewmodel.actions.restart} disabled={viewmodel.busy}>
          更换文件
        </button>
        {failed ? (
          <button type="button" onClick={viewmodel.actions.task}>
            查看失败任务
          </button>
        ) : null}
        <button className="productactionprimary" type="button" onClick={viewmodel.actions.retry} disabled={viewmodel.busy || (!failed && viewmodel.refreshing)}>
          {viewmodel.busy || viewmodel.refreshing ? '正在校验…' : '刷新校验结果'}
        </button>
      </footer>
    </>
  );
}

function SubmitStep({ viewmodel, task }: Readonly<{ viewmodel: ProductImportViewModel; task: ProductImport }>) {
  return (
    <>
      <section className="productimportcard">
        <strong>预检完成，等待确认</strong>
        <p>
          服务端识别 {task.total} 行、{task.columns.length} 个字段；预检摘要将在确认时按版本和 Hash 锁定。
        </p>
        <dl>
          <div>
            <dt>识别字段</dt>
            <dd>{task.columns.join('、') || '无'}</dd>
          </div>
          <div>
            <dt>阻断问题</dt>
            <dd>{task.validationErrors} 项</dd>
          </div>
          <div>
            <dt>预检版本</dt>
            <dd>第 {task.version} 版</dd>
          </div>
          <div>
            <dt>有效期</dt>
            <dd>{formatTime(task.expiresAt)}</dd>
          </div>
        </dl>
      </section>
      <p className={task.validationErrors > 0 ? 'productflowerror' : 'productflownote'}>{task.validationErrors > 0 ? '存在阻断问题，禁止提交；请查看任务并下载错误报告。' : '确认后服务端按分片写入草稿；已成功行不会因重试而重复执行。'}</p>
      <ImportIssues task={task} />
      {viewmodel.error ? (
        <p role="alert" className="productflowerror">
          {viewmodel.error}
        </p>
      ) : null}
      <footer className="productimportfooter">
        <button type="button" onClick={viewmodel.actions.task}>
          查看预检任务
        </button>
        <button className="productactionprimary" type="button" onClick={viewmodel.actions.confirm} disabled={task.validationErrors > 0 || viewmodel.busy}>
          {viewmodel.busy ? '正在提交…' : '确认并执行导入'}
        </button>
      </footer>
    </>
  );
}

function TaskStep({ viewmodel, task }: Readonly<{ viewmodel: ProductImportViewModel; task: ProductImport }>) {
  return (
    <>
      <section className="productimportstate">
        <span className={isActiveProductImport(task.state) ? 'productimportspinner' : 'productimportdone'} aria-hidden="true" />
        <div>
          <strong>{presentProductImportState(task.state).title}</strong>
          <p>任务记录已持久化；关闭窗口后仍可在任务中心继续查看。</p>
        </div>
      </section>
      <Progress value={task.processed} total={task.total} label="商品导入任务进度" />
      <section className="productimportreceipt">
        <span>成功 {task.succeeded}</span>
        <span>失败 {task.failed}</span>
        <span>可重试 {task.retryableItems}</span>
        <small>最近更新：{formatTime(task.updatedAt)}</small>
      </section>
      <ImportIssues task={task} />
      {viewmodel.error ? (
        <p role="alert" className="productflowerror">
          {viewmodel.error}
        </p>
      ) : null}
      <footer className="productimportfooter">
        <button type="button" onClick={viewmodel.actions.close}>
          关闭
        </button>
        <button className="productactionprimary" type="button" onClick={viewmodel.actions.task}>
          打开任务详情
        </button>
      </footer>
    </>
  );
}

function Progress({ value, total, label }: Readonly<{ value: number; total: number; label: string }>) {
  const bounded = total > 0 ? Math.min(value, total) : 0;
  return (
    <section className="productimportprogress" aria-label={label}>
      <div>
        <span>
          {bounded} / {total}
        </span>
        <strong>{total > 0 ? Math.floor((bounded / total) * 100) : 0}%</strong>
      </div>
      <progress max={total || 1} value={bounded} />
    </section>
  );
}

function ImportIssues({ task }: Readonly<{ task: ProductImport }>) {
  if (task.last_error === null && task.errors.length === 0 && task.report === undefined) return null;
  return (
    <section className="productimportissues">
      <strong>服务端校验结果</strong>
      {task.last_error ? <p>{presentProductImportFailure(task.last_error)}</p> : null}
      {task.errors.length > 0 ? (
        <ul>
          {task.errors.slice(0, 5).map((error) => (
            <li key={`${error.row_number}:${error.reason_code}`}>
              <span>
                第 {error.row_number} 行{error.field ? ` · ${presentProductImportField(error.field)}` : ''}
              </span>
              <strong>{presentProductImportIssue(error.reason_code)}</strong>
            </li>
          ))}
        </ul>
      ) : null}
      {task.report ? (
        <a href={task.report.download} target="_blank" rel="noreferrer">
          下载完整错误报告（{formatBytes(task.report.size)}）
        </a>
      ) : null}
    </section>
  );
}

function formatBytes(value: number): string {
  return value < 1024 * 1024 ? `${(value / 1024).toFixed(1)} KiB` : `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}
function formatTime(value: string | null): string {
  return value === null ? '—' : new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
