import { AlertTriangle, Plus, ShieldCheck } from 'lucide-react';
import type { PresentedProduct } from '../model/Product';
import { productAvailability } from '../model/Product';
import { ProductMedia } from '../../../shared/view/ProductMedia';
import { formatMinor } from '../../../shared/format/Money';

export function ProductCard({ product, open, add }: Readonly<{ product: PresentedProduct; open: (productId: string) => void; add: (product: PresentedProduct) => void }>) {
  const availability = productAvailability(product);
  const Icon = availability.canPurchase ? ShieldCheck : AlertTriangle;
  return (
    <article className="group overflow-hidden rounded-2xl border border-edge bg-surface shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <button type="button" onClick={() => open(product.productId)} className="block w-full text-left">
        <ProductMedia source={product.image} alt={product.title} className="aspect-square w-full object-cover" emptyClassName="grid aspect-square place-items-center bg-subtle text-xs text-muted" />
        <div className="p-2 sm:p-3">
          <h3 className="line-clamp-2 min-h-10 text-xs font-bold leading-5 sm:text-sm">{product.title}</h3>
          <span className={`mt-2 flex items-start gap-1 text-[10px] ${availability.canPurchase ? 'text-success-strong' : 'text-warning-strong'}`}>
            <Icon size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span className="line-clamp-2">{availability.availabilityText}</span>
          </span>
        </div>
      </button>
      <div className="flex items-center justify-between gap-1 px-2 pb-2 sm:gap-2 sm:px-3 sm:pb-3">
        {product.saleability.reasons.includes('price_unavailable') ? <b className="text-xs text-warning-strong">报价暂不可用</b> : <b className="text-xs text-danger sm:text-base">¥{formatMinor(product.priceWelfareMinor)}</b>}
        <button
          type="button"
          disabled={!availability.canPurchase}
          onClick={() => add(product)}
          aria-label={`将${product.title}加入购物车`}
          title={availability.canPurchase ? '加入购物车' : availability.availabilityText}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-inverse disabled:cursor-not-allowed disabled:bg-disabled"
        >
          <Plus size={18} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}
