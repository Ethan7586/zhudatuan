import { OrderIcon } from './OrderIcon';
import { OrderPreviewAction } from './OrderPreviewAction';

export function OrderDirectoryActions({
  previewEnabled,
  isFetching,
  pageCount,
  onRefresh,
}: Readonly<{
  previewEnabled: boolean;
  isFetching: boolean;
  pageCount: number;
  onRefresh: () => void;
}>) {
  return (
      <div className="orderpanelactions">
        <OrderPreviewAction
          ariaLabel="导出订单"
          title="导出订单预览"
          disabled={!previewEnabled}
          describedBy="orderwriteboundary"
          triggerTitle={previewEnabled ? '查看导出前安全预览' : '等待服务端导出合同'}
          trigger={
            <>
              <OrderIcon name="download" />
              导出
            </>
          }
        >
          {() => <p className="orderpreviewdetail">当前页已验证 {pageCount} 条；正式导出仍需服务端 Filter Snapshot、权限重读与 Operation 回执。</p>}
        </OrderPreviewAction>
        <button type="button" onClick={onRefresh} disabled={isFetching} data-loading={isFetching} aria-label="刷新数据">
          <span className="orderrefreshicon"><OrderIcon name="refresh" /></span>
          {isFetching ? '刷新中' : '刷新'}
        </button>
      </div>
  );
}
