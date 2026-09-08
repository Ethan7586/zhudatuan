export type AuditOutcome = 'succeeded' | 'rejected' | 'failed';

export interface AuditReference {
  readonly type: string;
  readonly id: string | null;
}

export interface AuditWriteInput {
  readonly actor: string;
  readonly actorType: string;
  readonly scope: string;
  readonly request: string;
  readonly operation: string;
  readonly subject: AuditReference;
  readonly object: AuditReference;
  readonly outcome: AuditOutcome;
  readonly reason: string;
  readonly before: unknown;
  readonly after: unknown;
  readonly evidence: unknown;
  readonly trace: string;
}

export interface AuditAccessInput {
  readonly actor: string;
  readonly actorType: string;
  readonly scope: string;
  readonly request: string;
  readonly operation: string;
  readonly subject: AuditReference;
  readonly object: AuditReference;
  readonly outcome: AuditOutcome;
  readonly reason: string;
  readonly fields: unknown;
  readonly trace: string;
}
