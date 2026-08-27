import { Button, Dialog } from '@shop/design';
import { FinanceIcon } from './FinanceIcon';

export type FinanceHeaderAction = 'export' | 'start';

export function FinanceHeader({
  summary,
  previewEnabled,
  fetching,
  action,
  onAction,
  onCloseAction,
  onRefresh,
}: Readonly<{
  summary: FinanceStatusSummary | undefined;
  previewEnabled: boolean;
  fetching: boolean;
  action: FinanceHeaderAction | undefined;
  onAction: (action: FinanceHeaderAction) => void;
  onCloseAction: () => void;
  onRefresh: () => void;
}>) {
  const preview = previewEnabled ? summary : undefined;
  return (
    <>
      <header className="financepageheader">
        <div>
          <p>FINANCE CONTROL</p>
          <h1>财务与对账系统</h1>
          <span>核对支付、退款、渠道账单与账本记录，确保每笔账款可追溯、可复核</span>
        </div>
        <div className="financepageactions" aria-describedby="financeactionboundary">
          <button type="button" disabled={!previewEnabled} title={previewEnabled ? '查看导出安全边界' : '正式导出旅程尚未闭合'} onClick={() => onAction('export')}>
            <FinanceIcon name="download" />
            导出对账单
          </button>
          <button className="financeprimarybutton" type="button" disabled={!previewEnabled} title={previewEnabled ? '查看发起对账安全边界' : '缺少受控创建 Operation'} onClick={() => onAction('start')}>
            <FinanceIcon name="plus" />
            发起对账
          </button>
        </div>
      </header>
      <section className="financestatusrail" aria-label="财务状态摘要">
        <dl>
          <div>
            <dt>账务日</dt>
            <dd>{preview?.accountingDate ?? '服务端未提供'}</dd>
          </div>
          <div>
            <dt>最近对账</dt>
            <dd>{formatTime(preview?.lastReconciledAt)}</dd>
          </div>
          <div className="financewarningmetric">
            <dt>差异待处理</dt>
            <dd>{preview === undefined ? '—' : `${preview.pendingDifferenceCount} 项`}</dd>
          </div>
          <div>
            <dt>等待复核</dt>
            <dd>{preview === undefined ? '—' : `${preview.pendingReviewCount} 项`}</dd>
          </div>
        </dl>
        <div>
          <span>数据截止 {formatTime(preview?.asOf)}</span>
          <button type="button" onClick={onRefresh} disabled={fetching} aria-label={fetching ? '正在刷新财务数据' : '刷新财务数据'}>
            <FinanceIcon name="refresh" />
          </button>
        </div>
      </section>
      <p id="financeactionboundary" className="sr-only">
        导出和发起对账缺少完整安全旅程，生产范围保持关闭。
      </p>
      <FinanceActionBoundaryDialog action={action} onClose={onCloseAction} />
    </>
  );
}

export interface FinanceStatusSummary {
  readonly asOf: string;
  readonly accountingDate: string;
  readonly lastReconciledAt: string;
  readonly pendingDifferenceCount: number;
  readonly pendingReviewCount: number;
}

function FinanceActionBoundaryDialog({ action, onClose }: Readonly<{ action: FinanceHeaderAction | undefined; onClose: () => void }>) {
  const exportAction = action === 'export';
  return (
    <Dialog open={action !== undefined} title={exportAction ? '导出对账单 · 安全预览' : '发起对账 · 安全预览'} eyebrow="LOCAL SAFE PREVIEW" onClose={onClose}>
      <div className="financeactionpreview">
        <FinanceIcon name="shield" />
        <div>
          <strong>{exportAction ? '当前不会生成或下载正式账单' : '当前不会创建对账批次'}</strong>
          <p>{exportAction ? '正式导出需要服务端 Filter Snapshot、Level 3 二次验证与 Operation 回执。' : '系统尚无受控的对账创建 Operation；需由渠道账单同步与任务回执建立批次。'}</p>
        </div>
      </div>
      <div className="financeactiondialogfooter">
        <Button onPress={onClose}>我知道了</Button>
      </div>
    </Dialog>
  );
}

function formatTime(value: string | undefined): string {
  if (value === undefined) return '服务端未提供';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
}
