import { bindCurrentRead } from '@shop/sdk/cart';
import { bindQuoteCreate, bindQuotesCurrentRead } from '@shop/sdk/checkout';
import { bindAddressesRead } from '@shop/sdk/member';
import { bindOrdersCreate } from '@shop/sdk/order';
import { connectMiniappClient, defineMiniappFeature } from '../../../shared/FeatureViewModel';
import type { OperationOutputFor } from '@shop/contract';
import { actionField, optionalText } from '@shop/presentation/actions';
import { miniappPagePath } from '../../../generated/PageBinding';
import { displayItem, displayPage, money } from '../../../shared/Display';

export const checkoutViewModel = defineMiniappFeature({
  defaultRoute: 'miniappcheckout', routes: ['miniappcheckout'], title: '确认订单', description: '地址、福利、卡券和应付金额以服务端报价为准。',
  connect: (executor) => connectMiniappClient({
    cart: { currentRead: bindCurrentRead(executor) }, checkout: { quoteCreate: bindQuoteCreate(executor), quotesCurrentRead: bindQuotesCurrentRead(executor) },
    member: { addressesRead: bindAddressesRead(executor) }, order: { ordersCreate: bindOrdersCreate(executor) },
  }),
  read: (client, context) => client.checkout.quotesCurrentRead({}, context),
  project: (value) => {
    const quote = (value as OperationOutputFor<'checkout.quotes.current.read'>).quote;
    if (quote === null) return displayPage();
    return displayPage(
      [displayItem('summary', '订单应付金额', `${money(quote.payableMinor, quote.currency)} · 优惠 ${money(quote.discountMinor, quote.currency)} · 运费 ${money(quote.shippingMinor, quote.currency)}`, quote.rejections.length === 0 ? 'ready' : 'needsaction', quote.expiresAt)],
      quote.lines.map((line) => displayItem(line.listing, line.title, `${line.quantity} 件 · 应付 ${money(line.payableMinor, quote.currency)}`, line.accepted ? 'accepted' : 'rejected'))
    );
  },
  actions: (value) => {
    const quote = (value as OperationOutputFor<'checkout.quotes.current.read'>).quote;
    if (quote === null) return [Object.freeze({
      id: 'quote',
      label: '核算订单',
      description: '系统会按已选购物车商品，自动使用默认地址并重新核对所有优惠。',
      tone: 'primary' as const,
      fields: [actionField('note', '配送备注', { required: false, maximumLength: 200 })],
    })];
    if (quote.confirmationToken === null || quote.rejections.length > 0) return [Object.freeze({ id: 'quote', label: '重新核算', description: '当前报价不可提交，请重新核对库存、价格和优惠。', tone: 'secondary' as const, fields: [] })];
    return [Object.freeze({
      id: 'commit',
      label: `提交订单（¥${(quote.payableMinor / 100).toFixed(2)}）`,
      description: `报价有效至 ${new Date(quote.expiresAt).toLocaleString('zh-CN')}，最终金额以本页服务端报价为准。`,
      tone: 'primary' as const,
      confirmation: `确认按服务端报价 ¥${(quote.payableMinor / 100).toFixed(2)} 提交订单？`,
      fields: [],
    })];
  },
  execute: async (client, context, _route, value, action, input) => {
    const current = value as OperationOutputFor<'checkout.quotes.current.read'>;
    if (action.id === 'quote') {
      const [cart, addresses] = await Promise.all([client.cart.currentRead({}, context), client.member.addressesRead({ query: { limit: 50 } }, context)]);
      const lines = cart.items.filter((item) => item.selected && item.validity.state === 'valid').map((item) => ({ listingId: item.listing, quantity: item.quantity, lineVersion: item.version }));
      if (lines.length === 0) throw new Error('MINIAPP_CHECKOUT_CART_EMPTY');
      const address = addresses.items.find((item) => item.is_default && item.status === 'active') ?? addresses.items.find((item) => item.status === 'active');
      await client.checkout.quoteCreate({ body: {
        cartVersion: cart.version,
        lines,
        ...(address === undefined ? {} : { addressId: address.id }),
        delivery: { method: 'standard', ...(optionalText(input, 'note', 200) === undefined ? {} : { note: optionalText(input, 'note', 200)! }) },
        voucherIds: [],
        benefits: [],
        paymentScene: 'miniapp',
      } }, context);
      return { message: '报价已更新，请核对金额后提交。' };
    }
    const quote = current.quote;
    if (action.id !== 'commit' || quote?.confirmationToken === null || quote === null) throw new Error('MINIAPP_CHECKOUT_QUOTE_INVALID');
    const committed = await client.order.ordersCreate({ body: { quoteId: quote.quoteId, confirmationToken: quote.confirmationToken, paymentScene: 'miniapp' } }, context);
    return { message: '订单已提交，正在核验支付状态。', destination: miniappPagePath('miniapppayment', { paymentId: committed.payment.paymentId }) };
  },
});
