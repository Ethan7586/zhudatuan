import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import type { CatalogQualificationDecision, CatalogQualificationPort, CatalogQualificationSubject } from '../../public/CatalogQualificationPort';

export class PgCatalogQualificationPort implements CatalogQualificationPort {
  constructor(private readonly transactions = new PgTransactionAccess()) {}

  async decisions(context: ReadTransactionContext, scope: string, subjects: readonly CatalogQualificationSubject[]): Promise<readonly CatalogQualificationDecision[]> {
    if (subjects.length === 0) return Object.freeze([]);
    const result = await this.transactions.database(context).query<CatalogQualificationDecision & Record<string, unknown>>(
      `with requested as(
        select input.listing,input.product,input.category,input.partner,input.regions
        from jsonb_to_recordset($2::jsonb) input(listing text,product text,category text,partner text,regions jsonb)
      )
      select requested.listing,coalesce(decision.eligible,true) eligible,coalesce(decision.policy_version,0)::integer "policyVersion"
      from requested left join lateral(
        with relevant as(
          select target.id,target.subject_kind,target.subject_id,target.state,target.effective_at,target.expires_at,target.version,target.updated_at,
            row_number() over(partition by target.subject_kind,target.subject_id order by target.updated_at desc,target.id desc) position
          from qualification.qualificationcase target where target.scope_id=$1 and(
            (target.subject_kind='product' and target.subject_id=requested.product)
            or (target.subject_kind='category' and target.subject_id=requested.category)
            or (target.subject_kind='partner' and target.subject_id=requested.partner)
            or (target.subject_kind='region' and requested.regions?target.subject_id)
            or exists(select 1 from qualification.casescope applicable where applicable.case_id=target.id and(
              (applicable.kind='product' and applicable.target_id=requested.product)
              or (applicable.kind='category' and applicable.target_id=requested.category)
              or (applicable.kind='partner' and applicable.target_id=requested.partner)
              or (applicable.kind='region' and requested.regions?applicable.target_id)))
          )
        ) select bool_and(state='published' and effective_at<=clock_timestamp() and expires_at>clock_timestamp()) eligible,
          max(version)::integer policy_version from relevant where position=1
      ) decision on true order by requested.listing`,
      [scope, JSON.stringify(subjects)]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ listing: row.listing, eligible: row.eligible, policyVersion: Number(row.policyVersion) })));
  }
}
