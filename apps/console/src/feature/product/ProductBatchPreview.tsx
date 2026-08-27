import { Dialog } from '@shop/design';
import type { Listing } from './ProductSchema';

interface ProductBatchPreviewProps {
  readonly open: boolean;
  readonly rows: readonly Listing[];
  readonly onClose: () => void;
}

export function ProductBatchPreview({ open, rows, onClose }: ProductBatchPreviewProps) {
  return (
    <Dialog open={open} title="批量操作影响预览" eyebrow="FILTER SNAPSHOT → PREVIEW → OPERATION → VERIFY" onClose={onClose}>
      <div className="productbatchpreview">
        <p>
          当前只预览本页明确勾选的 <strong>{rows.length}</strong> 项，不会把它们冒充当前筛选下的全部商品。
        </p>
        <ul>
          {rows.slice(0, 5).map((row) => (
            <li key={row.id}>
              <strong>{row.title}</strong>
              <span>{row.product_id}</span>
            </li>
          ))}
        </ul>
        {rows.length > 5 ? <p>另有 {rows.length - 5} 项已选择。</p> : null}
        <section aria-labelledby="batchproofboundary">
          <h3 id="batchproofboundary">执行边界</h3>
          <p>服务端尚未返回 Filter Snapshot、影响范围预览及 action-bound proof，因此不会创建或执行批量 Operation。</p>
        </section>
        <footer>
          <button type="button" onClick={onClose}>
            返回列表
          </button>
          <button className="productactionprimary" type="button" disabled title="等待 action-bound proof">
            创建 Operation
          </button>
        </footer>
      </div>
    </Dialog>
  );
}
