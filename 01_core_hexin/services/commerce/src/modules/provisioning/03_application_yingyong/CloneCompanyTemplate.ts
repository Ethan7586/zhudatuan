import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';

/** Internal application input. Batch 15 will replace this with the canonical public contract. */
export interface CloneCompanyTemplateInput {
  readonly idempotencyKey: string;
  readonly sourceRealmId: string;
  readonly sourceMembershipId: string;
  readonly companyName: string;
  readonly mallName: string;
  readonly requestedBy: string;
  readonly traceId: string;
}

export interface CompanyTemplateClone {
  readonly cloneId: string;
  readonly businessNumber: string;
  readonly sourceRealmId: string;
  readonly sourceMallId: string;
  readonly sourceLineId: string;
  readonly sourceNodeId: string;
  readonly targetRealmId: string;
  readonly targetMallId: string;
  readonly targetOperatingEntityId: string;
  readonly targetLineId: string;
  readonly targetNodeId: string;
  readonly targetMembershipId: string;
  readonly targetApplicationId: string;
  readonly targetPoolId: string;
  readonly hostSovereignNodeId: string;
  readonly status: 'pending_bindings';
  readonly infrastructureActionCount: 0;
  readonly createdAt: string;
  readonly replayed: boolean;
}

interface CloneRow {
  readonly clone_id: string;
  readonly business_number: string;
  readonly source_realm_id: string;
  readonly source_mall_id: string;
  readonly source_line_id: string;
  readonly source_node_id: string;
  readonly target_realm_id: string;
  readonly target_mall_id: string;
  readonly target_operating_entity_id: string;
  readonly target_line_id: string;
  readonly target_node_id: string;
  readonly target_membership_id: string;
  readonly target_application_id: string;
  readonly target_pool_id: string;
  readonly host_sovereign_node_id: string;
  readonly status: 'pending_bindings';
  readonly infrastructure_action_count: 0;
  readonly created_at: string;
  readonly replayed: boolean;
}

export class CloneCompanyTemplate {
  async execute(database: OperationDatabase, input: CloneCompanyTemplateInput): Promise<CompanyTemplateClone> {
    const result = await database.query<CloneRow>('select * from organization.clone_company_template($1::jsonb)', [
      JSON.stringify({
        idempotency_key: input.idempotencyKey,
        source_realm_id: input.sourceRealmId,
        source_membership_id: input.sourceMembershipId,
        company_name: input.companyName,
        mall_name: input.mallName,
        requested_by: input.requestedBy,
        trace_id: input.traceId,
      }),
    ]);
    const row = result.rows[0];
    if (!row) throw new Error('SFL_COMPANY_TEMPLATE_CLONE_FAILED');
    return Object.freeze({
      cloneId: row.clone_id,
      businessNumber: row.business_number,
      sourceRealmId: row.source_realm_id,
      sourceMallId: row.source_mall_id,
      sourceLineId: row.source_line_id,
      sourceNodeId: row.source_node_id,
      targetRealmId: row.target_realm_id,
      targetMallId: row.target_mall_id,
      targetOperatingEntityId: row.target_operating_entity_id,
      targetLineId: row.target_line_id,
      targetNodeId: row.target_node_id,
      targetMembershipId: row.target_membership_id,
      targetApplicationId: row.target_application_id,
      targetPoolId: row.target_pool_id,
      hostSovereignNodeId: row.host_sovereign_node_id,
      status: row.status,
      infrastructureActionCount: row.infrastructure_action_count,
      createdAt: row.created_at,
      replayed: row.replayed,
    });
  }
}
