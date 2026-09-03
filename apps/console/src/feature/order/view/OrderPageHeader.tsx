import { OrderIcon } from './OrderIcon';

export function OrderPageHeader({
  title,
  isFetching,
  onRefresh,
}: Readonly<{
  title: string;
  isFetching: boolean;
  onRefresh: () => void;
}>) {
  return (
    <header className="orderpageheader">
      <div>
        <p>订单运营</p>
        <h1 id="ordermanagementtitle">{title}</h1>
        <span>统一处理订单、支付、履约、退款与售后</span>
      </div>
      <div className="orderpageactions">
        <button type="button" onClick={onRefresh} disabled={isFetching}>
          <OrderIcon name="refresh" />
          {isFetching ? '刷新中' : '刷新数据'}
        </button>
      </div>
    </header>
  );
}
