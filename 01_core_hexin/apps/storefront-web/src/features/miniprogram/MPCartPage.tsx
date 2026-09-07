import React from 'react';
import { CheckSquare, ChevronRight, CreditCard, MapPin, ShoppingBag, Square, Trash2 } from 'lucide-react';
import { WeChatCapsule } from '../../components/mobile/WeChatCapsule';
import { useMall } from '../../context/MallContext';
import { storefrontImageUrl } from '../../services/storefrontImageUrl';
import { MPCartInvoiceDisclosure } from './MPCartInvoiceDisclosure';

export const MPCartPage: React.FC = () => {
  const {
    addresses,
    cart,
    checkoutSelectedCart,
    currentMall,
    isSubmittingOrder,
    removeCartItem,
    setMpPage,
    toggleCartItemSelected,
    toggleSelectAllCart,
    triggerPendingFeature,
    updateCartQuantity,
    user,
  } = useMall();
  const [isOrderServicesOpen, setIsOrderServicesOpen] = React.useState(false);

  const selectedItems = cart.filter((item) => item.selected);
  const isAllSelected = cart.length > 0 && cart.every((item) => item.selected);
  const totalPrice = selectedItems.reduce((sum, item) => sum + item.product.priceMall * item.quantity, 0);
  const totalSubsidy = selectedItems.reduce(
    (sum, item) => sum + Math.max(0, item.product.priceMarket - item.product.priceWelfare) * item.quantity,
    0,
  );

  const handleCheckout = async () => {
    if (selectedItems.length === 0) return;
    if (addresses.length === 0) {
      setMpPage('address');
      return;
    }
    if (await checkoutSelectedCart()) setMpPage('profile');
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F5F7FA] font-sans text-gray-800">
      <WeChatCapsule title="福利购物车" />

      {cart.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center space-y-3 p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-[var(--sw-brand)] shadow-xs">
            <ShoppingBag className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-800">购物车还是空的</h1>
            <p className="mt-1 text-xs text-gray-400">选好福利商品后，可以在这里统一结算</p>
          </div>
          <button type="button" onClick={() => setMpPage('home')} className="min-h-10 rounded-xl bg-[var(--sw-brand)] px-6 text-xs font-bold text-white shadow-md active:bg-[var(--sw-brand-dark)]">
            去逛逛
          </button>
        </div>
      ) : (
        <>
          <div className="flex shrink-0 items-center justify-between border-b border-blue-200/80 bg-[var(--sw-brand-light)] px-3 py-2 text-xs text-blue-900">
            <div className="flex min-w-0 items-center gap-1.5 font-medium">
              <CreditCard className="h-4 w-4 flex-none text-[var(--sw-brand)]" />
              <span className="flex-none">福利卡余额</span>
              <span className="truncate font-mono font-black text-[var(--sw-brand)]">¥{user.welfareBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</span>
            </div>
            <span className="ml-2 flex-none text-[10px] text-blue-700">结算时核对额度</span>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3">
            <section className="space-y-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-xs">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2 text-xs">
                <span className="min-w-0 truncate font-bold text-gray-800">{currentMall.mallName || '当前福利商城'}</span>
                <span className="ml-2 flex-none text-[10px] text-gray-400">统一结算</span>
              </div>

              <div className="divide-y divide-gray-100">
                {cart.map((item) => (
                  <article key={item.id} className="flex items-center gap-2.5 py-3 first:pt-0 last:pb-0">
                    <button type="button" aria-label={`${item.selected ? '取消选择' : '选择'}：${item.product.title}`} onClick={() => toggleCartItemSelected(item.id)} className="flex h-9 w-7 flex-none items-center justify-start">
                      {item.selected ? <CheckSquare className="h-5 w-5 text-[var(--sw-brand)]" /> : <Square className="h-5 w-5 text-gray-300" />}
                    </button>

                    <img
                      src={storefrontImageUrl(item.product.images[0], 128)}
                      srcSet={`${storefrontImageUrl(item.product.images[0], 128)} 2x, ${storefrontImageUrl(item.product.images[0], 192)} 3x`}
                      alt={item.product.title}
                      width={64}
                      height={64}
                      loading="lazy"
                      decoding="async"
                      className="h-16 w-16 flex-none rounded-xl border border-gray-100 bg-gray-50 object-cover"
                    />

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-1">
                        <h2 className="line-clamp-1 text-xs font-bold text-gray-900">{item.product.title}</h2>
                        <button type="button" aria-label={`删除：${item.product.title}`} onClick={() => removeCartItem(item.id)} className="flex h-7 w-7 flex-none items-center justify-center rounded-lg text-gray-400 active:bg-red-50 active:text-red-500">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="w-fit rounded bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-400">{Object.values(item.selectedSpec || {}).join(' / ') || '默认规格'}</div>

                      <div className="flex items-center justify-between pt-1">
                        <div>
                          <span className="font-mono text-xs font-black text-[#E5484D]">¥{item.product.priceMall}</span>
                          <span className="ml-1 text-[9px] text-gray-400 line-through">¥{item.product.priceMarket}</span>
                        </div>

                        <div className="flex items-center overflow-hidden rounded-lg border border-gray-200 text-xs">
                          <button type="button" aria-label={`减少${item.product.title}数量`} onClick={() => updateCartQuantity(item.id, item.quantity - 1)} className="h-9 w-9 bg-gray-50 font-bold active:bg-gray-200">−</button>
                          <CartQuantityInput value={item.quantity} onChange={(quantity) => updateCartQuantity(item.id, quantity)} />
                          <button type="button" aria-label={`增加${item.product.title}数量`} onClick={() => updateCartQuantity(item.id, item.quantity + 1)} className="h-9 w-9 bg-gray-50 font-bold active:bg-gray-200">＋</button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <button type="button" onClick={() => setMpPage('address')} className="flex w-full items-center gap-2 rounded-2xl border border-gray-100 bg-white p-3 text-left shadow-xs active:bg-gray-50">
              <MapPin className="h-4 w-4 flex-none text-[var(--sw-brand)]" />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-gray-800">{addresses[0] ? `${addresses[0].name} ${addresses[0].phone}` : '添加配送地址'}</span>
                <span className="mt-0.5 block truncate text-[10px] text-gray-400">
                  {addresses[0] ? [addresses[0].province, addresses[0].city, addresses[0].district, addresses[0].detail].filter(Boolean).join(' ') : '结算前补充即可'}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 flex-none text-gray-300" />
            </button>

            <MPCartInvoiceDisclosure
              expanded={isOrderServicesOpen}
              onToggle={() => setIsOrderServicesOpen((open) => !open)}
              onEdit={() => triggerPendingFeature('企业发票抬头信息', '选择本次订单需要使用的发票抬头。')}
            />
          </div>

          <div data-cart-settlement-bar className="flex shrink-0 items-center justify-between gap-2 border-t border-gray-200/90 bg-white px-3 py-2 shadow-[0_-8px_24px_rgba(15,23,42,0.06)]">
            <button type="button" onClick={() => toggleSelectAllCart(!isAllSelected)} className="flex min-h-10 flex-none items-center gap-1.5 pr-1 text-xs font-bold text-gray-700">
              {isAllSelected ? <CheckSquare className="h-5 w-5 text-[var(--sw-brand)]" /> : <Square className="h-5 w-5 text-gray-300" />}
              <span>全选</span>
            </button>

            <div className="min-w-0 flex-1 text-right">
              {totalSubsidy > 0 && <div className="truncate text-[9px] text-emerald-600">已省 ¥{totalSubsidy.toFixed(2)}</div>}
              <div className="truncate text-xs font-bold text-gray-900">
                合计 <span className="font-mono text-sm font-black text-[#E5484D]">¥{totalPrice.toFixed(2)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCheckout}
              disabled={selectedItems.length === 0 || isSubmittingOrder}
              className={`min-h-10 flex-none rounded-xl px-4 text-xs font-bold text-white shadow-md ${
                selectedItems.length > 0 ? 'bg-[var(--sw-brand)] active:bg-[var(--sw-brand-dark)]' : 'cursor-not-allowed bg-gray-300'
              }`}
            >
              {isSubmittingOrder ? '正在提交…' : `去结算 (${selectedItems.length})`}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

function CartQuantityInput({ value, onChange }: Readonly<{ value: number; onChange: (quantity: number) => void }>) {
  const [draft, setDraft] = React.useState(String(value));
  const [editing, setEditing] = React.useState(false);

  React.useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [editing, value]);

  const updateDraft = (nextDraft: string) => {
    const digits = nextDraft.replace(/\D/g, '');
    setDraft(digits);
    const quantity = Number(digits);
    if (digits && Number.isSafeInteger(quantity) && quantity >= 1) onChange(quantity);
  };

  const finishEditing = () => {
    setEditing(false);
    const quantity = Number(draft);
    if (!draft || !Number.isSafeInteger(quantity) || quantity < 1) setDraft(String(value));
  };

  return (
    <input
      aria-label="商品数量"
      value={draft}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      enterKeyHint="done"
      onFocus={(event) => {
        setEditing(true);
        event.currentTarget.select();
      }}
      onChange={(event) => updateDraft(event.target.value)}
      onBlur={finishEditing}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
      className="h-9 w-11 border-x border-gray-200 bg-white px-1 text-center font-mono font-bold outline-none focus:bg-blue-50"
    />
  );
}
