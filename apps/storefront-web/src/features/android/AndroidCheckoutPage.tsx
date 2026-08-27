import React, { useState } from 'react';
import { useMall } from '../../context/MallContext';
import { AndroidStatusBar } from '../../components/mobile/AndroidStatusBar';
import { AndroidBottomNav } from '../../components/mobile/AndroidBottomNav';
import { MapPin, CreditCard, Fingerprint, FileText, ShieldCheck, ChevronRight, CheckCircle2, Lock, Utensils, Wallet } from 'lucide-react';

export const AndroidCheckoutPage: React.FC = () => {
  const { cart, user, setAndroidPage, triggerPendingFeature, checkoutSelectedCart, isSubmittingOrder } = useMall();
  const [selectedPayment, setSelectedPayment] = useState<'welfare' | 'meal' | 'wechat' | 'fingerprint'>('welfare');

  const selectedCartItems = cart.filter((c) => c.selected);
  const totalPrice = selectedCartItems.reduce((sum, item) => sum + item.product.priceMall * item.quantity, 0);

  const handlePlaceOrder = async () => {
    if (selectedPayment === 'wechat') {
      triggerPendingFeature('Android 微信支付 SDK API', '调用 com.tencent.mm.opensdk.openapi.IWXAPI 调起原生 App 微信支付接口。');
    } else if (selectedPayment === 'fingerprint') {
      triggerPendingFeature('Android BiometricPrompt 生物识别支付', '调用 BiometricPrompt 生物特征库进行指纹/人脸 1.5s 极速快捷扣款。');
    } else if (await checkoutSelectedCart()) {
      setAndroidPage('profile');
    }
  };

  return (
    <div className="bg-[#F5F7FA] min-h-full flex flex-col font-sans text-gray-800 relative pb-16">
      <AndroidStatusBar title="确认福利订单" showBack={true} onBack={() => setAndroidPage('home')} />

      <div className="p-3 space-y-3 flex-1 overflow-y-auto">
        {/* Delivery Address Card */}
        <div
          onClick={() => triggerPendingFeature('Android 收货地址选择器', '切换配送地址（宿舍/办公大楼）。')}
          className="bg-white rounded-3xl p-3.5 shadow-2xs border border-gray-100 flex items-center justify-between cursor-pointer hover:bg-blue-50/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[var(--sw-brand)] flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-gray-900 flex items-center gap-2">
                <span>张伟 (员工编号 80219)</span>
                <span className="text-[9px] bg-blue-100 text-[var(--sw-brand)] font-bold px-1.5 py-0.2 rounded">公司默认</span>
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5">北京市朝阳区中国建筑大厦 12F 企采物流中心</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </div>

        {/* Selected Order Products Summary */}
        <div className="bg-white rounded-3xl p-3.5 shadow-2xs border border-gray-100 space-y-3">
          <div className="text-xs font-black text-gray-900 border-b border-gray-100 pb-2 flex items-center justify-between">
            <span>企采结算清单</span>
            <span className="text-[10px] text-gray-400">共 {selectedCartItems.length} 件</span>
          </div>

          <div className="space-y-2.5">
            {selectedCartItems.map((item) => (
              <div key={item.id} className="flex items-center gap-2.5 text-xs">
                <img src={item.product.images[0]} alt={item.product.title} className="w-12 h-12 object-cover rounded-xl flex-shrink-0 border border-gray-100" />
                <div className="flex-1 overflow-hidden">
                  <div className="font-bold text-gray-900 truncate">{item.product.title}</div>
                  <div className="text-[10px] text-gray-400">数量 x{item.quantity}</div>
                </div>
                <div className="font-mono font-bold text-[#E5484D] text-right">¥{(item.product.priceMall * item.quantity).toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Methods Choice (Includes 接口待接入 tags) */}
        <div className="bg-white rounded-3xl p-3.5 shadow-2xs border border-gray-100 space-y-3">
          <div className="text-xs font-black text-gray-900 border-b border-gray-100 pb-2">支付扣款方式选择</div>

          <div className="space-y-2 text-xs">
            {/* Welfare Card (Default) */}
            <div
              onClick={() => setSelectedPayment('welfare')}
              className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-colors ${
                selectedPayment === 'welfare' ? 'border-[var(--sw-brand)] bg-blue-50/70 text-[var(--sw-brand)]' : 'border-gray-200 text-gray-700 bg-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <CreditCard className="w-5 h-5 text-[var(--sw-brand)]" />
                <div>
                  <div className="font-bold">福利卡全额抵扣</div>
                  <div className="text-[10px] text-gray-500">可用余额: ¥{user.welfareBalance.toFixed(2)}</div>
                </div>
              </div>
              <CheckCircle2 className={`w-5 h-5 ${selectedPayment === 'welfare' ? 'text-[var(--sw-brand)]' : 'text-gray-300'}`} />
            </div>

            {/* Meal Card */}
            <div
              onClick={() => setSelectedPayment('meal')}
              className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-colors ${
                selectedPayment === 'meal' ? 'border-[#FF7A00] bg-orange-50/70 text-[#FF7A00]' : 'border-gray-200 text-gray-700 bg-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Utensils className="w-5 h-5 text-[#FF7A00]" />
                <div>
                  <div className="font-bold">餐卡专享扣减</div>
                  <div className="text-[10px] text-gray-500">可用余额: ¥{user.mealBalance.toFixed(2)}</div>
                </div>
              </div>
              <CheckCircle2 className={`w-5 h-5 ${selectedPayment === 'meal' ? 'text-[#FF7A00]' : 'text-gray-300'}`} />
            </div>

            {/* WeChat Pay (接口待接入) */}
            <div
              onClick={() => setSelectedPayment('wechat')}
              className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-colors ${
                selectedPayment === 'wechat' ? 'border-emerald-600 bg-emerald-50/70 text-emerald-700' : 'border-gray-200 text-gray-700 bg-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Wallet className="w-5 h-5 text-emerald-600" />
                <div>
                  <div className="font-bold flex items-center gap-1.5">
                    <span>微信支付</span>
                    <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">接口待接入</span>
                  </div>
                  <div className="text-[10px] text-gray-500">如福利卡余额不足时差额补足</div>
                </div>
              </div>
              <CheckCircle2 className={`w-5 h-5 ${selectedPayment === 'wechat' ? 'text-emerald-600' : 'text-gray-300'}`} />
            </div>

            {/* Fingerprint Biometric Auth (接口待接入) */}
            <div
              onClick={() => setSelectedPayment('fingerprint')}
              className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-colors ${
                selectedPayment === 'fingerprint' ? 'border-purple-600 bg-purple-50/70 text-purple-700' : 'border-gray-200 text-gray-700 bg-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Fingerprint className="w-5 h-5 text-purple-600" />
                <div>
                  <div className="font-bold flex items-center gap-1.5">
                    <span>指纹 / FaceID 生物识别免密扣款</span>
                    <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">接口待接入</span>
                  </div>
                  <div className="text-[10px] text-gray-500">Android Biometric API 授权</div>
                </div>
              </div>
              <CheckCircle2 className={`w-5 h-5 ${selectedPayment === 'fingerprint' ? 'text-purple-600' : 'text-gray-300'}`} />
            </div>
          </div>
        </div>

        {/* Invoice Header Selection */}
        <div className="bg-white rounded-3xl p-3.5 shadow-2xs border border-gray-100 space-y-2 text-xs">
          <div className="flex items-center justify-between text-gray-700">
            <span className="font-bold flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-gray-500" />
              <span>企采发票</span>
            </span>
            <span className="text-gray-900 font-bold">中国建筑集团有限公司 (电子增值税发票)</span>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Action Bar */}
      <div className="fixed bottom-12 left-0 right-0 max-w-[430px] mx-auto bg-white border-t border-gray-200 p-3 z-40 flex items-center justify-between shadow-2xl">
        <div>
          <div className="text-[10px] text-gray-500">应扣付总额</div>
          <div className="text-base font-black text-[#E5484D] font-mono">¥{totalPrice.toFixed(2)}</div>
        </div>

        <button
          onClick={handlePlaceOrder}
          disabled={isSubmittingOrder}
          className="bg-gradient-to-r from-[var(--sw-brand)] to-[var(--sw-brand-dark)] hover:bg-blue-700 text-white font-bold text-xs px-6 py-3 rounded-2xl shadow-md cursor-pointer active:scale-98 transition-transform"
        >
          {isSubmittingOrder ? '安全提交中…' : selectedPayment === 'fingerprint' ? '指纹快捷支付（接口待接入）' : '确认并提交真实订单'}
        </button>
      </div>

      <AndroidBottomNav />
    </div>
  );
};
