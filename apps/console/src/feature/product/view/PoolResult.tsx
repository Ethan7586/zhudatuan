import type { Pool } from '../model/Product';
import type { PoolMode, ProductPoolViewModel } from '../viewmodel/ProductPoolViewModel';

interface PoolResultProps {
  readonly operation: PoolMode;
  readonly listingTitle: string | undefined;
  readonly currentPoolName: string | null;
  readonly selectedPool: Pool | undefined;
  readonly targetName: string;
  readonly kind: ProductPoolViewModel['kind'];
  readonly name: string;
}

export function PoolResult({ operation, listingTitle, currentPoolName, selectedPool, targetName, kind, name }: Readonly<PoolResultProps>) {
  const selectedName = selectedPool?.name ?? '尚未选择的商品池';
  let title = '';
  let description = '';
  if (operation === 'move') {
    title = `“${listingTitle ?? '当前商品'}”将移入“${selectedName}”`;
    description = '仅草稿或已下架商品可以调整商品池；系统会校验当前版本，避免覆盖他人的修改。';
  } else if (operation === 'remove') {
    title = `“${listingTitle ?? '当前商品'}”将移出“${currentPoolName ?? '当前商品池'}”`;
    description = '移出后商品不再属于该池；如需销售，请重新投池并完成价格、库存、资格和上架检查。';
  } else if (operation === 'allocate') {
    title = `将在“${targetName}”创建“${name.trim() || '尚未命名的商品池'}”`;
    description = `系统会复制“${selectedName}”中的 ${selectedPool?.item_count ?? 0} 件商品，创建独立的${kind === 'markup' ? '加价商品池' : '渠道商品池'}；来源池不会被修改。`;
  } else if (operation === 'attach') {
    title = `“${selectedName}”将投放到“${targetName}”`;
    description = '目标商城将可以使用池内商品；商品仍需具备有效价格、库存和资格，并完成上架后才会对消费者可见。';
  } else if (operation === 'deliver') {
    title = `“${listingTitle ?? '当前商品'}”将随“${currentPoolName ?? selectedName}”投放到“${targetName}”`;
    description = '本次只建立商品池与商城的投放关系；系统随后会继续检查售价、库存、资格和上架状态。';
  } else {
    title = `“${targetName}”将停止使用“${selectedName}”`;
    description = '该商城将不再从此池获得商品供给；本次操作不会改动来源池，也不会删除历史订单。';
  }
  return (
    <section className="productpoolresult" aria-label="执行结果预览" aria-live="polite">
      <span>执行后</span>
      <strong>{title}</strong>
      <p>{description}</p>
    </section>
  );
}
