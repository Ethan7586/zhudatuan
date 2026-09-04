export interface Signal {
  readonly type: string;
  readonly value: number;
  readonly observedAt: string;
}

export function signal(type: string, value: unknown, observedAt: string): Signal {
  if (!/^[a-z][a-z0-9.]{1,63}$/.test(type) || typeof value !== 'number' || !Number.isFinite(value) || Number.isNaN(Date.parse(observedAt))) {
    throw new Error('RISK_SIGNAL_INVALID');
  }
  return Object.freeze({ type, value, observedAt });
}
