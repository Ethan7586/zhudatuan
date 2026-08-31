import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
export interface SessionIssue {
  readonly principal: string;
  readonly membership: string;
  readonly assurance: number;
  readonly target: 'console' | 'storefront';
  readonly device: string;
  readonly peer: string;
  readonly agent: string;
  readonly trace: string;
}
export interface IssuedSession {
  readonly session: string;
  readonly membership: string;
  readonly target: 'console' | 'storefront';
  readonly expiresin: number;
  readonly headers: Readonly<Record<string, string>>;
}
export interface SessionIssuer {
  issue(database: OperationDatabase, value: SessionIssue): Promise<IssuedSession>;
}
