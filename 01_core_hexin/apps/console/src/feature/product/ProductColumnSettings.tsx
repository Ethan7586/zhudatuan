import { Dialog } from '@shop/design';
import type { ProductColumnKey } from './ProductTable';

const columns: readonly Readonly<{ key: ProductColumnKey; label: string }>[] = Object.freeze([
  { key: 'category', label: '分类 / 供应商' },
  { key: 'sku', label: 'SKU 数量' },
  { key: 'malls', label: '商城覆盖' },
  { key: 'price', label: '售价' },
  { key: 'stock', label: '库存' },
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
    <Dialog open={open} title="列设置" eyebrow="TABLE PREFERENCES" onClose={onClose}>
      <div className="productcolumnpanel">
        <p>仅调整本次浏览中的显示列，不改变服务端查询或业务数据。</p>
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
