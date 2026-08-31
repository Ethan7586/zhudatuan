import { OrderIcon } from './OrderIcon';
<<<<<<< HEAD
<<<<<<< HEAD

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
=======
import { OrderPreviewAction } from './OrderPreviewAction';
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)

export function OrderPageHeader({
  isFetching,
  exportReady,
  onImport,
  onExport,
  onRefresh,
}: Readonly<{
  isFetching: boolean;
<<<<<<< HEAD
  pageCount: number;
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  exportReady: boolean;
  onImport: () => void;
  onExport: () => void;
>>>>>>> 018b2a71 (chore(release): capture current production source)
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
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
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
<<<<<<< HEAD
        >
          <OrderIcon name="download" />
          导出当前页
        </button>
=======
        <OrderPreviewAction
          ariaLabel="导出订单"
          title="导出订单预览"
          disabled={!previewEnabled}
          describedBy="orderwriteboundary"
          triggerTitle={previewEnabled ? '查看导出前安全预览' : '等待服务端导出合同'}
          trigger={
            <>
              <OrderIcon name="download" />
              导出订单
            </>
          }
        >
          {() => <p className="orderpreviewdetail">当前页已验证 {pageCount} 条；正式导出仍需服务端 Filter Snapshot、权限重读与 Operation 回执。</p>}
        </OrderPreviewAction>
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
        >
          <OrderIcon name="download" />
          导出当前页
        </button>
>>>>>>> 018b2a71 (chore(release): capture current production source)
        <button type="button" onClick={onRefresh} disabled={isFetching}>
          <OrderIcon name="refresh" />
          {isFetching ? '刷新中' : '刷新数据'}
        </button>
      </div>
    </header>
  );
}
