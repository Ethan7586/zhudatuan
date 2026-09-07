import { CircleCheck, CircleX, PackageSearch, TriangleAlert } from 'lucide-react';
import type { FrontendProduct } from '../../adapters/frontendData';
import { inventoryStatus } from './mobileOrderPresentation';

export function MobileInventoryBadge({ product }: Readonly<{ product: FrontendProduct }>) {
  const status = inventoryStatus(product);
  if (status === 'available') {
    return <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-600"><CircleCheck className="h-3 w-3" />库存充足</span>;
  }
  if (status === 'tight') {
    return <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-amber-600"><TriangleAlert className="h-3 w-3" />库存紧张</span>;
  }
  if (status === 'unavailable') {
    return <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-rose-600"><CircleX className="h-3 w-3" />暂时缺货</span>;
  }
  return <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-slate-400"><PackageSearch className="h-3 w-3" />库存待确认</span>;
}
