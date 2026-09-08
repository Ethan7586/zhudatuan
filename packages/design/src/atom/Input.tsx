import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import './Control.css';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'aria-label'> {
  readonly label: string;
  readonly error?: string;
  readonly hint?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, error, hint, id, className, ...props }, ref) {
  const generated = useId();
  const inputId = id ?? generated;
  const detailId = `${inputId}-detail`;
  return (
    <label className="shopfield" htmlFor={inputId}>
      <span>{label}</span>
      <input {...props} ref={ref} id={inputId} className={['shopinput', className].filter(Boolean).join(' ')} aria-invalid={error === undefined ? undefined : true} aria-describedby={error === undefined && hint === undefined ? undefined : detailId} />
      {error === undefined && hint === undefined ? null : <small id={detailId} role={error === undefined ? undefined : 'alert'}>{error ?? hint}</small>}
    </label>
  );
});
