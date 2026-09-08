import type { ReactNode, RefObject } from 'react';
import { Button, type ButtonTone } from '../atom/Button';
import { Dialog } from './Dialog';
import './CommandDialog.css';

export interface CommandDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly description: string;
  readonly object: string;
  readonly impact: ReactNode;
  readonly confirmLabel: string;
  readonly children?: ReactNode;
  readonly busy?: boolean;
  readonly dangerous?: boolean;
  readonly proof?: ReactNode;
  readonly initialFocus?: RefObject<HTMLElement | null>;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
}

export function CommandDialog({ open, title, description, object, impact, confirmLabel, children, busy = false, dangerous = false, proof, initialFocus, onConfirm, onClose }: Readonly<CommandDialogProps>) {
  const tone: ButtonTone = dangerous ? 'danger' : 'primary';
  return (
    <Dialog open={open} title={title} description={description} onClose={onClose} dismissable={!busy} {...(initialFocus === undefined ? {} : { initialFocus })}>
      <dl className="commandimpact"><div><dt>操作对象</dt><dd>{object}</dd></div><div><dt>影响范围</dt><dd>{impact}</dd></div></dl>
      {proof}
      {children}
      <footer className="dialogactions"><Button onPress={onClose} isDisabled={busy}>取消</Button><Button tone={tone} onPress={onConfirm} isPending={busy}>{confirmLabel}</Button></footer>
    </Dialog>
  );
}
