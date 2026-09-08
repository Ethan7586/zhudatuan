import type { InputHTMLAttributes, ReactNode } from 'react';
import type { MallOpeningDraft } from '../model/MallDraft';

export function JourneyField({ label, hint, children }: Readonly<{ label: string; hint?: string; children: ReactNode }>) {
  return (
    <label className="malljourneyfield">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function JourneyText({
  label,
  field,
  value,
  onChange,
  hint,
  ...input
}: Readonly<{
  label: string;
  field: keyof MallOpeningDraft;
  value: string;
  onChange: (patch: Partial<MallOpeningDraft>) => void;
  hint?: string;
}> &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <JourneyField label={label} {...(hint ? { hint } : {})}>
      <input aria-label={label} value={value} onChange={(event) => onChange({ [field]: event.target.value })} {...input} />
    </JourneyField>
  );
}

export function JourneySelect<T extends string>({
  label,
  field,
  value,
  options,
  onChange,
  hint,
}: Readonly<{
  label: string;
  field: keyof MallOpeningDraft;
  value: T;
  options: readonly Readonly<{ value: T; label: string }>[];
  onChange: (patch: Partial<MallOpeningDraft>) => void;
  hint?: string;
}>) {
  return (
    <JourneyField label={label} {...(hint ? { hint } : {})}>
      <select aria-label={label} value={value} onChange={(event) => onChange({ [field]: event.target.value })}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </JourneyField>
  );
}
