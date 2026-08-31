import { Button, Dialog } from '@shop/design';
import { FinanceIcon } from './FinanceIcon';

<<<<<<< HEAD
<<<<<<< HEAD
export type FinanceHeaderAction = 'start';
=======
export type FinanceHeaderAction = 'export' | 'start';
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
export type FinanceHeaderAction = 'start';
>>>>>>> 018b2a71 (chore(release): capture current production source)

export function FinanceHeader({
  summary,
  previewEnabled,
  fetching,
  action,
<<<<<<< HEAD
<<<<<<< HEAD
  exportReady,
  onImport,
  onExport,
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  exportReady,
  onImport,
  onExport,
>>>>>>> 018b2a71 (chore(release): capture current production source)
  onAction,
  onCloseAction,
  onRefresh,
}: Readonly<{
  summary: FinanceStatusSummary | undefined;
  previewEnabled: boolean;
  fetching: boolean;
  action: FinanceHeaderAction | undefined;
<<<<<<< HEAD
<<<<<<< HEAD
  exportReady: boolean;
  onImport: () => void;
  onExport: () => void;
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  exportReady: boolean;
  onImport: () => void;
  onExport: () => void;
>>>>>>> 018b2a71 (chore(release): capture current production source)
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
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
          <button type="button" title="选择本地 CSV 文件，本期不会上传" onClick={onImport}>
            <FinanceIcon name="arrowRight" />
            导入
          </button>
          <button type="button" disabled={!exportReady} title={exportReady ? '仅导出当前已加载页，不包含其他分页' : '数据加载中'} onClick={onExport}>
<<<<<<< HEAD
            <FinanceIcon name="download" />
            导出当前页
=======
          <button type="button" disabled={!previewEnabled} title={previewEnabled ? '查看导出安全边界' : '正式导出旅程尚未闭合'} onClick={() => onAction('export')}>
            <FinanceIcon name="download" />
            导出对账单
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
            <FinanceIcon name="download" />
            导出当前页
>>>>>>> 018b2a71 (chore(release): capture current production source)
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
<<<<<<< HEAD
<<<<<<< HEAD
        导入只提供本地文件交互预览，文件不会上传；当前页导出只使用浏览器已经加载的数据。发起对账仍保持现有安全边界。
=======
        导出和发起对账缺少完整安全旅程，生产范围保持关闭。
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
        导入只提供本地文件交互预览，文件不会上传；当前页导出只使用浏览器已经加载的数据。发起对账仍保持现有安全边界。
>>>>>>> 018b2a71 (chore(release): capture current production source)
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
<<<<<<< HEAD
<<<<<<< HEAD
  return (
    <Dialog open={action !== undefined} title="发起对账 · 安全预览" eyebrow="LOCAL SAFE PREVIEW" onClose={onClose}>
      <div className="financeactionpreview">
        <FinanceIcon name="shield" />
        <div>
          <strong>当前不会创建对账批次</strong>
          <p>系统尚无受控的对账创建 Operation；需由渠道账单同步与任务回执建立批次。</p>
=======
  const exportAction = action === 'export';
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  return (
    <Dialog open={action !== undefined} title="发起对账 · 安全预览" eyebrow="LOCAL SAFE PREVIEW" onClose={onClose}>
      <div className="financeactionpreview">
        <FinanceIcon name="shield" />
        <div>
<<<<<<< HEAD
          <strong>{exportAction ? '当前不会生成或下载正式账单' : '当前不会创建对账批次'}</strong>
          <p>{exportAction ? '正式导出需要服务端 Filter Snapshot、Level 3 二次验证与 Operation 回执。' : '系统尚无受控的对账创建 Operation；需由渠道账单同步与任务回执建立批次。'}</p>
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
          <strong>当前不会创建对账批次</strong>
          <p>系统尚无受控的对账创建 Operation；需由渠道账单同步与任务回执建立批次。</p>
>>>>>>> 018b2a71 (chore(release): capture current production source)
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
