import { formatMinor } from '../../shared/ui/Format';
import { chineseReference } from '@shop/presentation';
import { aftersaleLabel, aftersaleReasonLabel, aftersaleTone, formatOrderTime } from './OrderPresentation';
import type { AfterSaleRecord } from './AfterSaleSchema';

export function AfterSaleTable({
  rows,
  activeOrder,
  onOpen,
}: Readonly<{
  rows: readonly AfterSaleRecord[];
  activeOrder?: string;
  onOpen: (order: string) => void;
}>) {
  return (
    <div className="ordertablewrap">
      <table className="ordertable">
        <caption className="sr-only">售后订单列表</caption>
        <thead>
          <tr>
            <th scope="col">售后单 / 时间</th>
            <th scope="col">订单</th>
            <th scope="col">原因 / 说明</th>
            <th scope="col">预计退款</th>
            <th scope="col">状态</th>
            <th scope="col">退货</th>
            <th scope="col">时间线</th>
            <th scope="col">操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((sale) => (
            <AfterSaleRow key={sale.id} sale={sale} active={activeOrder === sale.orderId} onOpen={() => onOpen(sale.orderId)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AfterSaleRow({ sale, active, onOpen }: Readonly<{ sale: AfterSaleRecord; active: boolean; onOpen: () => void }>) {
  return (
    <tr
      className={active ? 'isactive' : undefined}
      tabIndex={0}
      aria-current={active ? 'true' : undefined}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <td>
        <div className="orderprimarycell">
          <strong>{chineseReference('售后单', sale.id)}</strong>
          <span>{formatOrderTime(sale.createdAt)}</span>
        </div>
      </td>
      <td>
        <strong>{chineseReference('内部订单', sale.orderId)}</strong>
      </td>
      <td>
        <div className="orderprimarycell">
          <strong>{aftersaleReasonLabel(sale.reasonCode)}</strong>
          <span>{sale.description || '—'}</span>
        </div>
      </td>
      <td>
        <strong>{formatMinor(sale.expectedRefundMinor, sale.currency)}</strong>
      </td>
      <td>
        <span className={`orderstatuspill tone-${aftersaleTone(sale.state)}`}>{aftersaleLabel(sale.state)}</span>
      </td>
      <td>{sale.requiresReturn ? '需要退货' : '无需退货'}</td>
      <td>{sale.timeline.length} 个节点</td>
      <td>
        <div className="orderrowactions">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onOpen();
            }}
            aria-label={`查看${chineseReference('售后单', sale.id)}`}
          >
            查看
          </button>
        </div>
      </td>
    </tr>
  );
}
