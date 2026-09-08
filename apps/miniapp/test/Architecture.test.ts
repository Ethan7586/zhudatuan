import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MINIAPP_RESOURCE_STATES, MINIAPP_TOKEN, MINIAPP_VIEW_STATES } from '../miniprogram/generated/DesignBinding';
import { accountViewModel } from '../miniprogram/feature/account/viewmodel/AccountViewModel';
import { aftersaleViewModel } from '../miniprogram/feature/aftersale/viewmodel/AftersaleViewModel';
import { benefitViewModel } from '../miniprogram/feature/benefit/viewmodel/BenefitViewModel';
import { cartViewModel } from '../miniprogram/feature/cart/viewmodel/CartViewModel';
import { catalogViewModel } from '../miniprogram/feature/catalog/viewmodel/CatalogViewModel';
import { checkoutViewModel } from '../miniprogram/feature/checkout/viewmodel/CheckoutViewModel';
import { homeViewModel } from '../miniprogram/feature/home/viewmodel/HomeViewModel';
import { notificationViewModel } from '../miniprogram/feature/notification/viewmodel/NotificationViewModel';
import { orderViewModel } from '../miniprogram/feature/order/viewmodel/OrderViewModel';
import { paymentViewModel } from '../miniprogram/feature/payment/viewmodel/PaymentViewModel';
import { productViewModel } from '../miniprogram/feature/product/viewmodel/ProductViewModel';
import { referralViewModel } from '../miniprogram/feature/referral/viewmodel/ReferralViewModel';
import { supportViewModel } from '../miniprogram/feature/support/viewmodel/SupportViewModel';
import { voucherViewModel } from '../miniprogram/feature/voucher/viewmodel/VoucherViewModel';

const root = resolve(import.meta.dirname, '..');

describe('miniapp architecture gates', () => {
  it('keeps only home in the initial package and assigns every other feature to one subpackage', () => {
    const application = JSON.parse(readFileSync(join(root, 'miniprogram/app.json'), 'utf8'));
    expect(application.pages).toEqual(['feature/home/page']);
    const packaged = new Set(application.subPackages.map((item: { root: string }) => item.root.replace('feature/', '')));
    const features = readdirSync(join(root, 'miniprogram/feature'), { withFileTypes: true }).filter((item) => item.isDirectory()).map(({ name }) => name);
    expect(features.filter((feature) => feature !== 'home').every((feature) => packaged.has(feature))).toBe(true);
  });

  it('allows wx.request only in the platform requester', () => {
    const source = sourceFiles(join(root, 'miniprogram')).map((file) => [file, readFileSync(file, 'utf8')] as const);
    expect(source.filter(([, value]) => /\bwx\.request\s*\(/.test(value)).map(([file]) => file)).toEqual([join(root, 'miniprogram/platform/Request.ts')]);
    expect(source.some(([, value]) => /\b(?:mock|showcase|PendingInterfaceModal)\b/i.test(value))).toBe(false);
  });

  it('gives every generated route one readable, Chinese-facing projection', () => {
    const features = [homeViewModel, catalogViewModel, productViewModel, cartViewModel, checkoutViewModel, paymentViewModel, orderViewModel, aftersaleViewModel, voucherViewModel, benefitViewModel, referralViewModel, supportViewModel, notificationViewModel, accountViewModel];
    expect(features).toHaveLength(14);
    expect(features.every((feature) => feature.project !== undefined)).toBe(true);
    expect(features.every((feature) => feature.bootstrap === true || feature.read !== undefined)).toBe(true);
  });

  it('consumes generated design states and accessibility tokens', () => {
    expect(MINIAPP_VIEW_STATES).toContain('success');
    expect(MINIAPP_RESOURCE_STATES).toContain('offline');
    expect(MINIAPP_TOKEN.minimumTouchRpx).toBeGreaterThanOrEqual(88);
  });
});

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? sourceFiles(join(directory, entry.name)) : entry.isFile() && entry.name.endsWith('.ts') ? [join(directory, entry.name)] : []);
}
