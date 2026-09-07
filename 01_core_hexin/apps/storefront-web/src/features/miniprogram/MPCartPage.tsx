import React from 'react';
import { CheckCircle2, Circle, CreditCard, ShoppingBag, Store } from 'lucide-react';
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
  const [isManaging, setIsManaging] = React.useState(false);
  const [isOrderServicesOpen, setIsOrderServicesOpen] = React.useState(false);

  const selectedItems = cart.filter((item) => item.selected);
  const cartQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
  const selectedQuantity = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
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

  const handleRemoveSelected = () => {
    selectedItems.forEach((item) => removeCartItem(item.id));
    setIsManaging(false);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F4F6FA] font-sans text-gray-900">
      <WeChatCapsule title="福利购物车" />

      {cart.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-8 pb-12 text-center">
          <div className="relative mb-5 flex h-24 w-24 items-center justify-center rounded-[28px] bg-white text-[var(--sw-brand)] shadow-[0_12px_34px_rgba(30,64,175,0.10)]">
            <div className="absolute inset-3 rounded-[22px] bg-blue-50" />
            <ShoppingBag className="relative h-10 w-10" strokeWidth={1.8} />
          </div>
          <h1 className="text-base font-black tracking-tight text-gray-900">购物车空空的</h1>
          <p className="mt-2 text-xs leading-5 text-gray-400">去挑选心仪福利，加入后可一起结算</p>
          <button
            type="button"
            onClick={() => setMpPage('home')}
            className="mt-6 min-h-11 rounded-full bg-[var(--sw-brand)] px-9 text-sm font-bold text-white shadow-[0_8px_20px_rgba(37,99,235,0.22)] active:bg-[var(--sw-brand-dark)]"
          >
            去选福利
          </button>
        </div>
      ) : (
        <>
          <div className="shrink-0 px-3 pb-2 pt-3">
            <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-[#123D91] to-[#2166E8] px-4 py-3.5 text-white shadow-[0_8px_22px_rgba(29,78,216,0.16)]">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[10px] font-medium text-blue-100">
                    <CreditCard className="h-3.5 w-3.5" />
                    福利卡可用额度
                  </div>
                  <div className="mt-1 truncate font-mono text-xl font-black tracking-tight">
                    <span className="mr-0.5 text-sm">¥</span>
                    {user.welfareBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="flex-none rounded-xl bg-white/12 px-3 py-2 text-right ring-1 ring-inset ring-white/15">
                  <div className="text-[9px] text-blue-100">当前已选</div>
                  <div className="mt-0.5 font-mono text-sm font-black">¥{totalPrice.toFixed(2)}</div>
                </div>
              </div>
            </section>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3">
            <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_5px_20px_rgba(15,23,42,0.05)]">
              <header className="flex min-h-12 items-center justify-between border-b border-gray-100 px-3.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-blue-50 text-[var(--sw-brand)]">
                    <Store className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 truncate text-xs font-black text-gray-900">{currentMall.mallName || '当前福利商城'}</span>
                  <span className="flex-none rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-medium text-gray-500">{cartQuantity} 件</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsManaging((managing) => !managing)}
                  className="ml-3 min-h-9 flex-none px-1 text-xs font-bold text-[var(--sw-brand)] active:text-[var(--sw-brand-dark)]"
                >
                  {isManaging ? '完成' : '管理'}
                </button>
              </header>

              <div className="divide-y divide-gray-100">
                {cart.map((item) => (
                  <article key={item.id} className="flex gap-2.5 px-3 py-3.5">
                    <button
                      type="button"
                      aria-label={`${item.selected ? '取消选择' : '选择'}：${item.product.title}`}
                      onClick={() => toggleCartItemSelected(item.id)}
                      className="flex h-20 w-7 flex-none items-center justify-start"
                    >
                      {item.selected ? <CheckCircle2 className="h-5 w-5 fill-[var(--sw-brand)] text-white" /> : <Circle className="h-5 w-5 text-gray-300" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setMpPage('detail', item.product.id)}
                      aria-label={`查看商品：${item.product.title}`}
                      className="h-20 w-20 flex-none overflow-hidden rounded-xl border border-gray-100 bg-gray-50 active:opacity-80"
                    >
                      <img
                        src={storefrontImageUrl(item.product.images[0], 160)}
                        srcSet={`${storefrontImageUrl(item.product.images[0], 160)} 2x, ${storefrontImageUrl(item.product.images[0], 240)} 3x`}
                        alt=""
                        width={80}
                        height={80}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    </button>

                    <div className="min-w-0 flex-1">
                      <button type="button" onClick={() => setMpPage('detail', item.product.id)} className="block w-full text-left active:opacity-70">
                        <h2 className="line-clamp-2 min-h-9 text-xs font-bold leading-[18px] text-gray-900">{item.product.title}</h2>
                      </button>

                      <div className="mt-1.5 flex min-w-0 items-center gap-1.5">
                        <span className="max-w-[120px] truncate rounded-md bg-gray-100 px-1.5 py-0.5 text-[9px] text-gray-500">
                          {Object.values(item.selectedSpec || {}).join(' / ') || '默认规格'}
                        </span>
                        <span className="flex-none rounded-md bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">福利卡可用</span>
                      </div>

                      <div className="mt-2.5 flex items-end justify-between gap-2">
                        <div className="min-w-0">
                          <div className="whitespace-nowrap font-mono text-sm font-black text-[#E5484D]">
                            <span className="text-[10px]">¥</span>{item.product.priceMall.toFixed(2)}
                          </div>
                          {item.product.priceMarket > item.product.priceMall && (
                            <div className="font-mono text-[9px] text-gray-400 line-through">¥{item.product.priceMarket.toFixed(2)}</div>
                          )}
                        </div>

                        {!isManaging && (
                          <div className="flex h-8 flex-none items-center overflow-hidden rounded-lg bg-gray-100 text-xs">
                            <button
                              type="button"
                              aria-label={`减少${item.product.title}数量`}
                              onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                              className="h-8 w-8 font-bold text-gray-600 active:bg-gray-200"
                            >
                              −
                            </button>
                            <CartQuantityInput value={item.quantity} onChange={(quantity) => updateCartQuantity(item.id, quantity)} />
                            <button
                              type="button"
                              aria-label={`增加${item.product.title}数量`}
                              onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                              className="h-8 w-8 font-bold text-gray-700 active:bg-gray-200"
                            >
                              ＋
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <div className="mt-2.5">
              <MPCartInvoiceDisclosure
                expanded={isOrderServicesOpen}
                onToggle={() => setIsOrderServicesOpen((open) => !open)}
                onEdit={() => triggerPendingFeature('企业发票抬头信息', '选择本次订单需要使用的发票抬头。')}
              />
            </div>

            <p className="py-3 text-center text-[10px] text-gray-400">配送地址将在结算时确认</p>
          </div>

          <div data-cart-settlement-bar className="flex shrink-0 items-center gap-2 border-t border-gray-200/80 bg-white px-3 py-2.5 shadow-[0_-8px_24px_rgba(15,23,42,0.06)]">
            <button type="button" onClick={() => toggleSelectAllCart(!isAllSelected)} className="flex min-h-10 flex-none items-center gap-1.5 pr-1 text-xs font-bold text-gray-700">
              {isAllSelected ? <CheckCircle2 className="h-5 w-5 fill-[var(--sw-brand)] text-white" /> : <Circle className="h-5 w-5 text-gray-300" />}
              <span>全选</span>
            </button>

            {isManaging ? (
              <>
                <div className="min-w-0 flex-1 text-right text-[10px] text-gray-400">已选 {selectedQuantity} 件</div>
                <button
                  type="button"
                  onClick={handleRemoveSelected}
                  disabled={selectedItems.length === 0}
                  className={`min-h-11 min-w-[112px] flex-none rounded-full px-5 text-sm font-bold ${
                    selectedItems.length > 0 ? 'border border-red-500 bg-white text-red-500 active:bg-red-50' : 'cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-300'
                  }`}
                >
                  删除 ({selectedQuantity})
                </button>
              </>
            ) : (
              <>
                <div className="min-w-0 flex-1 text-right">
                  {totalSubsidy > 0 && <div className="truncate text-[9px] font-medium text-emerald-600">本单已省 ¥{totalSubsidy.toFixed(2)}</div>}
                  <div className="truncate text-xs font-bold text-gray-900">
                    合计 <span className="font-mono text-base font-black text-[#E5484D]">¥{totalPrice.toFixed(2)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={selectedItems.length === 0 || isSubmittingOrder}
                  className={`min-h-11 min-w-[112px] flex-none rounded-full px-5 text-sm font-bold text-white shadow-[0_6px_16px_rgba(37,99,235,0.18)] ${
                    selectedItems.length > 0 ? 'bg-[var(--sw-brand)] active:bg-[var(--sw-brand-dark)]' : 'cursor-not-allowed bg-gray-300 shadow-none'
                  }`}
                >
                  {isSubmittingOrder ? '正在提交…' : `结算 (${selectedQuantity})`}
                </button>
              </>
            )}
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
      className="h-8 w-9 bg-transparent px-0.5 text-center font-mono text-xs font-bold text-gray-900 outline-none focus:bg-blue-50"
    />
  );
}
