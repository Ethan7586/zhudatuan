import { isValidElement } from 'react';
import { ModalOverlay } from 'react-aria-components';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';

describe('Dialog', () => {
  it('delegates controlled modal, dismissal and focus behavior to React Aria', () => {
    const onClose = vi.fn();
    const result = Dialog({ open: true, title: '确认操作', children: '内容', onClose });
    expect(isValidElement(result)).toBe(true);
    if (!isValidElement<{ isOpen: boolean; isDismissable: boolean; onOpenChange: (open: boolean) => void }>(result)) {
      throw new Error('DIALOG_OVERLAY_REQUIRED');
    }
    expect(result.type).toBe(ModalOverlay);
    expect(result.props.isOpen).toBe(true);
    expect(result.props.isDismissable).toBe(true);
    result.props.onOpenChange(false);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
