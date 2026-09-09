import { CircleCheck, CircleX, PackageSearch, TriangleAlert } from 'lucide-react';

interface MobileInventoryProduct {
  purchasable?: boolean;
  stock?: number;
  stockCount?: number;
}

const BADGE_CLASS = 'inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap text-[9px] font-semibold';
const ICON_CLASS = 'h-3 w-3 flex-none';

export function inventoryStatus(product: MobileInventoryProduct) {
  const stockCount = product.stockCount ?? product.stock ?? 0;
  if (!product.purchasable && stockCount === 0) return 'pending';
  if (stockCount <= 0) return 'unavailable';
  if (stockCount <= 8) return 'tight';
  return 'available';
}

export function MobileInventoryBadge({ product }: Readonly<{ product: MobileInventoryProduct }>) {
  const status = inventoryStatus(product);
  if (status === 'available') {
    return <span className={`${BADGE_CLASS} text-emerald-600`}><CircleCheck className={ICON_CLASS} />库存充足</span>;
  }
  if (status === 'tight') {
    return <span className={`${BADGE_CLASS} text-amber-600`}><TriangleAlert className={ICON_CLASS} />库存紧张</span>;
  }
  if (status === 'unavailable') {
    return <span className={`${BADGE_CLASS} text-rose-600`}><CircleX className={ICON_CLASS} />暂时缺货</span>;
  }
  return <span className={`${BADGE_CLASS} text-slate-400`}><PackageSearch className={ICON_CLASS} />库存待确认</span>;
}
