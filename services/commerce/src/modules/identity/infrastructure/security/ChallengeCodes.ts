import { randomInt } from 'node:crypto';
import type { ChallengeCode, ChallengePurpose } from '../../application/port/ChallengeCode';

export class RandomChallengeCode implements ChallengeCode {
  issue(_purpose: ChallengePurpose): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }
}

export class FixedChallengeCode implements ChallengeCode {
  private readonly code: string;

  constructor(value: string) {
    const code = value.trim();
    if (!/^\d{6}$/.test(code)) throw new Error('IDENTITY_CHALLENGE_CODE_INVALID');
    this.code = code;
    Object.freeze(this);
  }

  issue(_purpose: ChallengePurpose): string {
    return this.code;
  }
}
