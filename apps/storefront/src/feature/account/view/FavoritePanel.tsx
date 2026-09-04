import { ArrowLeft, Heart, PackageSearch } from 'lucide-react';
import type { PresentedProduct } from '../../../entity/product';
import { formatMinor } from '../../../shared/format/Money';

export function FavoritePanel({
  favorites,
  products,
  open,
  remove,
  back,
}: {
  readonly favorites: readonly string[];
  readonly products: readonly PresentedProduct[];
  readonly open: (id: string) => void;
  readonly remove: (id: string) => void;
  readonly back: () => void;
}) {
  return (
    <div className="mx-auto max-w-5xl space-y-3 p-3 sm:p-5">
      <button type="button" onClick={back} className="inline-flex items-center gap-1 text-sm font-bold text-brand">
        <ArrowLeft size={16} />
        返回个人中心
      </button>
      <section className="rounded-2xl bg-surface p-4 shadow-sm">
        <h1 className="flex items-center gap-2 text-lg font-black">
          <Heart size={19} fill="currentColor" className="text-danger" />
          我的收藏
        </h1>
        <p className="mt-1 text-xs text-muted">收藏记录保存在服务端，并严格隔离到当前成员与商城。</p>
      </section>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {favorites.map((id) => {
          const product = products.find((item) => item.id === id);
          return (
            <article key={id} className="overflow-hidden rounded-2xl border bg-surface shadow-sm">
              <button type="button" onClick={() => open(id)} className="block w-full text-left">
                {product?.image ? (
                  <img src={product.image} alt={product.title} className="aspect-[4/3] w-full bg-subtle object-cover" />
                ) : (
                  <div className="grid aspect-[4/3] place-items-center bg-subtle text-muted">
                    <PackageSearch size={32} />
                  </div>
                )}
                <div className="p-3">
                  <b className="line-clamp-2 text-sm">{product?.title ?? '已收藏商品'}</b>
                  <p className="mt-1 truncate text-[10px] text-muted">{id}</p>
                  {product ? <p className="mt-2 font-black text-danger">¥{formatMinor(product.priceWelfareMinor)}</p> : <p className="mt-2 text-xs text-brand">查看最新商品信息</p>}
                </div>
              </button>
              <button type="button" onClick={() => remove(id)} className="m-3 mt-0 w-[calc(100%-1.5rem)] rounded-lg border px-3 py-2 text-xs font-bold text-danger">
                取消收藏
              </button>
            </article>
          );
        })}
        {favorites.length === 0 ? <div className="col-span-full grid min-h-48 place-items-center rounded-2xl border border-dashed bg-surface text-sm text-muted">暂无收藏商品</div> : null}
      </section>
    </div>
  );
}
