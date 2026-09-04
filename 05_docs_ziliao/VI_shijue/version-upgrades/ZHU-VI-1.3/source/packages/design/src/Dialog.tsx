import type { ReactNode } from 'react';
import { Dialog as AriaDialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { Button } from './Button';

export interface DialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly children: ReactNode;
  readonly onClose: () => void;
  readonly dismissable?: boolean;
  readonly eyebrow?: string;
}

export function Dialog({ open, title, children, onClose, dismissable = true, eyebrow }: DialogProps) {
  return (
    <ModalOverlay
      className="dialogbackdrop"
      isDismissable={dismissable}
      isKeyboardDismissDisabled={!dismissable}
      isOpen={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <Modal className="dialogpanel">
        <AriaDialog className="dialogcontent">
          {({ close }) => (
            <>
              <header>
                <div>
                  {eyebrow === undefined ? null : <p>{eyebrow}</p>}
                  <Heading slot="title">{title}</Heading>
                </div>
                <Button aria-label="关闭" onPress={close}>
                  <span aria-hidden="true">×</span>
                </Button>
              </header>
              <div className="dialogbody">{children}</div>
            </>
          )}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}
