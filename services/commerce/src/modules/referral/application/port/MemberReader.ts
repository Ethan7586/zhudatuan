import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';

export interface MemberReader {
  eligible(database: OperationDatabase, scopeId: string, membershipId: string): Promise<Readonly<{ memberId: string; scopeId: string; version: number }> | null>;
}
