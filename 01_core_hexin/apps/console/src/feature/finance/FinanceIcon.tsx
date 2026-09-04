import type { SVGProps } from 'react';

export type FinanceIconName = 'alert' | 'arrowLeft' | 'arrowRight' | 'check' | 'chevron' | 'close' | 'copy' | 'download' | 'filter' | 'info' | 'plus' | 'refresh' | 'search' | 'settings' | 'shield';

export function FinanceIcon({ name, ...props }: Readonly<{ name: FinanceIconName }> & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {path(name)}
    </svg>
  );
}

function path(name: FinanceIconName) {
  switch (name) {
    case 'alert':
      return (
        <>
          <path d="M12 3 2.8 20h18.4L12 3Z" />
          <path d="M12 9v5M12 17h.01" />
        </>
      );
    case 'arrowLeft':
      return (
        <>
          <path d="m15 18-6-6 6-6" />
          <path d="M9 12h10" />
        </>
      );
    case 'arrowRight':
      return (
        <>
          <path d="m9 18 6-6-6-6" />
          <path d="M5 12h10" />
        </>
      );
    case 'check':
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 2.5 2.5L16 9" />
        </>
      );
    case 'chevron':
      return <path d="m8 10 4 4 4-4" />;
    case 'close':
      return (
        <>
          <path d="m6 6 12 12" />
          <path d="m18 6-12 12" />
        </>
      );
    case 'copy':
      return (
        <>
          <rect x="8" y="8" width="11" height="11" rx="2" />
          <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
        </>
      );
    case 'download':
      return (
        <>
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 20h14" />
        </>
      );
    case 'filter':
      return (
        <>
          <path d="M4 6h16" />
          <path d="M7 12h10" />
          <path d="M10 18h4" />
        </>
      );
    case 'info':
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v6M12 7h.01" />
        </>
      );
    case 'plus':
      return (
        <>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </>
      );
    case 'refresh':
      return (
        <>
          <path d="M20 7v5h-5" />
          <path d="M4 17v-5h5" />
          <path d="M6.1 8a7 7 0 0 1 11.7-2L20 8M4 16l2.2 2a7 7 0 0 0 11.7-2" />
        </>
      );
    case 'search':
      return (
        <>
          <circle cx="11" cy="11" r="7" />
          <path d="m16 16 4 4" />
        </>
      );
    case 'settings':
      return (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2.8v2.1M12 19.1v2.1M2.8 12h2.1M19.1 12h2.1M5.5 5.5 7 7M17 17l1.5 1.5M18.5 5.5 17 7M7 17l-1.5 1.5" />
        </>
      );
    case 'shield':
      return (
        <>
          <path d="M12 2 4 5v6c0 5 3 8 8 9 5-1 8-4 8-9V5l-8-3Z" />
          <path d="m9 12 2 2 4-4" />
        </>
      );
  }
}
