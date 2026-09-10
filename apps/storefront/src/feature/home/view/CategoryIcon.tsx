import { BriefcaseBusiness, Building2, Gift, HeartPulse, House, Laptop, ShoppingBag, Utensils } from 'lucide-react';

const ICONS = Object.freeze([Building2, House, Gift, ShoppingBag, HeartPulse, Laptop, Utensils, BriefcaseBusiness]);
const TONES = Object.freeze(['bg-brand-light text-brand', 'bg-success-surface text-success-strong', 'bg-warning-surface text-warning-strong', 'bg-danger-surface text-danger-strong']);

export function CategoryIcon({ index, compact = false }: Readonly<{ index: number; compact?: boolean }>) {
  const Icon = ICONS[index % ICONS.length]!;
  return (
    <span className={`grid shrink-0 place-items-center rounded-xl ${compact ? 'h-9 w-9' : 'h-10 w-10'} ${TONES[index % TONES.length]}`}>
      <Icon size={compact ? 17 : 19} aria-hidden="true" />
    </span>
  );
}
