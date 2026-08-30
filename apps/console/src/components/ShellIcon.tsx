export type ShellIconName = 'applications' | 'bell' | 'building' | 'channel' | 'chevron' | 'collapse' | 'control'
  | 'finance' | 'menu' | 'members' | 'orders' | 'products' | 'search' | 'support' | 'system' | 'tasks' | 'trend' | 'voucher';

const paths: Readonly<Record<ShellIconName, readonly string[]>> = Object.freeze({
  applications: ['M4 4h6v6H4z', 'M14 4h6v6h-6z', 'M4 14h6v6H4z', 'M14 14h6v6h-6z'],
  bell: ['M6.4 9.5a5.6 5.6 0 0 1 11.2 0c0 6 2.4 6 2.4 8H4c0-2 2.4-2 2.4-8', 'M10 21h4'],
  building: ['M4 21V4h10v17', 'M14 9h6v12', 'M8 8h2', 'M8 12h2', 'M8 16h2', 'M17 13h1', 'M17 17h1'],
  channel: ['M8.5 7.5 5 4 2 7l3.5 3.5', 'm15.5-3 3.5-3.5L22 7l-3.5 3.5', 'M8 17H5a3 3 0 0 1-3-3', 'M16 7h3a3 3 0 0 1 3 3', 'M8 7h8v10H8z'],
  chevron: ['m9 18 6-6-6-6'],
  collapse: ['M4 4h16v16H4z', 'M9 4v16', 'm15 9-3 3 3 3'],
  control: ['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M13 13h7v7h-7z'],
  finance: ['M5 3h14v18H5z', 'M8 7h8', 'M8 11h8', 'M8 15h3', 'M14 15h2', 'M8 18h3', 'M14 18h2'],
  menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
  members: ['M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 'M2 21a7 7 0 0 1 14 0', 'M17 8a3 3 0 0 1 0 6', 'M18 17a5 5 0 0 1 4 4'],
  orders: ['M3 7h11v10H3z', 'M14 10h4l3 3v4h-7z', 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4', 'M18 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4'],
  products: ['m12 2 9 5-9 5-9-5z', 'm3 7 9 5 9-5', 'M3 7v10l9 5 9-5V7', 'M12 12v10'],
  search: ['M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16', 'm21 21-4.35-4.35'],
  support: ['M4 13a8 8 0 0 1 16 0', 'M4 13v5h3v-5', 'M20 13v5h-3v-5', 'M17 20h-5'],
  system: ['M12 2 4 2v5c0 5.1-2.7 8.8-4 10-1.3-1.2-4-4.9-4-10V4z', 'm9 12 2 2 4-4'],
  tasks: ['M5 4h14v16H5z', 'm8 9 2 2 4-4', 'M8 15h8'],
  trend: ['M3 3v18h18', 'm7 16 4-4 4 4 5-6', 'M18 10h2v2'],
  voucher: ['M3 6h18v12H3z', 'M8 6v12', 'M8 10h2', 'M8 14h2'],
});

export function ShellIcon({ name }: Readonly<{ name: ShellIconName }>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
    strokeLinejoin="round" focusable="false" aria-hidden="true">
    {paths[name].map((path) => <path key={path} d={path} />)}
  </svg>;
}
