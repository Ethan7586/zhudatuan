export function cakeuncleMinor(value: string, code: string): number {
  if (!/^(0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) throw new Error(code);
  const [major, fraction = ''] = value.split('.');
  const amount = Number(major) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(amount)) throw new Error(code);
  return amount;
}

export function cakeuncleNonnegativeInteger(value: string, code: string): number {
  if (!/^(0|[1-9]\d*)$/.test(value)) throw new Error(code);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(code);
  return parsed;
}
