export type ProductIconName =
  | 'archive'
  | 'arrowLeft'
  | 'arrowRight'
  | 'check'
  | 'chevron'
  | 'close'
  | 'copy'
  | 'cube'
  | 'download'
  | 'edit'
  | 'eye'
  | 'filter'
  | 'inventory'
  | 'more'
  | 'plus'
  | 'price'
  | 'search'
  | 'settings'
  | 'store'
  | 'upload'
  | 'warning';

const paths: Readonly<Record<ProductIconName, readonly string[]>> = Object.freeze({
  archive: ['M5 4h14v4H5z', 'M6 8v12h12V8', 'M9 12h6'],
  arrowLeft: ['m15 18-6-6 6-6'],
  arrowRight: ['m9 18 6-6-6-6'],
  check: ['m5 12 4 4L19 6'],
  chevron: ['m9 10 3 3 3-3'],
  close: ['M6 6l12 12', 'M18 6 6 18'],
  copy: ['M9 9h11v11H9z', 'M4 15V4h11'],
  cube: ['m12 2 9 5-9 5-9-5z', 'm3 7 9 5 9-5', 'M3 7v10l9 5 9-5V7', 'M12 12v10'],
  download: ['M12 3v12', 'm7 10 5 5 5-5', 'M4 20h16'],
  edit: ['M4 20h4L19 9l-4-4L4 16z', 'm13-13 4 4'],
  eye: ['M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6'],
  filter: ['M4 6h16', 'M7 12h10', 'M10 18h4'],
  inventory: ['M4 7h16v13H4z', 'M7 4h10v3', 'M8 11h8'],
  more: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
  plus: ['M12 5v14', 'M5 12h14'],
  price: ['M20 13 13 20 4 11V4h7z', 'M8 8h.01'],
  search: ['M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16', 'm21 21-4.35-4.35'],
  settings: ['M4 7h10', 'M18 7h2', 'M4 17h2', 'M10 17h10', 'M14 4v6', 'M8 14v6'],
  store: ['M4 10v10h16V10', 'M3 10l2-6h14l2 6', 'M8 20v-6h8v6'],
  upload: ['M12 21V9', 'm7 14 5-5 5 5', 'M4 4h16'],
  warning: ['M12 3 2 21h20z', 'M12 9v5', 'M12 18h.01'],
});

export function ProductIcon({ name }: Readonly<{ name: ProductIconName }>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" focusable="false" aria-hidden="true">
      {paths[name].map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}
