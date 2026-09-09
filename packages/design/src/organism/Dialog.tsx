import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { Dialog as AriaDialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { Button } from '../atom/Button';
import { SectionBoundary } from './SectionBoundary';
import './Dialog.css';

export interface DialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly children: ReactNode;
  readonly onClose: () => void;
  readonly dismissable?: boolean;
  readonly eyebrow?: string;
  readonly description?: ReactNode;
  readonly initialFocus?: RefObject<HTMLElement | null>;
  readonly tone?: 'default' | 'secure';
  readonly icon?: ReactNode;
  readonly closeLabel?: string;
}

export function Dialog({ open, title, children, onClose, dismissable = true, eyebrow, description, initialFocus, tone = 'default', icon, closeLabel = '关闭' }: DialogProps) {
  const descriptionId = useId();
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const active = document.activeElement;
    returnFocus.current = active instanceof HTMLElement && active !== document.body ? active : null;
    const frame = requestAnimationFrame(() => initialFocus?.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      const target = returnFocus.current;
      requestAnimationFrame(() => {
        if (target?.isConnected) target.focus();
      });
    };
  }, [initialFocus, open]);
  return (
    <ModalOverlay
      className={`dialogbackdrop dialogbackdrop${tone}`}
      isDismissable={dismissable}
      isKeyboardDismissDisabled={!dismissable}
      isOpen={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <Modal className={`dialogpanel dialogpanel${tone}`}>
        <AriaDialog className={`dialogcontent dialogcontent${tone}`} {...(description === undefined ? {} : { 'aria-describedby': descriptionId })}>
          {({ close }) => (
            <>
              <header>
                <div>
                  {icon === undefined ? null : (
                    <span className="dialogicon" aria-hidden="true">
                      {icon}
                    </span>
                  )}
                  {eyebrow === undefined ? null : <p>{eyebrow}</p>}
                  <Heading slot="title">{title}</Heading>
                  {description === undefined ? null : (
                    <p id={descriptionId} className="dialogdescription">
                      {description}
                    </p>
                  )}
                </div>
                <Button aria-label={closeLabel} onPress={close} isDisabled={!dismissable}>
                  <span aria-hidden="true">×</span>
                </Button>
              </header>
              <div className="dialogbody">
                <SectionBoundary title={`${title}暂时无法显示`} resetKey={open ? title : 'closed'}>
                  {children}
                </SectionBoundary>
              </div>
            </>
          )}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}
