export interface FocusReturn {
  restore(): void;
}

export function captureFocus(documentRoot: Document = document): FocusReturn {
  const target = documentRoot.activeElement instanceof HTMLElement ? documentRoot.activeElement : null;
  return Object.freeze({
    restore() {
      if (target?.isConnected) target.focus();
    },
  });
}

export function focusFirst(container: HTMLElement): boolean {
  const target = container.querySelector<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
  target?.focus();
  return target !== null;
}
