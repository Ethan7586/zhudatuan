import { forwardRef, useId, type ReactNode, type SelectHTMLAttributes } from 'react';
import './Control.css';

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'aria-label'> {
  readonly label: string;
  readonly error?: string;
  readonly children: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ label, error, id, className, children, ...props }, ref) {
  const generated = useId();
  const selectId = id ?? generated;
  const errorId = `${selectId}-error`;
  return (
    <label className="shopfield" htmlFor={selectId}>
      <span>{label}</span>
      <select {...props} ref={ref} id={selectId} className={['shopselect', className].filter(Boolean).join(' ')} aria-invalid={error === undefined ? undefined : true} aria-describedby={error === undefined ? undefined : errorId}>{children}</select>
      {error === undefined ? null : <small id={errorId} role="alert">{error}</small>}
    </label>
  );
});
