import { Dialog } from '@shop/design';
import type { Listing } from './ProductSchema';

interface ProductBatchPreviewProps {
  readonly open: boolean;
  readonly rows: readonly Listing[];
  readonly onClose: () => void;
}

export function ProductBatchPreview({ open, rows, onClose }: ProductBatchPreviewProps) {
  return (
    <Dialog open={open} title="当前页所选商品" eyebrow="CATALOG REVIEW" onClose={onClose}>
      <div className="productbatchpreview">
        <p>
          当前页已勾选 <strong>{rows.length}</strong> 项，可在发布前核对商品范围。
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
          <h3 id="batchproofboundary">一键发布范围</h3>
          <p>页面顶部的“一键审核上架”按当前商城执行；后台会再核验商品、SKU、价格和库存，仅上架全部合格草稿。</p>
        </section>
        <footer>
          <button type="button" onClick={onClose}>
            返回列表
          </button>
        </footer>
      </div>
    </Dialog>
  );
}
