import './Molecule.css';

export function Progress({ value, max = 100, label, detail }: Readonly<{ value: number; max?: number; label: string; detail?: string }>) {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0 || value < 0 || value > max) throw new Error('PROGRESS_VALUE_INVALID');
  return <div className="shopprogress"><div><span>{label}</span><span>{detail ?? `${Math.round((value / max) * 100)}%`}</span></div><progress value={value} max={max}>{Math.round((value / max) * 100)}%</progress></div>;
}
