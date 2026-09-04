export type SignalSensitivity = 'public' | 'personal' | 'sensitive';

export interface Signal {
  readonly type: string;
  readonly version: number;
  readonly value: number;
  readonly source: string;
  readonly sensitivity: SignalSensitivity;
  readonly observedAt: string;
}

export interface SignalInput {
  readonly type: string;
  readonly version: number;
  readonly value: unknown;
  readonly source: string;
  readonly sensitivity: SignalSensitivity;
  readonly observedAt: string;
}

/** A signal is an immutable, versioned fact. Its source owns interpretation of the numeric value. */
export function signal(input: SignalInput): Signal {
  if (
    !/^[a-z][a-z0-9.]{1,63}$/.test(input.type) ||
    !Number.isSafeInteger(input.version) ||
    input.version < 1 ||
    typeof input.value !== 'number' ||
    !Number.isFinite(input.value) ||
    !/^[a-z][a-z0-9.:-]{1,127}$/.test(input.source) ||
    !['public', 'personal', 'sensitive'].includes(input.sensitivity) ||
    Number.isNaN(Date.parse(input.observedAt))
  ) {
    throw new Error('RISK_SIGNAL_INVALID');
  }
  return Object.freeze({
    type: input.type,
    version: input.version,
    value: input.value,
    source: input.source,
    sensitivity: input.sensitivity,
    observedAt: new Date(input.observedAt).toISOString(),
  });
}
