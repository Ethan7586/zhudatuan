import { formatMinor } from '../../shared/ui/Format';
import type { ReactNode } from 'react';
import { FinanceIcon } from './FinanceIcon';
import type { FinanceReconciliation, FinanceReconciliationPage } from './FinanceWorkspaceSchema';

export type FinanceColumnKey = 'channel' | 'scope' | 'expected' | 'matched' | 'differences' | 'channelAmount' | 'ledgerAmount' | 'differenceAmount' | 'state' | 'time';

export const defaultFinanceColumns: ReadonlySet<FinanceColumnKey> = new Set(['channel', 'scope', 'expected', 'matched', 'differences', 'channelAmount', 'ledgerAmount', 'differenceAmount', 'state', 'time']);

export function ReconciliationTable({
  page,
<<<<<<< HEAD
<<<<<<< HEAD
  caption,
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  caption,
>>>>>>> 018b2a71 (chore(release): capture current production source)
  previewEnabled,
  visible,
  selected,
  onToggle,
  onToggleAll,
  onOpen,
}: Readonly<{
  page: FinanceReconciliationPage;
<<<<<<< HEAD
<<<<<<< HEAD
  caption: string;
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  caption: string;
>>>>>>> 018b2a71 (chore(release): capture current production source)
  previewEnabled: boolean;
  visible: ReadonlySet<FinanceColumnKey>;
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onOpen: (id: string) => void;
}>) {
  const allSelected = page.items.length > 0 && page.items.every((row) => selected.has(row.id));
  return (
    <div className="financetablewrap">
      <table className="financetable">
<<<<<<< HEAD
<<<<<<< HEAD
        <caption className="sr-only">{caption}</caption>
=======
        <caption className="sr-only">支付对账批次</caption>
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
        <caption className="sr-only">{caption}</caption>
>>>>>>> 018b2a71 (chore(release): capture current production source)
        <thead>
          <tr>
            <th className="financecheckcell">
              <input type="checkbox" aria-label="选择当前页全部对账批次" checked={allSelected} onChange={onToggleAll} />
            </th>
            <th>对账批次 / 账期</th>
            {visible.has('channel') ? <th>渠道 / 数据源</th> : null}
            {visible.has('scope') ? <th>所属范围</th> : null}
            {visible.has('expected') ? <th>应对账</th> : null}
            {visible.has('matched') ? <th>已匹配</th> : null}
            {visible.has('differences') ? <th>差异</th> : null}
            {visible.has('channelAmount') ? <th>渠道金额</th> : null}
            {visible.has('ledgerAmount') ? <th>账本金额</th> : null}
            {visible.has('differenceAmount') ? <th>差额</th> : null}
            {visible.has('state') ? <th>状态</th> : null}
            {visible.has('time') ? <th>完成 / 更新时间</th> : null}
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {page.items.map((row) => (
            <ReconciliationRow key={row.id} row={row} previewEnabled={previewEnabled} visible={visible} checked={selected.has(row.id)} onToggle={() => onToggle(row.id)} onOpen={() => onOpen(row.id)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReconciliationRow({
  row,
  previewEnabled,
  visible,
  checked,
  onToggle,
  onOpen,
}: Readonly<{
  row: FinanceReconciliation;
  previewEnabled: boolean;
  visible: ReadonlySet<FinanceColumnKey>;
  checked: boolean;
  onToggle: () => void;
  onOpen: () => void;
}>) {
  const preview = previewEnabled && row.preview?.source === 'local-preview' ? row.preview : undefined;
<<<<<<< HEAD
<<<<<<< HEAD
  const canOpen = row.items.some((item) => item.state === 'difference' || item.state === 'resolutionpending');
=======
  const canOpen = row.items.length > 0;
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  const canOpen = row.items.some((item) => item.state === 'difference' || item.state === 'resolutionpending');
>>>>>>> 018b2a71 (chore(release): capture current production source)
  return (
    <tr className={row.state === 'difference' || row.state === 'resolutionpending' ? 'hasdifference' : undefined} onClick={canOpen ? onOpen : undefined}>
      <td className="financecheckcell" onClick={(event) => event.stopPropagation()}>
        <input type="checkbox" aria-label={`选择对账批次 ${preview?.batchId ?? row.id}`} checked={checked} onChange={onToggle} />
      </td>
      <td>
        <span className="financecellpair">
          <strong>{preview?.batchId ?? row.id}</strong>
          <small>{preview?.accountingDate ?? row.period}</small>
        </span>
      </td>
      {visible.has('channel') ? (
        <td>
          <span className="financecellpair">
            <strong>{preview?.channelLabel ?? row.provider}</strong>
            <small>{preview?.dataSourceLabel ?? row.statement_ref ?? '数据源未提供'}</small>
          </span>
        </td>
      ) : null}
      {visible.has('scope') ? <td>{preview?.scopeLabel ?? row.partner_id}</td> : null}
      {visible.has('expected') ? <td>{count(preview?.expectedCount)}</td> : null}
      {visible.has('matched') ? <td>{count(preview?.matchedCount ?? row.item_counts.matched)}</td> : null}
      {visible.has('differences') ? <td>{count(preview?.differenceCount ?? row.item_counts.difference, true)}</td> : null}
      {visible.has('channelAmount') ? <td className="financemoney">{formatMinor(row.debit_minor)}</td> : null}
      {visible.has('ledgerAmount') ? <td className="financemoney">{formatMinor(row.credit_minor)}</td> : null}
      {visible.has('differenceAmount') ? <td className={row.difference_minor === 0 ? 'financemoney' : 'financemoney financedifference'}>{formatMinor(row.difference_minor)}</td> : null}
      {visible.has('state') ? (
        <td>
          <FinanceState state={row.state} />
        </td>
      ) : null}
      {visible.has('time') ? <td>{formatTime(preview?.completedAt ?? row.updated_at)}</td> : null}
      <td>
        <button
          className="financeviewbutton"
          type="button"
          disabled={!canOpen}
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
        >
          {canOpen ? '查看差异' : '无差异'}
        </button>
      </td>
    </tr>
  );
}

export function FinanceState({ state }: Readonly<{ state: string }>) {
  const label = state === 'difference' ? '有差异' : state === 'balanced' ? '已对平' : state === 'pending-review' || state === 'resolutionpending' ? '待复核' : state === 'approved' ? '已批准' : state;
  const tone = state === 'difference' ? 'warning' : state === 'balanced' || state === 'approved' ? 'success' : state === 'pending-review' || state === 'resolutionpending' ? 'info' : 'neutral';
  return (
    <span className="financestate" data-tone={tone}>
      {tone === 'success' ? <FinanceIcon name="check" /> : null}
      {label}
    </span>
  );
}

export function FinancePagination({
  page,
  previewEnabled,
  limit,
  onLimit,
  onCursor,
}: Readonly<{
  page: FinanceReconciliationPage;
  previewEnabled: boolean;
  limit: number;
  onLimit: (limit: number) => void;
  onCursor: (cursor?: string) => void;
}>) {
  const preview = previewEnabled && page.preview?.source === 'local-preview' ? page.preview : undefined;
  const start = preview === undefined || page.count === 0 ? undefined : (preview.page - 1) * limit + 1;
  const end = start === undefined ? undefined : start + page.count - 1;
  return (
    <footer className="financepagination">
      <span>{preview === undefined ? `本页 ${page.count} 笔` : `${start}–${end} / 共 ${preview.total} 笔`}</span>
      <label>
        每页{' '}
        <select value={limit} onChange={(event) => onLimit(Number(event.target.value))}>
          <option value="20">20</option>
          <option value="50">50</option>
        </select>
      </label>
      <div>
        <button type="button" aria-label="上一页" disabled={preview?.previousCursor === undefined} onClick={() => onCursor(preview?.previousCursor)}>
          <FinanceIcon name="arrowLeft" />
        </button>
        <span aria-label={`第 ${preview?.page ?? 1} 页`}>{preview?.page ?? 1}</span>
        <button type="button" aria-label="下一页" disabled={page.nextCursor === undefined} onClick={() => onCursor(page.nextCursor)}>
          <FinanceIcon name="arrowRight" />
        </button>
      </div>
    </footer>
  );
}

function count(value: number | undefined, difference = false): ReactNode {
  if (value === undefined) return '—';
  return difference && value > 0 ? <strong className="financecountwarning">{value} 笔</strong> : `${value} 笔`;
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}
