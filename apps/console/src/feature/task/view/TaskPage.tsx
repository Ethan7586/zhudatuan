import { Button, DataTable, MetricGrid, ResourcePanel, type DataColumn } from '@shop/design';
import { chineseDomainLabel, chineseReference, chineseSectionLabel } from '@shop/presentation';
import { formatCount, formatDate } from '../../../shared/ui/Format';
import type { ImportIssue } from '../model/ImportTask';
import type { TaskViewModel } from '../viewmodel/TaskViewModel';

const columns: readonly DataColumn<ImportIssue>[] = [
  { key: 'row', label: '行号', render: (row) => row.row },
  { key: 'reason', label: '错误原因', render: (row) => issueText(row.code) },
  { key: 'field', label: '字段', render: (row) => (row.field ? chineseDomainLabel(row.field, '导入字段') : '—') },
  { key: 'detail', label: '说明', render: (row) => detailText(row.detail) },
];
export function TaskPage({ title, model }: Readonly<{ title: string; model: TaskViewModel }>) {
  const task = model.task;
  return (
    <ResourcePanel
      title={title}
      eyebrow={chineseSectionLabel('长任务中心')}
      description={task ? `${kindText(task.kind)} · ${chineseReference('导入任务', task.id)}；进度、错误行和报告由服务端持久化。` : '读取可恢复的后台导入任务。'}
      condition={model.condition}
      {...(model.error ? { error: model.error } : {})}
      retry={model.actions.refresh}
      actions={
        <>
          {model.assurance < 2 ? (
            <Button tone="primary" onPress={model.actions.stepup}>
              完成二次验证
            </Button>
          ) : null}
          <Button onPress={model.actions.refresh} isDisabled={model.fetching}>
            {model.fetching ? '正在刷新…' : '刷新进度'}
          </Button>
        </>
      }
    >
      {task ? (
        <div className="featurestack">
          <MetricGrid
            items={[
              { label: '任务状态', value: chineseDomainLabel(task.state) },
              { label: '总行数', value: formatCount(task.totalCount) },
              { label: '已处理', value: formatCount(task.cursor) },
              { label: '成功', value: formatCount(task.successCount), tone: 'success' },
              { label: '失败', value: formatCount(task.failureCount), tone: task.failureCount > 0 ? 'danger' : 'success' },
              { label: '更新时间', value: formatDate(task.updatedAt) },
            ]}
          />
          {Object.keys(task.validation).length > 0 ? (
            <section className="capabilitynote">
              <h2>服务端校验摘要</h2>
              <p>{validationText(task.validation)}</p>
            </section>
          ) : null}
          {task.lastError ? (
            <section className="capabilitynote">
              <h2>任务错误</h2>
              <p>{issueText(task.lastError)}</p>
            </section>
          ) : null}
          {task.report ? (
            <section className="capabilitynote">
              <h2>结果报告</h2>
              <p>
                报告大小 {formatCount(task.report.size)} 字节，SHA-256 {task.report.sha256}
              </p>
              {model.download ? (
                <a className="shopbutton" href={model.download} rel="noreferrer">
                  下载短期报告
                </a>
              ) : (
                <p role="alert">报告地址不安全或已失效，请刷新后重试。</p>
              )}
            </section>
          ) : null}
          <DataTable caption="导入错误行" columns={columns} rows={task.issues} rowKey={(row) => `${row.row}:${row.code}:${row.field ?? ''}`} />
        </div>
      ) : null}
    </ResourcePanel>
  );
}
function kindText(kind: 'member' | 'catalog' | 'voucher') {
  return kind === 'member' ? '成员导入' : kind === 'catalog' ? '商品导入' : '卡券导入';
}
function issueText(value: string) {
  const text = value.toLowerCase();
  if (text.includes('required')) return '缺少必填内容';
  if (text.includes('format') || text.includes('invalid')) return '内容格式不正确';
  if (text.includes('duplicate') || text.includes('conflict')) return '内容重复或已存在';
  return '导入内容需要人工检查';
}
function detailText(value: string) {
  return value.length <= 240 ? value : `${value.slice(0, 237)}…`;
}
function validationText(value: NonNullable<TaskViewModel['task']>['validation']) {
  const parts = [
    value.format ? `格式 ${value.format.toUpperCase()}` : undefined,
    value.rows === undefined ? undefined : `识别 ${formatCount(value.rows)} 行`,
    value.processed === undefined ? undefined : `已处理 ${formatCount(value.processed)} 行`,
    value.errors === undefined ? undefined : `发现 ${formatCount(value.errors)} 个问题`,
    value.shardSize === undefined ? undefined : `每批 ${formatCount(value.shardSize)} 行`,
    value.encryptedStaging ? '暂存区已加密' : undefined,
    value.columns?.length ? `字段：${value.columns.join('、')}` : undefined,
    value.code ? issueText(value.code) : undefined,
  ].filter((item): item is string => item !== undefined);
  return parts.join('；') || '服务端已完成基础校验。';
}
