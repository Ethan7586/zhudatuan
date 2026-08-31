import { createHash } from 'node:crypto';

export interface InvitationRateRule {
  readonly fingerprint: string;
  readonly bucket: string;
  readonly maximum: number;
  readonly windowSeconds: number;
}

const WINDOW_SECONDS = 15 * 60;
const LIMITS = Object.freeze({ code: 12, device: 60, network: 240 });

export class InvitationRatePolicy {
  rules(target: 'console' | 'storefront', fingerprints: Readonly<{ code: string; device: string; network: string }>): readonly InvitationRateRule[] {
    return Object.freeze(
      (Object.keys(LIMITS) as readonly (keyof typeof LIMITS)[]).map((dimension) =>
        Object.freeze({
          fingerprint: fingerprints[dimension],
          bucket: bucket(target, dimension),
          maximum: LIMITS[dimension],
          windowSeconds: WINDOW_SECONDS,
        })
      )
    );
  }
  recipient(target: 'console' | 'storefront', fingerprint: string): InvitationRateRule {
    return Object.freeze({
      fingerprint,
      bucket: bucket(target, 'recipient'),
      maximum: 30,
      windowSeconds: WINDOW_SECONDS,
    });
  }
}

export function invitationRateBuckets(): readonly string[] {
  return Object.freeze((['console', 'storefront'] as const).flatMap((target) => [...(Object.keys(LIMITS) as readonly (keyof typeof LIMITS)[]).map((dimension) => bucket(target, dimension)), bucket(target, 'recipient')]));
}

function bucket(target: string, dimension: string): string {
  return createHash('sha256').update(`invitation:${target}:${dimension}`).digest('hex');
}
