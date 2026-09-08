export function formatMinor(amountMinor: number): string {
  if (!Number.isSafeInteger(amountMinor)) throw new Error('INVALID_MONEY_MINOR');
  return (amountMinor / 100).toFixed(2);
}

export function parseMinor(value: string): number {
  const match = /^(0|[1-9]\d{0,11})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) throw new Error('请输入正确金额，最多保留两位小数');
  const fraction = (match[2] ?? '').padEnd(2, '0');
  const minor = BigInt(match[1]) * 100n + BigInt(fraction || '0');
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('输入金额过大');
  return Number(minor);
}
