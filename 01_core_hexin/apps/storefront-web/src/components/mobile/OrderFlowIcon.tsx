import type { SVGProps } from 'react';

export function OrderFlowIcon({ className, ...props }: Readonly<SVGProps<SVGSVGElement>>) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" fill="none" className={className} {...props}>
      <rect x="10" y="3.5" width="16" height="21" rx="4" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeOpacity="0.28" strokeWidth="1.7" />
      <rect x="5" y="6.5" width="18" height="22" rx="4.5" fill="white" stroke="currentColor" strokeWidth="1.9" />
      <path d="M10 12v10" stroke="currentColor" strokeOpacity="0.36" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="10" cy="12" r="2" fill="white" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="17" r="2" fill="white" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="22" r="2" fill="white" stroke="currentColor" strokeWidth="1.5" />
      <path d="M14 12h5M14 17h4M14 22h2.5" stroke="currentColor" strokeOpacity="0.72" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="23.5" cy="24" r="5" fill="currentColor" stroke="white" strokeWidth="1.5" />
      <path d="m21.2 24 1.6 1.6 3-3.2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
