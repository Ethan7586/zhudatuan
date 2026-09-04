import { Dialog } from '@shop/design';
import type { ProductColumnKey } from './ProductTable';

const columns: readonly Readonly<{ key: ProductColumnKey; label: string }>[] = Object.freeze([
  { key: 'category', label: '分类 / 来源' },
  { key: 'sku', label: 'SKU 摘要' },
  { key: 'malls', label: '商城覆盖' },
  { key: 'price', label: '有效售价' },
  { key: 'stock', label: '可售库存' },
  { key: 'status', label: '状态' },
  { key: 'updated', label: '更新时间' },
]);

interface ProductColumnSettingsProps {
  readonly open: boolean;
  readonly visible: ReadonlySet<ProductColumnKey>;
  readonly onChange: (key: ProductColumnKey) => void;
  readonly onClose: () => void;
}

export function ProductColumnSettings({ open, visible, onChange, onClose }: ProductColumnSettingsProps) {
  return (
    <Dialog open={open} title="列设置" eyebrow="表格显示偏好" onClose={onClose}>
      <div className="productcolumnpanel">
        <p>显示偏好会按当前账号和管理范围保存；切换范围时互不影响，也不会改变业务数据。</p>
        <div className="productcolumnchoices">
          {columns.map((column) => (
            <label key={column.key}>
              <input type="checkbox" checked={visible.has(column.key)} onChange={() => onChange(column.key)} />
              {column.label}
            </label>
          ))}
        </div>
        <footer>
          <button className="productaction productactionprimary" type="button" onClick={onClose}>
            完成
          </button>
        </footer>
      </div>
    </Dialog>
  );
}
