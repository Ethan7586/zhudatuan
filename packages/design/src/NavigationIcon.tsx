export type NavigationIconKey =
  | 'chart'
  | 'gauge'
  | 'product'
  | 'orders'
  | 'finance'
  | 'application'
  | 'voucher'
  | 'report'
  | 'support'
  | 'channel'
  | 'import'
  | 'access'
  | 'member'
  | 'qualification'
  | 'notification'
  | 'benefit'
  | 'marketing'
  | 'risk'
  | 'settings'
  | 'shield';

const aliases: Readonly<Record<string, NavigationIconKey>> = Object.freeze({
  dashboard: 'gauge',
  control: 'shield',
  reporting: 'report',
  order: 'orders',
  identity: 'access',
  directory: 'member',
  partner: 'member',
  home: 'gauge',
  cart: 'orders',
  profile: 'member',
  catalog: 'product',
});
const paths: Readonly<Record<NavigationIconKey, readonly string[]>> = Object.freeze({
  chart: ['M3 3v18h18', 'm7 16 4-4 4 4 5-6', 'M18 10h2v2'],
  gauge: ['M20.4 15a9 9 0 1 0-16.8 0', 'm12 12 4-4', 'M8 19h8'],
  product: ['M3 6h18', 'M5 6l1 15h12l1-15', 'M9 10h6', 'M9 14h6'],
  orders: ['M6 2h12l2 5-2 15H6L4 7l2-5', 'M4 7h16', 'M9 11h6'],
  finance: ['M6 2h12v20H6z', 'M9 6h6', 'M9 10h6', 'M9 14h2', 'M13 14h2', 'M9 18h2', 'M13 18h2'],
  application: ['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M13 13h7v7h-7z'],
  voucher: ['M3 6h18v12H3z', 'M8 6v12', 'M8 10h2', 'M8 14h2'],
  report: ['M4 20V10', 'M10 20V4', 'M16 20v-7', 'M22 20H2'],
  support: ['M4 13a8 8 0 0 1 16 0', 'M4 13v5h3v-5', 'M20 13v5h-3v-5', 'M17 20h-5'],
  channel: ['M5 12h14', 'm15 8 4 4-4 4', 'M9 5H5v14h4'],
  import: ['M12 3v12', 'm7 10 5 5 5-5', 'M4 19h16'],
  access: ['M12 2a5 5 0 0 0-5 5v3', 'M6 10h12v12H6z', 'M12 14v4'],
  member: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 'M4 22a8 8 0 0 1 16 0'],
  qualification: ['M12 2 4 5v6c0 5 3 8 8 9 5-1 8-4 8-9V5z', 'm9 12 2 2 4-4'],
  notification: ['M6 9a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9', 'M10 22h4'],
  benefit: ['M12 21s-8-4.5-8-11a4 4 0 0 1 7-2.6A4 4 0 0 1 18 10c0 6.5-6 11-6 11z'],
  marketing: ['M3 11v2l12 4V7z', 'M15 9h4l2-2v10l-2-2h-4', 'M6 14l1 6h4l-2-5'],
  risk: ['M12 2 4 5v6c0 5 3 8 8 9 5-1 8-4 8-9V5z', 'M12 8v5', 'M12 17h.01'],
  settings: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8', 'M4 12H2', 'M22 12h-2', 'M12 4V2', 'M12 22v-2'],
  shield: ['M12 2 4 5v6c0 5 3 8 8 9 5-1 8-4 8-9V5z', 'm9 12 2 2 4-4'],
});

export function NavigationIcon({ icon }: Readonly<{ icon: string }>) {
  const key = icon in paths ? (icon as NavigationIconKey) : (aliases[icon] ?? 'shield');
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      aria-hidden="true"
      data-navigation-icon-fallback={(key === 'shield' && icon !== 'shield') || undefined}
    >
      {paths[key].map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}
