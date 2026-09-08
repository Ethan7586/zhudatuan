import { Select } from '../atom/Select';
import './Molecule.css';

export interface StatusOption {
  readonly value: string;
  readonly label: string;
}

export function StatusSelect({ value, options, onChange, disabled, label = '状态' }: Readonly<{ value: string; options: readonly StatusOption[]; onChange: (value: string) => void; disabled?: boolean; label?: string }>) {
  return <Select label={label} value={value} disabled={disabled} onChange={(event) => onChange(event.currentTarget.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select>;
}
