import type { ReactNode } from 'react';
import { useViewportKind } from '../shared/ui/Viewport';
import { DesktopShell } from './DesktopShell';
import { MobileShell } from './MobileShell';
import { TabletShell } from './TabletShell';

export function ChannelChrome({ children }: { readonly children: ReactNode }) {
  const viewport = useViewportKind();
  if (viewport === 'mobile') return <MobileShell>{children}</MobileShell>;
  if (viewport === 'tablet') return <TabletShell>{children}</TabletShell>;
  return <DesktopShell>{children}</DesktopShell>;
}
