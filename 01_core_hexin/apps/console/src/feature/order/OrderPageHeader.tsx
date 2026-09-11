import { OrderIcon } from './OrderIcon';

export function OrderDirectoryActions({
  isFetching,
  columnsOpen,
  onExport,
  onRefresh,
  onColumns,
}: Readonly<{
  isFetching: boolean;
  columnsOpen: boolean;
  onExport: () => void;
  onRefresh: () => void;
  onColumns: () => void;
}>) {
  return (
      <div className="orderpanelactions">
        <button type="button" onClick={onExport} aria-label="导出订单"><OrderIcon name="download" />导出</button>
        <button type="button" onClick={onRefresh} disabled={isFetching} data-loading={isFetching} aria-label="刷新数据">
          <span className="orderrefreshicon"><OrderIcon name="refresh" /></span>
          {isFetching ? '刷新中' : '刷新'}
        </button>
        <button className="ordercolumnsbutton" type="button" onClick={onColumns} aria-expanded={columnsOpen} aria-controls="ordercolumnsettings" aria-label="列设置">
          <OrderIcon name="settings" />
        </button>
      </div>
  );
}
