import { AfterSaleTable } from './AfterSaleTable';
import { OrderIcon } from './OrderIcon';
import type { AfterSaleViewModel } from '../viewmodel/AfterSaleViewModel';

export function AfterSalePanel({
  viewmodel,
  selected,
  onOpen,
  onRetry,
}: Readonly<{
  viewmodel: AfterSaleViewModel;
  selected: string | undefined;
  onOpen: (order: string) => void;
  onRetry: () => void;
}>) {
  if (viewmodel.pending)
    return (
      <p className="orderliststate" role="status">
        正在读取售后订单…
      </p>
    );
  if (viewmodel.failed && viewmodel.data === undefined)
    return (
      <section className="orderliststate" role="alert">
        <strong>售后订单读取失败</strong>
        <p>{viewmodel.error}</p>
        <button type="button" onClick={onRetry}>
          重试
        </button>
      </section>
    );
  if (viewmodel.data?.items.length === 0)
    return (
      <section className="orderliststate" role="status">
        <OrderIcon name="order" />
        <strong>暂无符合条件的售后订单</strong>
        <p>当前范围没有售后申请，或订单筛选条件未命中。</p>
      </section>
    );
  return viewmodel.data === undefined ? null : (
    <>
      <AfterSaleTable rows={viewmodel.data.items} {...(selected === undefined ? {} : { activeOrder: selected })} onOpen={onOpen} />
      {viewmodel.failed ? (
        <p className="orderstalebanner" role="status">
          刷新失败，当前保留最近一次已验证数据：{viewmodel.error}
        </p>
      ) : null}
    </>
  );
}
