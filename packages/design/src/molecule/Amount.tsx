import './Molecule.css';

export function Amount({ minor, currency = 'CNY', locale = 'zh-CN', sign = 'auto' }: Readonly<{ minor: number; currency?: string; locale?: string; sign?: 'auto' | 'always' }>) {
  if (!Number.isSafeInteger(minor)) throw new Error('AMOUNT_MINOR_INVALID');
  return <data className="shopamount" value={String(minor)}>{new Intl.NumberFormat(locale, { style: 'currency', currency, signDisplay: sign }).format(minor / 100)}</data>;
}
