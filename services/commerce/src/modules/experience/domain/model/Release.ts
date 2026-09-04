import { DomainError } from '../../../../foundation/domain/DomainError';

export type ReleaseState = 'scheduled' | 'active' | 'retired' | 'failed';
export interface ReleaseSnapshot {
  readonly id: string;
  readonly application: string;
  readonly version: string;
  readonly pool: string;
  readonly state: ReleaseState;
  readonly effectiveAt: string;
  readonly retiredAt: string | null;
  readonly failedAt: string | null;
  readonly failureCode: string | null;
  readonly actor: string;
}

export class Release {
  private constructor(private readonly value: ReleaseSnapshot) {
    validate(value);
    Object.freeze(this);
  }
  static schedule(input: Omit<ReleaseSnapshot, 'state' | 'retiredAt' | 'failedAt' | 'failureCode'>): Release {
    return new Release(freeze({ ...input, state: 'scheduled', retiredAt: null, failedAt: null, failureCode: null }));
  }
  static restore(value: ReleaseSnapshot): Release {
    return new Release(freeze(value));
  }
  activate(): Release {
    if (this.value.state === 'active') return this;
    if (!['scheduled', 'failed'].includes(this.value.state)) invalid('transition');
    return new Release(freeze({ ...this.value, state: 'active', retiredAt: null, failedAt: null, failureCode: null }));
  }
  retire(at: string): Release {
    if (this.value.state === 'retired') return this;
    return new Release(freeze({ ...this.value, state: 'retired', retiredAt: iso(at), failedAt: null, failureCode: null }));
  }
  fail(code: string, at: string): Release {
    if (!['scheduled', 'failed'].includes(this.value.state) || !/^[A-Z][A-Z0-9_]{2,127}$/.test(code)) invalid('failure');
    return new Release(freeze({ ...this.value, state: 'failed', failedAt: iso(at), failureCode: code, retiredAt: null }));
  }
  snapshot(): ReleaseSnapshot {
    return this.value;
  }
}
function validate(value: ReleaseSnapshot): void {
  if (!/^release:/.test(value.id) || !/^application:/.test(value.application) || !value.version || !value.pool || !value.actor) invalid('release');
  if (value.state === 'failed' ? !value.failedAt || !value.failureCode : value.failedAt !== null || value.failureCode !== null) invalid('failure');
  if (value.state === 'retired' ? !value.retiredAt : value.retiredAt !== null) invalid('retiredAt');
}
function freeze(value: ReleaseSnapshot): ReleaseSnapshot {
  return Object.freeze({ ...value, effectiveAt: iso(value.effectiveAt), retiredAt: value.retiredAt === null ? null : iso(value.retiredAt), failedAt: value.failedAt === null ? null : iso(value.failedAt) });
}
function iso(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) invalid('time');
  return parsed.toISOString();
}
function invalid(field: string): never {
  throw new DomainError('VALIDATION_FAILED', { field });
}
