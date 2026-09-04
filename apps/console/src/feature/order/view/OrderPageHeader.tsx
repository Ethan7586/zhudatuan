import { Brand } from '@shop/design';
import { OrderIcon } from './OrderIcon';

export function OrderPageHeader({
  title,
  isFetching,
  onRefresh,
  canImport,
  canExport,
  onImport,
  onExport,
}: Readonly<{
  title: string;
  isFetching: boolean;
  onRefresh: () => void;
  canImport: boolean;
  canExport: boolean;
  onImport: () => void;
  onExport: () => void;
}>) {
  return (
    <header className="orderpageheader">
      <div className="orderpageidentity">
        <Brand product="订单管理" variant="mark" />
        <div>
          <p>OMS · 订单管理</p>
          <h1 id="ordermanagementtitle">{title}</h1>
          <span>集中查看订单状态、支付进度、履约和售后情况。</span>
          <small><span>数据来源 · 订单服务</span><span>当前模式 · 查看与处理</span></small>
        </div>
      </div>
      <div className="orderpageactions" role="group" aria-label="订单管理操作">
        <button type="button" onClick={onImport} disabled={!canImport} title={canImport ? '导入经来源证明校验的外部订单' : '当前账号没有导入外部订单权限'}><OrderIcon name="upload" />导入外部订单</button>
        <button type="button" onClick={onExport} disabled={!canExport} title={canExport ? '按当前服务端筛选条件创建安全导出任务' : '当前账号没有导出订单权限'}><OrderIcon name="download" />导出订单</button>
        <button type="button" onClick={onRefresh} disabled={isFetching}>
          <OrderIcon name="refresh" />
          {isFetching ? '刷新中' : '刷新数据'}
        </button>
      </div>
      <p id="orderactionboundary" className="sr-only">导入和导出均由服务端重新校验当前账号、业务范围和数据权限。</p>
    </header>
  );
}
