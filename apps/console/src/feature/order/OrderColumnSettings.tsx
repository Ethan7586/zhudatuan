import type { OrderColumnKey } from './OrderTable';

const configurableColumns: readonly Readonly<{ key: OrderColumnKey; label: string }>[] = Object.freeze([
  { key: 'member', label: '会员 / 企业' },
  { key: 'product', label: '商品摘要' },
  { key: 'payment', label: '金额 / 支付' },
  { key: 'fulfillment', label: '履约状态' },
  { key: 'aftersale', label: '售后' },
]);

export function OrderColumnSettings({
  open,
  visible,
  onToggle,
  onClose,
}: Readonly<{
  open: boolean;
  visible: ReadonlySet<OrderColumnKey>;
  onToggle: (key: OrderColumnKey) => void;
  onClose: () => void;
}>) {
  if (!open) return null;
  return (
    <section id="ordercolumnsettings" className="ordercolumnsettings" aria-label="订单列表列设置">
      <header>
        <strong>列设置</strong>
        <button type="button" onClick={onClose}>
          完成
        </button>
      </header>
      <p>订单与时间、操作列固定显示。</p>
      <div>
        {configurableColumns.map((column) => (
          <label key={column.key}>
            <input type="checkbox" checked={visible.has(column.key)} onChange={() => onToggle(column.key)} />
            {column.label}
          </label>
        ))}
      </div>
    </section>
  );
}
