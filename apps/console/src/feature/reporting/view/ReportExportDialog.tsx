import { Button, Dialog } from '@shop/design';
import type { ReportingViewModel } from '../viewmodel/ReportingViewModel';
import { periodLabels, reportLabels } from './ReportingPresentation';
import type { ReportExport } from '../model/Report';
import { formatDate } from '../../../shared/ui/Format';

export function ReportExportDialog({ model }: Readonly<{ model: ReportingViewModel }>) {
  const job = model.export.job;
  return (
    <Dialog
      open={model.export.open}
      title="导出当前报表"
      eyebrow="安全快照导出"
      description="服务端冻结当前范围与筛选，逐页生成 CSV；所有以 =、+、-、@ 开头的单元格都会被安全转义。"
      onClose={model.actions.closeExport}
      dismissable={!model.export.pending}
    >
      <div className="reportexport">
        <dl>
          <div>
            <dt>报表</dt>
            <dd>{reportLabels[model.view]}</dd>
          </div>
          <div>
            <dt>周期</dt>
            <dd>{periodLabels[model.period]}</dd>
          </div>
          <div>
            <dt>数据范围</dt>
            <dd>当前业务范围</dd>
          </div>
          <div>
            <dt>任务状态</dt>
            <dd>{job ? jobState(job.state) : '尚未提交'}</dd>
          </div>
          <div>
            <dt>文件校验</dt>
            <dd>{job ? scanState(job.scanState) : '等待任务创建'}</dd>
          </div>
          <div>
            <dt>下载有效期</dt>
            <dd>{job?.download ? formatDate(job.download.expiresAt) : '生成安全链接后显示'}</dd>
          </div>
        </dl>
        {model.export.error ? (
          <p role="alert" className="reporterror">
            {model.export.error}
          </p>
        ) : null}
        {job ? <p role="status">{jobMessage(job)}</p> : null}
        {job?.download && job.scanState === 'clean' ? (
          <a className="shopbutton shopbuttonprimary reportdownload" href={job.download.url} rel="noreferrer">
            下载 CSV（短期有效）
          </a>
        ) : null}
        {job?.state === 'completed' && job.scanState === 'clean' && !job.download ? (
          <Button onPress={model.actions.refreshDownload}>重新获取下载地址</Button>
        ) : null}
        <footer>
          <Button onPress={model.actions.closeExport} isDisabled={model.export.pending}>
            关闭
          </Button>
          {job ? null : (
            <Button tone="primary" onPress={model.actions.submitExport} isDisabled={model.export.pending}>
              {model.export.pending ? '正在创建…' : '确认创建导出'}
            </Button>
          )}
          {model.export.error ? (
            <Button tone="primary" onPress={model.actions.retryExport}>
              重试当前步骤
            </Button>
          ) : null}
          {job && restartable(job) ? (
            <Button tone="primary" onPress={model.actions.restartExport} isDisabled={model.export.pending}>
              重新创建导出
            </Button>
          ) : null}
        </footer>
      </div>
    </Dialog>
  );
}

function jobState(value: ReportExport['state']): string {
  return ({ queued: '等待处理', running: '正在生成', completed: '已完成', failed: '生成失败', expired: '链接已过期' } as const)[value];
}

function scanState(value: ReportExport['scanState']): string {
  if (value === null) return '等待文件生成';
  return ({ pending: '正在安全检查', clean: '安全检查通过', rejected: '安全检查未通过' } as const)[value];
}

function jobMessage(job: ReportExport): string {
  const count = new Intl.NumberFormat('zh-CN').format(job.recordCount);
  if (job.scanState === 'rejected') return `已处理 ${count} 条，但文件未通过安全检查，不能下载。请重新创建导出。`;
  if (job.state === 'failed') return `已处理 ${count} 条，生成任务失败。可使用新命令重新创建。`;
  if (job.state === 'expired') return `原导出已过期，共 ${count} 条。请重新创建以取得新的安全文件。`;
  if (job.state === 'completed' && job.scanState === 'clean') return `已处理 ${count} 条，文件安全检查通过。`;
  return `已处理 ${count} 条；文件通过哈希、大小、MIME 与病毒扫描校验后才会出现下载入口。`;
}

function restartable(job: ReportExport): boolean {
  return job.state === 'failed' || job.state === 'expired' || job.scanState === 'rejected';
}
