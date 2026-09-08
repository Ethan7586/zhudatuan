import { ArrowLeft, Heart, PackageSearch } from 'lucide-react';
import type { PresentedProduct } from '../../../entity/product';
import { formatMinor } from '../../../shared/format/Money';
import type { Favorite } from '../model/Favorite';

export function FavoritePanel({
  favorites,
  products,
  open,
  remove,
  back,
  state,
  catalogState,
  message,
  retry,
  retryCatalog,
}: {
  readonly favorites: readonly Favorite[];
  readonly products: readonly PresentedProduct[];
  readonly open: (id: string) => void;
  readonly remove: (id: string) => void;
  readonly back: () => void;
  readonly state: 'loading' | 'failed' | 'empty' | 'ready';
  readonly catalogState: 'loading' | 'error' | 'ready';
  readonly message: string | null;
  readonly retry: () => void;
  readonly retryCatalog: () => void;
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
      {state === 'loading' ? <PanelState text="正在读取收藏记录…" /> : null}
      {state === 'failed' ? <PanelState text={message ?? '收藏记录加载失败'} retry={retry} /> : null}
      {state === 'ready' && catalogState === 'loading' ? <PanelState text="正在读取收藏商品信息…" /> : null}
      {state === 'ready' && catalogState === 'error' ? <PanelState text="收藏商品信息加载失败" retry={retryCatalog} /> : null}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {state === 'ready' && catalogState === 'ready'
          ? favorites.map((favorite) => {
              const product = products.find((item) => item.listingId === favorite.listingId);
              return (
                <article key={favorite.listingId} className="overflow-hidden rounded-2xl border bg-surface shadow-sm">
                  <button type="button" disabled={!favorite.available || !product} onClick={() => product && open(product.productId)} className="block w-full text-left disabled:cursor-default">
                    {product?.image ? (
                      <img src={product.image} alt={product.title} className="aspect-[4/3] w-full bg-subtle object-cover" />
                    ) : (
                      <div className="grid aspect-[4/3] place-items-center bg-subtle text-muted">
                        <PackageSearch size={32} />
                      </div>
                    )}
                    <div className="p-3">
                      <b className="line-clamp-2 text-sm">{product?.title ?? '已收藏商品'}</b>
                      <p className="mt-1 truncate text-[10px] text-muted">收藏于 {new Date(favorite.createdAt).toLocaleDateString('zh-CN')}</p>
                      {favorite.available && product ? <p className="mt-2 font-black text-danger">¥{formatMinor(product.priceWelfareMinor)}</p> : null}
                      {favorite.available && !product ? <p className="mt-2 text-xs font-bold text-warning-strong">商品信息已不可见，可取消收藏</p> : null}
                      {!favorite.available ? <p className="mt-2 rounded-lg bg-warning-surface px-2 py-1.5 text-xs font-bold text-warning-strong">{favorite.unavailableReason ?? '商品暂不可用，可取消收藏'}</p> : null}
                    </div>
                  </button>
                  <button type="button" onClick={() => remove(favorite.listingId)} className="m-3 mt-0 w-[calc(100%-1.5rem)] rounded-lg border px-3 py-2 text-xs font-bold text-danger">
                    取消收藏
                  </button>
                </article>
              );
            })
          : null}
        {state === 'empty' ? <div className="col-span-full grid min-h-48 place-items-center rounded-2xl border border-dashed bg-surface text-sm text-muted">暂无收藏商品</div> : null}
      </section>
    </div>
  );
}

function PanelState({ text, retry }: Readonly<{ text: string; retry?: () => void }>) {
  return (
    <div role={retry ? 'alert' : 'status'} className="grid min-h-32 place-items-center rounded-2xl border border-dashed bg-surface text-sm text-muted">
      <span>{text}</span>
      {retry ? (
        <button type="button" onClick={retry} className="rounded-lg bg-brand-light px-3 py-2 font-bold text-brand">
          重试
        </button>
      ) : null}
    </div>
  );
}
