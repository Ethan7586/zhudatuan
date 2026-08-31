import { OrderIcon } from './OrderIcon';

export function OrderPageHeader({
  isFetching,
  exportReady,
  onImport,
  onExport,
  onRefresh,
}: Readonly<{
  isFetching: boolean;
  exportReady: boolean;
  onImport: () => void;
  onExport: () => void;
  onRefresh: () => void;
}>) {
  return (
    <header className="orderpageheader">
      <div>
        <p>ORDER OPERATIONS</p>
        <h1 id="ordermanagementtitle">订单管理系统</h1>
        <span>统一处理订单、支付、履约、退款与售后</span>
      </div>
      <div className="orderpageactions">
        <button type="button" title="选择本地 CSV 文件，本期不会上传" aria-describedby="orderwriteboundary" onClick={onImport}>
          <OrderIcon name="package" />
          导入
        </button>
        <button
          type="button"
          disabled={!exportReady}
          title={exportReady ? '仅导出当前已加载页，不包含其他分页' : '数据加载中'}
          aria-describedby="orderwriteboundary"
          onClick={onExport}
        >
          <OrderIcon name="download" />
          导出当前页
        </button>
        <button type="button" onClick={onRefresh} disabled={isFetching}>
          <OrderIcon name="refresh" />
          {isFetching ? '刷新中' : '刷新数据'}
        </button>
      </div>
    </header>
  );
}
