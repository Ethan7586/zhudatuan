import { createHash } from 'node:crypto';
import type { DatabasePool } from '../persistence/Pool';

export interface ActionProofBinding {
  readonly proof: string;
  readonly actor: string;
  readonly session: string;
  readonly membership: string;
  readonly scope: string;
  readonly operation: string;
  readonly resource: string;
  readonly idempotency: string;
  readonly expectedVersion: number | null;
  readonly requestHash: string;
}

export interface ActionProofVerifier {
  validate(proof: string): boolean;
}

export class PgActionProofVerifier implements ActionProofVerifier {
  constructor(_pool?: DatabasePool) {}

  validate(proof: string): boolean {
    return actionProofWellFormed(proof);
  }
}

interface ActionProofDatabase {
  query(text: string, values?: readonly unknown[]): Promise<{ readonly rows: readonly unknown[] }>;
}

/** Must be called with the command transaction client, never the shared pool. */
export async function consumeActionProof(database: ActionProofDatabase, binding: ActionProofBinding): Promise<boolean> {
  if (!actionProofWellFormed(binding.proof) || !/^[0-9a-f]{64}$/.test(binding.requestHash)) return false;
  const tokenHash = createHash('sha256').update(binding.proof).digest('hex');
  const result = await database.query('select access.consume_action_proof($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) consumed', [
    tokenHash,
    binding.actor,
    binding.session,
    binding.membership,
    binding.scope,
    binding.operation,
    binding.resource,
    binding.idempotency,
    binding.expectedVersion,
    binding.requestHash,
  ]);
  const row = result.rows[0];
  return row !== null && typeof row === 'object' && Reflect.get(row, 'consumed') === true;
}

export function actionProofWellFormed(proof: string): boolean {
  return /^[A-Za-z0-9_-]{43,128}$/.test(proof);
}
