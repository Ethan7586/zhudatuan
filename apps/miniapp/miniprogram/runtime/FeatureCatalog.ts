import { AccountManifest } from '../feature/account/Manifest';
import { AftersaleManifest } from '../feature/aftersale/Manifest';
import { BenefitManifest } from '../feature/benefit/Manifest';
import { CartManifest } from '../feature/cart/Manifest';
import { CatalogManifest } from '../feature/catalog/Manifest';
import { CheckoutManifest } from '../feature/checkout/Manifest';
import { HomeManifest } from '../feature/home/Manifest';
import { NotificationManifest } from '../feature/notification/Manifest';
import { OrderManifest } from '../feature/order/Manifest';
import { PaymentManifest } from '../feature/payment/Manifest';
import { ProductManifest } from '../feature/product/Manifest';
import { ReferralManifest } from '../feature/referral/Manifest';
import { SupportManifest } from '../feature/support/Manifest';
import { VoucherManifest } from '../feature/voucher/Manifest';
import { NAVIGATION_ROUTE_IDS } from '../generated/NavigationBinding';
import type { RouteId } from '../generated/RouteBinding';
import type { MiniappFeatureViewModel } from '../shared/FeatureViewModel';

const manifests = [
  HomeManifest,
  CatalogManifest,
  ProductManifest,
  CartManifest,
  CheckoutManifest,
  PaymentManifest,
  OrderManifest,
  AftersaleManifest,
  VoucherManifest,
  BenefitManifest,
  ReferralManifest,
  SupportManifest,
  NotificationManifest,
  AccountManifest,
] as const;
const entries = manifests.flatMap((manifest) => manifest.routes.map(({ routeid }) => [routeid, manifest.viewModel] as const));
if (new Set(entries.map(([route]) => route)).size !== entries.length) throw new Error('MINIAPP_FEATURE_ROUTE_DUPLICATE');
const configured = new Set(NAVIGATION_ROUTE_IDS);
if (entries.length !== configured.size || entries.some(([route]) => !configured.has(route))) throw new Error('MINIAPP_FEATURE_ROUTE_INCOMPLETE');

export const MINIAPP_FEATURES = Object.freeze(Object.fromEntries(entries)) as Readonly<Record<RouteId, MiniappFeatureViewModel>>;
