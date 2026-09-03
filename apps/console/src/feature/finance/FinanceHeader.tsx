import { useRouteTitle } from '../../shared/ui/RouteTitle';
import { FinanceIcon } from './FinanceIcon';

export function FinanceHeader({ fetching, onRefresh }: Readonly<{ fetching: boolean; onRefresh: () => void }>) {
  const title = useRouteTitle('财务');
  return (
    <>
      <header className="financepageheader">
        <div>
          <p>财务管控</p>
          <h1>{title}</h1>
          <span>核对支付、退款、渠道账单与账本记录，确保每笔账款可追溯、可复核</span>
        </div>
        <div className="financepageactions" aria-describedby="financeactionboundary">
          <button type="button" disabled title="正式导出旅程尚未闭合">
            <FinanceIcon name="download" />
            导出对账单
          </button>
          <button className="financeprimarybutton" type="button" disabled title="缺少受控创建能力">
            <FinanceIcon name="plus" />
            发起对账
          </button>
        </div>
      </header>
      <section className="financestatusrail" aria-label="财务状态摘要">
        <dl>
          <div>
            <dt>账务日</dt>
            <dd>服务端未提供</dd>
          </div>
          <div>
            <dt>最近对账</dt>
            <dd>服务端未提供</dd>
          </div>
          <div className="financewarningmetric">
            <dt>差异待处理</dt>
            <dd>—</dd>
          </div>
          <div>
            <dt>等待复核</dt>
            <dd>—</dd>
          </div>
        </dl>
        <div>
          <span>数据截止 服务端未提供</span>
          <button type="button" onClick={onRefresh} disabled={fetching} aria-label={fetching ? '正在刷新财务数据' : '刷新财务数据'}>
            <FinanceIcon name="refresh" />
          </button>
        </div>
      </section>
      <p id="financeactionboundary" className="sr-only">
        导出和发起对账缺少完整安全旅程，生产范围保持关闭。
      </p>
    </>
  );
}
