import { ProductIcon } from './ProductIcon';

export function ProductFreeWorkspace({ enabled, onCreate, onImport }: Readonly<{
  enabled: boolean;
  onCreate: () => void;
  onImport: () => void;
}>) {
  return (
    <section className="productfree" aria-labelledby="product-free-title">
      <div className="productfreeintro">
        <span>OPEN CATALOG</span>
        <h2 id="product-free-title">自由创建你的商品</h2>
        <p>适合自有库存、线下采购、临时商品和服务，不需要先进入供应链或品牌货盘。</p>
      </div>
      <div className="productfreechoices">
        <button type="button" disabled={!enabled} onClick={onCreate}>
          <span className="productfreeicon"><ProductIcon name="plus" /></span>
          <strong>新建自由商品</strong>
          <small>逐项填写商品资料、售价、库存和图片</small>
          <span className="productfreelink">开始创建 <ProductIcon name="arrowRight" /></span>
        </button>
        <button type="button" disabled={!enabled} onClick={onImport}>
          <span className="productfreeicon"><ProductIcon name="upload" /></span>
          <strong>批量导入自由商品</strong>
          <small>使用标准模板，一次建立多件商品</small>
          <span className="productfreelink">上传商品包 <ProductIcon name="arrowRight" /></span>
        </button>
      </div>
      <p className="productfreenote"><ProductIcon name="check" />创建完成后进入商品目录，仍由商品目录统一审核和上下架。</p>
    </section>
  );
}
