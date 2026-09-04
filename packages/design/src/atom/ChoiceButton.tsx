import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { ButtonTone } from './Button';
import './Button.css';

export type ChoiceKind = 'tab' | 'radio';

export interface ChoiceButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-checked' | 'aria-selected' | 'children' | 'className' | 'disabled' | 'onClick' | 'role' | 'tabIndex' | 'type'> {
  readonly children: ReactNode;
  readonly className?: string;
  readonly kind: ChoiceKind;
  readonly selected: boolean;
  readonly disabled?: boolean;
  readonly tone?: ButtonTone;
  readonly onChoose: () => void;
}

export const ChoiceButton = forwardRef<HTMLButtonElement, ChoiceButtonProps>(function ChoiceButton(
  { children, className, kind, selected, disabled = false, tone = 'default', onChoose, ...props },
  ref
) {
  const classes = ['shopbutton', `shopbutton${tone}`, className].filter(Boolean).join(' ');
  return (
    <button
      {...props}
      ref={ref}
      type="button"
      role={kind}
      aria-selected={kind === 'tab' ? selected : undefined}
      aria-checked={kind === 'radio' ? selected : undefined}
      tabIndex={selected ? 0 : -1}
      disabled={disabled}
      className={classes}
      onClick={onChoose}
    >
      {children}
    </button>
  );
});
