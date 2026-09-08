import { Button } from '@shop/design';
import { formatMinor } from '../../../shared/ui/Format';
import type { FinanceOverview } from '../model/Finance';
import { FinanceIcon } from './FinanceIcon';

export function FinanceHeader({
  title,
  description,
  overview,
  summary,
  fetching,
  statusText,
  lastUpdated,
  refreshResult,
  onRefresh,
}: Readonly<{
  title: string;
  description?: string;
  overview?: FinanceOverview | undefined;
  summary?: readonly Readonly<{ label: string; value: string }>[];
  fetching: boolean;
  statusText?: string;
  lastUpdated?: string | null;
  refreshResult?: string;
  onRefresh: () => void;
}>) {
  const primary = overview?.items[0];
  return (
    <>
      <header className="financepageheader">
        <div>
          <p>财务管控</p>
          <h1>{title}</h1>
          <span>{description ?? '以权威账本为准核对余额、负债、收支和现金，每一笔账务均可追溯'}</span>
        </div>
        <Button className="financerefreshbutton" onPress={onRefresh} isDisabled={fetching} aria-label={fetching ? '正在刷新财务数据' : '刷新财务数据'}>
          <FinanceIcon name="refresh" />
          {fetching ? '刷新中' : '刷新'}
        </Button>
      </header>
      <section className="financestatusrail" aria-label="财务状态摘要">
        <dl>
          {summary?.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          )) ?? (
            <>
              <div>
                <dt>币种</dt>
                <dd>{primary?.currency ?? '—'}</dd>
              </div>
              <div>
                <dt>账面余额</dt>
                <dd>{primary ? formatMinor(primary.balanceMinor, primary.currency) : '—'}</dd>
              </div>
              <div>
                <dt>现金</dt>
                <dd>{primary ? formatMinor(primary.cashMinor, primary.currency) : '—'}</dd>
              </div>
              <div>
                <dt>分录数</dt>
                <dd>{primary?.journalCount.toLocaleString('zh-CN') ?? '—'}</dd>
              </div>
            </>
          )}
        </dl>
        <div>
          <span>{statusText ?? `数据截止 ${formatWatermark(primary?.watermark)}`}</span>
        </div>
      </section>
      {refreshResult ? (
        <p className="financerefreshresult" role="status">
          {refreshResult}
          {lastUpdated ? ` 最近成功：${formatWatermark(lastUpdated)}` : ''}
        </p>
      ) : null}
    </>
  );
}

function formatWatermark(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}
