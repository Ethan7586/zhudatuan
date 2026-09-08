import { bindActivationsNumbersecret, bindActivationsSecret, bindRedemptionsGet, bindSearchRead } from '@shop/sdk/voucher';
import { connectMiniappClient, defineMiniappFeature } from '../../../shared/FeatureViewModel';
import { voucherCredential } from '@shop/contract/voucher';
import { actionField, requiredText } from '@shop/presentation/actions';
import { scanMiniappCode } from '../../../platform/Scanner';
import type { OperationOutputFor } from '@shop/contract';
import { displayItem, displayPage, money } from '../../../shared/Display';

export const voucherViewModel = defineMiniappFeature({
  defaultRoute: 'miniappvouchers', routes: ['miniappvouchers'], title: '我的卡券', description: '查看持有卡券、有效期与当前可用状态。',
  connect: (executor) => connectMiniappClient({ voucher: {
    activationsNumbersecret: bindActivationsNumbersecret(executor), activationsSecret: bindActivationsSecret(executor),
    redemptionsGet: bindRedemptionsGet(executor), searchRead: bindSearchRead(executor),
  } }),
  read: (client, context) => client.voucher.searchRead({ query: { limit: 30 } }, context),
  project: (value) => {
    const source = value as OperationOutputFor<'voucher.search.read'>;
    return displayPage(source.items.map((item) => displayItem(item.id, item.productName, `${item.numberMasked} · 余额 ${money(item.remainingMinor, item.currency)}`, item.state, item.updatedAt)));
  },
  actions: () => [
    Object.freeze({ id: 'secret', label: '使用券密激活', description: '券密仅用于本次请求，不会写入页面缓存。', tone: 'primary' as const, fields: [actionField('secret', '券密', { kind: 'password', maximumLength: voucherCredential.secret.maximum })] }),
    Object.freeze({ id: 'numbersecret', label: '使用券号和券密激活', description: '适用于同时提供券号与券密的卡券。', tone: 'secondary' as const, fields: [
      actionField('number', '券号', { maximumLength: voucherCredential.number.maximum }),
      actionField('secret', '券密', { kind: 'password', maximumLength: voucherCredential.secret.maximum }),
    ] }),
    Object.freeze({ id: 'scan', label: '扫码识别卡券或核销结果', description: '仅允许相机扫描二维码；激活信息不会保留在本机。', tone: 'secondary' as const, fields: [] }),
  ],
  execute: async (client, context, _route, _value, action, input) => {
    if (action.id === 'secret') {
      await client.voucher.activationsSecret({ body: { secret: requiredText(input, 'secret', voucherCredential.secret.maximum) } }, context);
      return { message: '卡券已激活。' };
    }
    if (action.id === 'numbersecret') {
      await client.voucher.activationsNumbersecret({ body: {
        number: requiredText(input, 'number', voucherCredential.number.maximum),
        secret: requiredText(input, 'secret', voucherCredential.secret.maximum),
      } }, context);
      return { message: '卡券已激活。' };
    }
    if (action.id !== 'scan') throw new Error('MINIAPP_VOUCHER_ACTION_INVALID');
    const scanned = parseScan(await scanMiniappCode());
    if (scanned.kind === 'redemption') {
      const receipt = await client.voucher.redemptionsGet({ path: { redemptionid: scanned.id } }, context);
      return { message: `核销结果已确认：${receipt.state}，金额 ¥${(receipt.amountMinor / 100).toFixed(2)}。` };
    }
    if (scanned.number === undefined) await client.voucher.activationsSecret({ body: { secret: scanned.secret } }, context);
    else await client.voucher.activationsNumbersecret({ body: { number: scanned.number, secret: scanned.secret } }, context);
    return { message: '二维码中的卡券已激活。' };
  },
});

type ScanValue = Readonly<{ kind: 'activation'; number?: string; secret: string }> | Readonly<{ kind: 'redemption'; id: string }>;

function parseScan(value: string): ScanValue {
  if (value.startsWith('zhudatuan://')) {
    const target = new URL(value);
    if (target.hostname === 'redemption') return Object.freeze({ kind: 'redemption', id: scanText(target.searchParams.get('id'), 255) });
    if (target.hostname === 'activate') {
      const secret = scanText(target.searchParams.get('secret'), voucherCredential.secret.maximum);
      const number = target.searchParams.get('number');
      return Object.freeze({ kind: 'activation', ...(number === null ? {} : { number: scanText(number, voucherCredential.number.maximum) }), secret });
    }
    throw new Error('MINIAPP_SCAN_KIND_INVALID');
  }
  return Object.freeze({ kind: 'activation', secret: scanText(value, voucherCredential.secret.maximum) });
}

function scanText(value: string | null, maximum: number): string {
  if (value === null || value.length === 0 || value.length > maximum) throw new Error('MINIAPP_SCAN_VALUE_INVALID');
  return value;
}
