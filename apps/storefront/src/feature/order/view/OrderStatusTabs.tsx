import type { OrderFilter } from '../model/OrderFilter';

const FILTERS: readonly Readonly<{ id: OrderFilter; label: string }>[] = Object.freeze([
  Object.freeze({ id: 'all', label: '全部' }),
  Object.freeze({ id: 'pending_payment', label: '待付款' }),
  Object.freeze({ id: 'pending_shipment', label: '待发货' }),
  Object.freeze({ id: 'pending_receipt', label: '待收货' }),
  Object.freeze({ id: 'completed', label: '已完成' }),
]);

export function OrderStatusTabs({ selected, select }: Readonly<{ selected: OrderFilter; select: (filter: OrderFilter) => void }>) {
  return (
    <nav aria-label="订单状态筛选" className="mt-4 overflow-x-auto border-b border-edge bg-surface px-1 sm:rounded-2xl sm:border sm:p-1.5">
      <div className="grid min-w-[340px] grid-cols-5 gap-1">
        {FILTERS.map((filter) => (
          <button
            type="button"
            key={filter.id}
            aria-current={selected === filter.id ? 'page' : undefined}
            onClick={() => select(filter.id)}
            className={`relative min-h-11 whitespace-nowrap rounded-xl px-2 text-sm font-bold transition-colors ${selected === filter.id ? 'bg-brand-light text-brand' : 'text-secondary hover:bg-subtle hover:text-content'}`}
          >
            {filter.label}
            {selected === filter.id ? <span aria-hidden="true" className="absolute inset-x-3 -bottom-1 h-0.5 rounded-full bg-brand sm:bottom-0" /> : null}
          </button>
        ))}
      </div>
    </nav>
  );
}
