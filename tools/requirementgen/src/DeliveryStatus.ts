import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';

import { readRequirementReleaseEvidence } from './ReleaseEvidence';

export const DELIVERY_STATUSES = Object.freeze(['Designed', 'Implemented', 'Integrated', 'Verified', 'Released'] as const);
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export interface DeliveryEvidence {
  readonly status: DeliveryStatus;
  readonly evidence: readonly string[];
}

export async function deriveDeliveryStatus(root: string, requirement: string, codeEvidence: readonly string[], releaseEvidence?: string): Promise<DeliveryEvidence> {
  const expected = [...new Set(codeEvidence)].sort();
  const existing = (await Promise.all(expected.map(async (path) => ((await nonempty(resolve(root, path))) ? path : null)))).filter((path): path is string => path !== null);
  if (releaseEvidence && (await readRequirementReleaseEvidence(root, releaseEvidence, requirement))) {
    return Object.freeze({ status: 'Released', evidence: Object.freeze([...existing, releaseEvidence]) });
  }
  if (existing.length === expected.length && expected.length > 0) return Object.freeze({ status: 'Implemented', evidence: Object.freeze(existing) });
  return Object.freeze({ status: 'Designed', evidence: Object.freeze(existing) });
}

async function nonempty(path: string): Promise<boolean> {
  return stat(path)
    .then((value) => (value.isFile() ? value.size > 0 : value.isDirectory()))
    .catch(() => false);
}
