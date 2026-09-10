import type { ReactNode } from 'react';
import { Dialog, Modal, ModalOverlay } from 'react-aria-components';

interface ProductFlowModalProps {
  readonly open: boolean;
  readonly label: string;
  readonly children: ReactNode;
  readonly onClose: () => void;
  readonly dismissable?: boolean;
  readonly className?: string;
}

export function ProductFlowModal({ open, label, children, onClose, dismissable = true, className }: ProductFlowModalProps) {
  return (
    <ModalOverlay
      className="productflowoverlay"
      isDismissable={dismissable}
      isKeyboardDismissDisabled={!dismissable}
      isOpen={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <Modal className="productflowmodal">
        <Dialog className={`productflowdialog${className === undefined ? '' : ` ${className}`}`} aria-label={label}>
          {children}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
