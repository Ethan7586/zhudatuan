import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';

export interface SupplierRelationshipVersion {
  readonly id: string;
  readonly relationship: string;
  readonly version: number;
  readonly supplier: string;
  readonly purchasingNode: string;
  readonly realm: string;
  readonly line: string;
  readonly mall: string;
  readonly productScope: Readonly<Record<string, unknown>>;
  readonly effectiveAt: string;
}

export interface SupplierContractVersion {
  readonly id: string;
  readonly contract: string;
  readonly version: number;
  readonly relationshipVersion: string;
  readonly supplyTerms: Readonly<Record<string, unknown>>;
  readonly fulfillmentParty: string;
  readonly settlementParty: string;
  readonly invoiceParty: string;
  readonly effectiveAt: string;
}

export class SupplierRelationshipPort {
  async addRelationshipVersion(database: OperationDatabase, input: SupplierRelationshipVersion): Promise<void> {
    await database.query(`update partner.supplierrelationship set status='superseded',superseded_at=$3::timestamptz
      where relationship_id=$1 and relationship_version=$2::bigint-1 and status='active'`,
    [input.relationship,input.version,input.effectiveAt]);
    await database.query(`insert into partner.supplierrelationship(id,relationship_id,relationship_version,supplier_id,purchasing_node_id,
      realm_id,line_id,mall_id,product_scope,status,effective_at,superseded_at,predecessor_id,created_at)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,'active',$10::timestamptz,null,
        (select id from partner.supplierrelationship where relationship_id=$2 and relationship_version=$3::bigint-1),clock_timestamp())`,
    [input.id,input.relationship,input.version,input.supplier,input.purchasingNode,input.realm,input.line,input.mall,
      JSON.stringify(input.productScope),input.effectiveAt]);
  }

  async addContractVersion(database: OperationDatabase, input: SupplierContractVersion): Promise<void> {
    await database.query(`update partner.suppliercontract set status='superseded',superseded_at=$3::timestamptz
      where contract_id=$1 and contract_version=$2::bigint-1 and status='active'`, [input.contract,input.version,input.effectiveAt]);
    await database.query(`insert into partner.suppliercontract(id,contract_id,contract_version,supplier_relationship_id,supply_terms,
      fulfillment_party_id,settlement_party_id,invoice_party_id,status,effective_at,superseded_at,predecessor_id,created_at)
      values($1,$2,$3,$4,$5::jsonb,$6,$7,$8,'active',$9::timestamptz,null,
        (select id from partner.suppliercontract where contract_id=$2 and contract_version=$3::bigint-1),clock_timestamp())`,
    [input.id,input.contract,input.version,input.relationshipVersion,JSON.stringify(input.supplyTerms),input.fulfillmentParty,
      input.settlementParty,input.invoiceParty,input.effectiveAt]);
  }
}

export const supplierRelationshipPort = new SupplierRelationshipPort();
