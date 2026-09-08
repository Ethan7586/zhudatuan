import { Button } from '@shop/design';
import { formatMinor } from '../../../shared/ui/Format';
import { chineseDomainLabel, chineseProviderLabel, chineseReference } from '@shop/presentation';
import type { ReactNode } from 'react';
import { FinanceIcon } from './FinanceIcon';
import type { FinanceColumnKey, FinanceReconciliation, FinanceReconciliationPage } from '../model/Finance';

export function ReconciliationTable({
  page,
  visible,
  selected,
  onToggle,
  onToggleAll,
  onOpen,
}: Readonly<{
  page: FinanceReconciliationPage;
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
        <caption className="sr-only">支付对账批次</caption>
        <thead>
          <tr>
            <th className="financecheckcell">
              <input type="checkbox" aria-label="选择当前页全部对账批次" checked={allSelected} onChange={onToggleAll} />
            </th>
            <th>对账批次 / 账期</th>
            {visible.has('channel') ? <th>渠道 / 数据源</th> : null}
            {visible.has('scope') ? <th>所属范围</th> : null}
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
            <ReconciliationRow key={row.id} row={row} visible={visible} checked={selected.has(row.id)} onToggle={() => onToggle(row.id)} onOpen={() => onOpen(row.id)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReconciliationRow({
  row,
  visible,
  checked,
  onToggle,
  onOpen,
}: Readonly<{
  row: FinanceReconciliation;
  visible: ReadonlySet<FinanceColumnKey>;
  checked: boolean;
  onToggle: () => void;
  onOpen: () => void;
}>) {
  const canOpen = row.items.length > 0;
  return (
    <tr className={row.state === 'difference' || row.state === 'resolutionpending' ? 'hasdifference' : undefined} onClick={canOpen ? onOpen : undefined}>
      <td className="financecheckcell" data-label="选择" onClick={(event) => event.stopPropagation()}>
        <input type="checkbox" aria-label={`选择${chineseReference('对账批次', row.id)}`} checked={checked} onChange={onToggle} />
      </td>
      <td data-label="对账批次 / 账期">
        <span className="financecellpair">
          <strong>{chineseReference('对账批次', row.id)}</strong>
          <small>{row.period}</small>
        </span>
      </td>
      {visible.has('channel') ? (
        <td data-label="渠道 / 数据源">
          <span className="financecellpair">
            <strong>{chineseProviderLabel(row.provider)}</strong>
            <small>{row.statementRef ? chineseReference('渠道账单', row.statementRef) : '未关联渠道账单'}</small>
          </span>
        </td>
      ) : null}
      {visible.has('scope') ? <td data-label="所属范围">{chineseReference('合作方', row.partnerId)}</td> : null}
      {visible.has('matched') ? (
        <td data-label="已匹配">
          <span className="financecellpair">
            <strong>{count(row.itemCounts.matched)}</strong>
            <small>{row.statementHash ? '账单校验完成' : '等待账单校验'}</small>
          </span>
        </td>
      ) : null}
      {visible.has('differences') ? <td data-label="差异">{count(row.itemCounts.difference, true)}</td> : null}
      {visible.has('channelAmount') ? (
        <td className="financemoney" data-label="渠道金额">
          {formatMinor(row.debitMinor)}
        </td>
      ) : null}
      {visible.has('ledgerAmount') ? (
        <td className="financemoney" data-label="账本金额">
          {formatMinor(row.creditMinor)}
        </td>
      ) : null}
      {visible.has('differenceAmount') ? (
        <td className={row.differenceMinor === 0 ? 'financemoney' : 'financemoney financedifference'} data-label="差额">
          {formatMinor(row.differenceMinor)}
        </td>
      ) : null}
      {visible.has('state') ? (
        <td data-label="状态">
          <FinanceState state={row.state} />
        </td>
      ) : null}
      {visible.has('time') ? <td data-label="完成 / 更新时间">{formatTime(row.updatedAt)}</td> : null}
      <td data-label="操作">
        {canOpen ? (
          <Button
            className="financeviewbutton"
            tone="quiet"
            onClick={(event) => {
              event.stopPropagation();
            }}
            onPress={onOpen}
          >
            查看差异
          </Button>
        ) : (
          <span className="financenodifference">无差异</span>
        )}
      </td>
    </tr>
  );
}

export function FinanceState({ state }: Readonly<{ state: string }>) {
  const label = state === 'difference' ? '有差异' : state === 'balanced' ? '已对平' : state === 'pending-review' || state === 'resolutionpending' ? '待复核' : chineseDomainLabel(state, '待识别状态');
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
  limit,
  hasCursor,
  onLimit,
  onCursor,
}: Readonly<{
  page: FinanceReconciliationPage;
  limit: number;
  hasCursor: boolean;
  onLimit: (limit: 20 | 50) => void;
  onCursor: (cursor?: string) => void;
}>) {
  return (
    <footer className="financepagination">
      <span>本页 {page.count} 笔</span>
      <label>
        每页{' '}
        <select value={limit} onChange={(event) => onLimit(event.target.value === '20' ? 20 : 50)}>
          <option value="20">20</option>
          <option value="50">50</option>
        </select>
      </label>
      <div>
        {hasCursor ? (
          <Button tone="quiet" aria-label="返回第一页" onPress={() => onCursor()}>
            <FinanceIcon name="arrowLeft" />
          </Button>
        ) : null}
        <span>当前页</span>
        {page.nextCursor === undefined ? null : (
          <Button tone="quiet" aria-label="下一页" onPress={() => onCursor(page.nextCursor)}>
            <FinanceIcon name="arrowRight" />
          </Button>
        )}
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
