import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from './Button';

export function Drawer({ open, title, children, onClose }: Readonly<{ open: boolean; title: string; children: ReactNode; onClose: () => void }>) {
  const panel = useRef<HTMLElement>(null);
  const titleid = useId();
  useEffect(() => {
    if (!open) return undefined;
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    const frame = requestAnimationFrame(() => panel.current?.focus());
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', escape);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', escape); active?.focus(); };
  }, [onClose, open]);
  if (!open) return null;
  return <div className="drawerbackdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><aside ref={panel} tabIndex={-1} className="drawerpanel" role="dialog" aria-modal="true" aria-labelledby={titleid}><header><h2 id={titleid}>{title}</h2><Button aria-label="关闭" onPress={onClose}>×</Button></header><div className="drawerbody">{children}</div></aside></div>;
}
