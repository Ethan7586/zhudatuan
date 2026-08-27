export type IconName = 'chart' | 'gauge' | 'product' | 'orders' | 'finance' | 'application' | 'voucher' | 'report'
  | 'support' | 'channel' | 'import' | 'access' | 'member' | 'qualification' | 'notification'
  | 'collapse' | 'expand' | 'logout' | 'shield';

const paths: Readonly<Record<IconName, readonly string[]>> = Object.freeze({
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
  collapse: ['M4 4h16v16H4z', 'M9 4v16', 'm15 9-3 3 3 3'],
  expand: ['M4 4h16v16H4z', 'M9 4v16', 'm12 9 3 3-3 3'],
  logout: ['M10 4H5v16h5', 'm15 16 4-4-4-4', 'M19 12H9'],
  shield: ['M12 2 4 5v6c0 5 3 8 8 9 5-1 8-4 8-9V5z', 'm9 12 2 2 4-4'],
});

export function Icon({ name }: Readonly<{ name: IconName }>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      focusable="false" aria-hidden="true">
      {paths[name].map((path) => <path key={path} d={path} />)}
    </svg>
  );
}
