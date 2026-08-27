import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMall } from '../../context/MallContext';
import { productionApi, ProductionApiError } from '../../services/productionApi';
import { calculatePaymentAllocation } from '../../utils/finance';
import { getOutOfStockActionHint } from '../../utils/inventory';

export function useCheckoutModel() {
  const mall = useMall();
  const { cart, user, addresses, addAddress, navigateTo, showToast, sessionStatus, refreshProductionData, removeCartItem } = mall;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedItems = useMemo(() => cart.filter((item) => item.selected), [cart]);
  const [selectedAddrId, setSelectedAddrId] = useState(addresses.find((address) => address.isDefault)?.id || addresses[0]?.id || '');
  const [showAddAddrModal, setShowAddAddrModal] = useState(false);
  const [newAddrForm, setNewAddrForm] = useState({
    name: user.name,
    phone: '13812349281',
    province: '北京市',
    city: '北京市',
    district: '西城区',
    detail: '',
    isDefault: false,
    tag: '公司',
  });
  const totalGoodsAmount = useMemo(() => selectedItems.reduce((total, item) => total + item.product.priceWelfare * item.quantity, 0), [selectedItems]);
  const invalidItems = useMemo(() => selectedItems.filter((item) => item.product.stock <= 0 || item.quantity > item.product.stock), [selectedItems]);
  const [useWelfare, setUseWelfare] = useState(true);
  const [welfareInput, setWelfareInput] = useState(() => Math.min(totalGoodsAmount, user.welfareBalance));
  const effectiveWelfareInput = useWelfare ? Math.min(totalGoodsAmount, user.welfareBalance, Math.max(0, welfareInput)) : 0;
  const remAfterWelfare = Math.max(0, totalGoodsAmount - effectiveWelfareInput);
  const [useMeal, setUseMeal] = useState(true);
  const [mealInput, setMealInput] = useState(() => Math.min(remAfterWelfare, user.mealBalance));
  useEffect(() => {
    const fallback = addresses.find((address) => address.isDefault)?.id || addresses[0]?.id || '';
    if (!addresses.length || selectedAddrId === fallback) return;
    if (!addresses.some((address) => address.id === selectedAddrId)) setSelectedAddrId(fallback);
  }, [addresses, selectedAddrId]);
  useEffect(() => {
    setMealInput((previous) => Math.min(previous, remAfterWelfare, user.mealBalance));
  }, [remAfterWelfare, user.mealBalance]);
  const paymentAllocation = calculatePaymentAllocation(totalGoodsAmount, effectiveWelfareInput, useMeal ? mealInput : 0, user.welfareBalance, user.mealBalance);
  const finalWechatTopUp = paymentAllocation.external;
  const [invoiceType, setInvoiceType] = useState<'none' | 'personal' | 'company'>('company');
  const [invoiceTitle, setInvoiceTitle] = useState(user.enterpriseName);
  const [invoiceTaxNo, setInvoiceTaxNo] = useState('91110000100011889X');
  const [userRemark, setUserRemark] = useState('');
  const submitBlocker = useMemo(() => {
    if (selectedItems.length === 0) {
      return '请先返回购物车选择要结算的商品';
    }
    if (!selectedAddrId) {
      return '请先选择或新增收货地址';
    }
    if (selectedItems.some((item) => item.product.stock <= 0 || item.quantity > item.product.stock)) {
      return `${getOutOfStockActionHint(invalidItems.length)}请先返回购物车修正后再提交`;
    }
    if (selectedItems.some((item) => !item.product.skuId)) {
      return '购物车中的商品信息已失效，请清空后从最新商品目录重新加入';
    }
    if (sessionStatus !== 'authenticated') {
      return '请先点击页面顶部“登录账户”，再提交订单';
    }
    if (!user.phoneVerified || !user.paymentEligible) {
      return '手机尚未验证，完成短信验证后才能提交订单和付款';
    }
    if (finalWechatTopUp > 0) {
      return '当前订单需使用福利卡或餐卡支付，账户余额不足时暂不能提交。';
    }
    return '';
  }, [finalWechatTopUp, invalidItems.length, selectedAddrId, selectedItems, sessionStatus, user.paymentEligible, user.phoneVerified]);
  const groupedItems = useMemo(() => {
    const groups = new Map<string, typeof selectedItems>();
    selectedItems.forEach((item) => {
      const supplier = item.product.supplierName;
      if (!groups.has(supplier)) groups.set(supplier, []);
      groups.get(supplier)!.push(item);
    });
    return Array.from(groups.entries());
  }, [selectedItems]);

  const handleAddNewAddress = (event: FormEvent) => {
    event.preventDefault();
    if (!newAddrForm.name || !newAddrForm.phone || !newAddrForm.province || !newAddrForm.city || !newAddrForm.district || !newAddrForm.detail) {
      showToast('请填写详细收货地址', 'warning');
      return;
    }
    if (!/^1\d{10}$/.test(newAddrForm.phone)) {
      showToast('请输入真实的大陆手机号', 'warning');
      return;
    }
    addAddress(newAddrForm);
    setShowAddAddrModal(false);
  };

  const handleSubmitOrder = async () => {
    if (submitBlocker) {
      showToast(submitBlocker, 'warning');
      return;
    }
    const selectedAddress = addresses.find((address) => address.id === selectedAddrId);
    if (!selectedAddress) {
      showToast('请选择有效的收货地址', 'warning');
      return;
    }
    setIsSubmitting(true);
    try {
      const idempotencyRoot = crypto.randomUUID();
      const created = await productionApi.createOrder(
        {
          items: selectedItems.map((item) => ({
            skuId: item.product.skuId!,
            quantity: item.quantity,
          })),
          recipient: {
            name: selectedAddress.name,
            mobile: selectedAddress.phone,
            province: selectedAddress.province,
            city: selectedAddress.city,
            district: selectedAddress.district,
            address: selectedAddress.detail,
          },
        },
        `order-${idempotencyRoot}`
      );
      await productionApi.payWithInternalAccounts(
        created.order.id,
        {
          welfareCents: Math.round(paymentAllocation.welfare * 100),
          mealCents: Math.round(paymentAllocation.meal * 100),
        },
        `payment-${idempotencyRoot}`
      );
      await Promise.all(selectedItems.map((item) => removeCartItem(item.id)));
      await refreshProductionData();
      showToast('订单已写入生产型数据库并完成福利账户支付', 'success');
      navigateTo('orders');
    } catch (error) {
      const message = error instanceof ProductionApiError ? error.message : '服务暂时不可用';
      showToast(`提交订单失败：${message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    ...mall,
    isSubmitting,
    selectedItems,
    selectedAddrId,
    setSelectedAddrId,
    showAddAddrModal,
    setShowAddAddrModal,
    newAddrForm,
    setNewAddrForm,
    totalGoodsAmount,
    useWelfare,
    setUseWelfare,
    welfareInput,
    setWelfareInput,
    remAfterWelfare,
    useMeal,
    setUseMeal,
    mealInput,
    setMealInput,
    paymentAllocation,
    finalWechatTopUp,
    invoiceType,
    setInvoiceType,
    invoiceTitle,
    setInvoiceTitle,
    invoiceTaxNo,
    setInvoiceTaxNo,
    userRemark,
    setUserRemark,
    invalidItems,
    groupedItems,
    submitBlocker,
    handleAddNewAddress,
    handleSubmitOrder,
  };
}

export type CheckoutModel = ReturnType<typeof useCheckoutModel>;
