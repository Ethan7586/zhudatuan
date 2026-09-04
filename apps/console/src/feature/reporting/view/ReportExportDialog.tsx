import { Button, Dialog } from '@shop/design';
import type { ReportingViewModel } from '../viewmodel/ReportingViewModel';
import { periodLabels, reportLabels } from './ReportingPresentation';

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
            <dd>当前 Scope</dd>
          </div>
          <div>
            <dt>任务状态</dt>
            <dd>{job ? jobState(job.state) : '尚未提交'}</dd>
          </div>
        </dl>
        {model.export.error ? (
          <p role="alert" className="reporterror">
            {model.export.error}
          </p>
        ) : null}
        {job ? <p role="status">已处理 {new Intl.NumberFormat('zh-CN').format(job.recordCount)} 条；文件必须通过哈希、大小、MIME 与病毒扫描校验后才会出现下载入口。</p> : null}
        {job?.download && job.scanState === 'clean' ? (
          <a className="shopbutton shopbuttonprimary reportdownload" href={job.download.url} rel="noreferrer">
            下载 CSV（短期有效）
          </a>
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
              使用原命令重试
            </Button>
          ) : null}
        </footer>
      </div>
    </Dialog>
  );
}

function jobState(value: 'queued' | 'running' | 'completed' | 'failed' | 'expired'): string {
  return ({ queued: '等待处理', running: '正在生成', completed: '已完成', failed: '生成失败', expired: '链接已过期' } as const)[value];
}
