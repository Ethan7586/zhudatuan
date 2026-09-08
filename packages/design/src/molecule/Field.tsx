import { useId, type ReactNode } from 'react';
import './Molecule.css';

export function Field({ label, hint, error, required, children }: Readonly<{ label: string; hint?: ReactNode; error?: string; required?: boolean; children: ReactNode }>) {
  const detailId = useId();
  return (
    <div className="shopfieldgroup" aria-describedby={hint === undefined && error === undefined ? undefined : detailId} data-invalid={error === undefined ? undefined : true}>
      <span>{label}{required ? <span aria-hidden="true"> *</span> : null}</span>
      {children}
      {hint === undefined && error === undefined ? null : <small id={detailId} role={error === undefined ? undefined : 'alert'}>{error ?? hint}</small>}
    </div>
  );
}
