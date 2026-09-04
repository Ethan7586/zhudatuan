import { accountManifest } from '../feature/account/public/Manifest';
import { deviceManifest } from '../feature/device/public/Manifest';
import { dashboardManifest } from '../feature/dashboard/public/Manifest';
import { fulfillmentManifest } from '../feature/fulfillment/public/Manifest';
import { inventoryManifest } from '../feature/inventory/public/Manifest';
import { orderManifest } from '../feature/order/public/Manifest';
import { returnManifest } from '../feature/return/public/Manifest';
import { supportManifest } from '../feature/support/public/Manifest';
import { verificationManifest } from '../feature/verification/public/Manifest';
import { voucherManifest } from '../feature/voucher/public/Manifest';
import type { RouteId } from '../generated/RouteBinding';
import type { StoreFeatureRoute } from '../shared/FeatureManifest';

const manifests = [accountManifest, dashboardManifest, deviceManifest, fulfillmentManifest, inventoryManifest, orderManifest, returnManifest, supportManifest, verificationManifest, voucherManifest] as const;
const entries = manifests.flatMap((manifest) => manifest.routes.map((route) => [route.routeid, route] as const));
if (new Set(entries.map(([route]) => route)).size !== entries.length) throw new Error('STORE_ROUTE_DUPLICATE');
export const STORE_ROUTES = Object.freeze(Object.fromEntries(entries)) as Readonly<Record<RouteId, StoreFeatureRoute>>;
