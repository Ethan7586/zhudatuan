import { matchPath } from 'react-router';
import { COMPONENT_KEYS, NAVIGATION_IDS } from '../generated/NavigationBinding';
import { ChannelManifest } from '../feature/channel/Manifest';
import { CockpitManifest } from '../feature/cockpit/Manifest';
import { ControlManifest } from '../feature/control/Manifest';
import { ExperienceManifest } from '../feature/experience/Manifest';
import { FinanceManifest } from '../feature/finance/Manifest';
import { OrderManifest } from '../feature/order/Manifest';
import { ProductManifest } from '../feature/product/Manifest';
import { ReferralManifest } from '../feature/referral/Manifest';
import { ReportingManifest } from '../feature/reporting/Manifest';
import { SettingsManifest } from '../feature/settings/Manifest';
import { AccessManifest } from '../feature/settings/access/Manifest';
import { DirectoryManifest } from '../feature/settings/directory/Manifest';
import { MemberManifest } from '../feature/settings/member/Manifest';
import { NotificationManifest } from '../feature/settings/notification/Manifest';
import { PartnerManifest } from '../feature/settings/partner/Manifest';
import { ProviderManifest } from '../feature/settings/provider/Manifest';
import { RiskManifest } from '../feature/settings/risk/Manifest';
import { SupportManifest } from '../feature/support/Manifest';
import { InvitationManifest } from '../feature/invitation/Manifest';
import { VoucherManifest } from '../feature/voucher/Manifest';
import type { ComponentManifest, ComponentRoute } from '../shared/manifest/ComponentManifest';

const manifests: readonly ComponentManifest[] = Object.freeze([
  CockpitManifest,
  ControlManifest,
  ExperienceManifest,
  ProductManifest,
  ReferralManifest,
  OrderManifest,
  VoucherManifest,
  ChannelManifest,
  FinanceManifest,
  ReportingManifest,
  SupportManifest,
  InvitationManifest,
  SettingsManifest,
  AccessManifest,
  MemberManifest,
  PartnerManifest,
  NotificationManifest,
  RiskManifest,
  ProviderManifest,
  DirectoryManifest,
]);

const components = new Set<string>();
const navigationids = new Set<string>();
const routes = new Set<string>();
for (const manifest of manifests) {
  if (components.has(manifest.component)) throw new Error(`COMPONENT_DUPLICATE:${manifest.component}`);
  components.add(manifest.component);
  for (const id of manifest.navigationids) {
    if (navigationids.has(id)) throw new Error(`NAVIGATION_BINDING_DUPLICATE:${id}`);
    navigationids.add(id);
  }
  for (const { route } of manifest.routes) {
    if (routes.has(route)) throw new Error(`COMPONENT_ROUTE_DUPLICATE:${route}`);
    routes.add(route);
  }
}
for (const component of COMPONENT_KEYS) {
  if (!components.has(component)) throw new Error(`COMPONENT_BINDING_MISSING:${component}`);
}
for (const id of NAVIGATION_IDS) {
  if (!navigationids.has(id)) throw new Error(`NAVIGATION_BINDING_MISSING:${id}`);
}

const routeBindings: readonly Readonly<{
  manifest: ComponentManifest;
  route: ComponentRoute;
  load: ComponentManifest['load'];
}>[] = Object.freeze(
  manifests.flatMap((manifest) =>
    manifest.routes.map((route) =>
      Object.freeze({
        manifest,
        route,
        load: route.load ?? manifest.load,
      })
    )
  )
);

export const RouteRegistry = Object.freeze({
  all: (): readonly ComponentManifest[] => manifests,
  routes: () => routeBindings,
  match(pathname: string): ComponentManifest | undefined {
    const suffix = `/${scopeSuffix(pathname)}`;
    return routeBindings.find(({ route }) => matchPath({ path: `/${route.route}`, end: true }, suffix))?.manifest;
  },
  hasComponent(component: string): component is (typeof COMPONENT_KEYS)[number] {
    return components.has(component);
  },
});

export function scopeSuffix(pathname: string): string {
  return pathname.split('/').filter(Boolean).slice(3).join('/');
}
