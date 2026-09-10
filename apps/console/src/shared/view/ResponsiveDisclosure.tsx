import { useState, type ReactNode, type SyntheticEvent } from 'react';
import { useMediaQuery } from './useMediaQuery';

const desktopQuery = '(min-width: 1024px)';

export function ResponsiveDisclosure({ className, summary, children }: Readonly<{ className: string; summary: ReactNode; children: ReactNode }>) {
  const wide = useMediaQuery(desktopQuery, true);
  const [expanded, setExpanded] = useState(false);
  const open = wide || expanded;
  const toggle = (event: SyntheticEvent<HTMLDetailsElement>) => {
    if (!wide) setExpanded(event.currentTarget.open);
  };
  return (
    <details className={className} open={open} onToggle={toggle}>
      <summary>{summary}</summary>
      {children}
    </details>
  );
}
