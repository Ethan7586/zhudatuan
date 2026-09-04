import { createHash } from 'node:crypto';

export type RiskOutcome = 'allow' | 'challenge' | 'review' | 'deny';

export interface RiskRule {
  readonly blockedActors: readonly string[];
  readonly denyOperations: readonly string[];
  readonly reviewOperations: readonly string[];
  readonly challengeOperations: readonly string[];
  readonly maximumAmountMinor: number | null;
  readonly reviewAmountMinor: number | null;
  readonly velocity: Readonly<{ windowSeconds: number; maximum: number; outcome: Exclude<RiskOutcome, 'allow'> }> | null;
  readonly scores: readonly Readonly<{ signal: string; minimum: number; points: number }>[];
  readonly thresholds: Readonly<{ challenge: number; review: number; deny: number }>;
}

export class RiskPolicy {
  readonly rule: RiskRule;
  readonly hash: string;

  constructor(
    readonly id: string,
    readonly version: number,
    value: unknown,
    readonly rolloutPercent: number
  ) {
    if (!id || !Number.isSafeInteger(version) || version < 1 || !Number.isSafeInteger(rolloutPercent) || rolloutPercent < 0 || rolloutPercent > 100) {
      throw new Error('RISK_POLICY_IDENTITY_INVALID');
    }
    this.rule = parseRule(value);
    this.hash = createHash('sha256').update(canonical(this.rule)).digest('hex');
    Object.freeze(this);
  }

  selected(actor: string): boolean {
    if (this.rolloutPercent === 100) return true;
    if (this.rolloutPercent === 0) return false;
    const bucket = Number.parseInt(createHash('sha256').update(`${this.id}:${this.version}:${actor}`).digest('hex').slice(0, 8), 16) % 100;
    return bucket < this.rolloutPercent;
  }

  complex(maximumScoreRules: number): boolean {
    if (!Number.isSafeInteger(maximumScoreRules) || maximumScoreRules < 1) throw new Error('RISK_POLICY_COMPLEXITY_LIMIT_INVALID');
    return this.rule.scores.length > maximumScoreRules;
  }
}

function parseRule(value: unknown): RiskRule {
  const source = record(value, 'RISK_POLICY_RULE_INVALID');
  keys(source, ['blockedActors', 'denyOperations', 'reviewOperations', 'challengeOperations', 'maximumAmountMinor', 'reviewAmountMinor', 'velocity', 'scores', 'thresholds']);
  const velocity = source.velocity === undefined ? null : velocityRule(source.velocity);
  const thresholds = thresholdsRule(source.thresholds);
  return Object.freeze({
    blockedActors: strings(source.blockedActors),
    denyOperations: strings(source.denyOperations),
    reviewOperations: strings(source.reviewOperations),
    challengeOperations: strings(source.challengeOperations),
    maximumAmountMinor: optionalInteger(source.maximumAmountMinor),
    reviewAmountMinor: optionalInteger(source.reviewAmountMinor),
    velocity,
    scores: scoresRule(source.scores),
    thresholds,
  });
}

function velocityRule(value: unknown): RiskRule['velocity'] {
  const item = record(value, 'RISK_POLICY_VELOCITY_INVALID');
  keys(item, ['windowSeconds', 'maximum', 'outcome']);
  const outcome = item.outcome;
  if (outcome !== 'challenge' && outcome !== 'review' && outcome !== 'deny') throw new Error('RISK_POLICY_VELOCITY_OUTCOME_INVALID');
  return Object.freeze({ windowSeconds: bounded(item.windowSeconds, 60, 86_400), maximum: bounded(item.maximum, 1, 100_000), outcome });
}

function scoresRule(value: unknown): RiskRule['scores'] {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > 100) throw new Error('RISK_POLICY_SCORES_INVALID');
  return Object.freeze(
    value.map((candidate) => {
      const item = record(candidate, 'RISK_POLICY_SCORE_INVALID');
      keys(item, ['signal', 'minimum', 'points']);
      if (typeof item.signal !== 'string' || !/^[a-z][a-z0-9.]{1,63}$/.test(item.signal)) throw new Error('RISK_POLICY_SCORE_SIGNAL_INVALID');
      return Object.freeze({ signal: item.signal, minimum: bounded(item.minimum, 0, 1_000_000), points: bounded(item.points, 1, 10_000) });
    })
  );
}

function thresholdsRule(value: unknown): RiskRule['thresholds'] {
  if (value === undefined) return Object.freeze({ challenge: 100, review: 200, deny: 300 });
  const item = record(value, 'RISK_POLICY_THRESHOLDS_INVALID');
  keys(item, ['challenge', 'review', 'deny']);
  const challenge = bounded(item.challenge, 1, 1_000_000);
  const review = bounded(item.review, challenge, 1_000_000);
  const deny = bounded(item.deny, review, 1_000_000);
  return Object.freeze({ challenge, review, deny });
}

function strings(value: unknown): readonly string[] {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > 1000 || value.some((item) => typeof item !== 'string' || !item || item.length > 255)) {
    throw new Error('RISK_POLICY_LIST_INVALID');
  }
  return Object.freeze([...new Set(value as string[])]);
}
function optionalInteger(value: unknown): number | null {
  return value === undefined || value === null ? null : bounded(value, 0, Number.MAX_SAFE_INTEGER);
}
function bounded(value: unknown, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) throw new Error('RISK_POLICY_NUMBER_INVALID');
  return value as number;
}
function record(value: unknown, code: string): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as Readonly<Record<string, unknown>>;
}
function keys(value: Readonly<Record<string, unknown>>, allowed: readonly string[]): void {
  if (Object.keys(value).some((key) => !allowed.includes(key))) throw new Error('RISK_POLICY_FIELD_UNKNOWN');
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
