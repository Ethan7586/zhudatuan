import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { LinkCase, LinkCaseReason } from '../../domain/model/LinkCase';
export interface LinkCaseRepository {
  create(database: OperationDatabase, provider: string, tenant: string, subjecthash: Buffer, reason: LinkCaseReason, transaction?: string): Promise<LinkCase>;
  enrollment(database: OperationDatabase, organization: string, reference: string, subjecthash: Buffer, candidatePrincipal: string | null): Promise<LinkCase>;
  decide(database: OperationDatabase, value: LinkCase): Promise<void>;
}
