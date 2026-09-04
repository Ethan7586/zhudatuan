import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';

export type AuditQueryReference = Readonly<
  | { kind: 'subject' | 'object'; type?: string; id: string }
  | { kind: 'trace'; id: string }
>;

export interface AuditEvidence {
  readonly id: string;
  readonly kind: 'command' | 'access';
  readonly operation: string;
  readonly subject: Readonly<{ type: string; id: string }>;
  readonly object: Readonly<{ type: string; id: string | null }>;
  readonly actor: Readonly<{ type: string; id: string | null }>;
  readonly request: string;
  readonly outcome: 'succeeded' | 'rejected' | 'failed';
  readonly reason: string;
  readonly beforeHash: string | null;
  readonly afterHash: string | null;
  readonly previousHash: string | null;
  readonly recordHash: string;
  readonly evidence: Readonly<Record<string, unknown>>;
  readonly occurredAt: string;
  readonly trace: string;
}

export interface AuditReadPort {
  records(
    context: ReadTransactionContext,
    query: Readonly<{ scopes: readonly string[]; references: readonly AuditQueryReference[]; limit?: number }>
  ): Promise<readonly AuditEvidence[]>;
}

export const AUDIT_READ_PORT = publicPort<AuditReadPort>('audit', 'read');
