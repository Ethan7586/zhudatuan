import type { QueryResult } from 'pg';
import type { Transaction } from '../../../../foundation/persistence/UnitOfWork';

export class PgCommissionRepository {
  constructor(private readonly transaction: Transaction) {}

  read(scopeId: string, beneficiaryId: string | null, cursor: string | null, limit: number): Promise<QueryResult> {
    return this.transaction.query(
      `select id,order_id "orderId",beneficiary_id "promoterId",state status,amount_minor "amountMinor",currency,
      eligible_at "availableAt",version from referral.commission
      where scope_id=$1 and ($2::text is null or beneficiary_id=$2) and ($3::text is null or id>$3) order by id limit $4`,
      [scopeId, beneficiaryId, cursor, limit]
    );
  }

  earnings(scopeId: string, beneficiaryId: string): Promise<QueryResult> {
    return this.transaction.query(
      `select coalesce(sum(amount_minor-reversed_minor) filter(where state='available'),0) "availableMinor",
      coalesce(sum(amount_minor-reversed_minor) filter(where state='pending'),0) "pendingMinor",
      coalesce(sum(amount_minor-reversed_minor) filter(where state='settled'),0) "settledMinor",
      coalesce(sum(reversed_minor),0) "reversedMinor",coalesce(min(currency),'CNY') currency,
      coalesce(max(version),1) version,coalesce(jsonb_agg(jsonb_build_object('id',id,'orderId',order_id,'promoterId',beneficiary_id,
      'status',state,'amountMinor',amount_minor,'currency',currency,'availableAt',eligible_at,'version',version) order by id),'[]') items
      from referral.commission where scope_id=$1 and beneficiary_id=$2`,
      [scopeId, beneficiaryId]
    );
  }

  createFromSnapshot(
    input: Readonly<{ eventId: string; scopeId: string; orderId: string; beneficiaryId: string; productId: string; lineId: string; amountMinor: number; rateBasisPoints: number; currency: string; availableAt: string }>
  ): Promise<number> {
    const businessKey = `commission:${input.orderId}:${input.lineId}:${input.beneficiaryId}`;
    return this.transaction
      .query(
        `insert into referral.commission(id,business_key,scope_id,order_id,order_line_id,product_id,beneficiary_id,amount_minor,
        rate_basis_points,currency,reversed_minor,state,origin_event_id,eligible_at,version,created_at,updated_at)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,'pending',$11,$12,1,clock_timestamp(),clock_timestamp()) on conflict(business_key) do nothing`,
        [`referralcommission:${businessKey}`, businessKey, input.scopeId, input.orderId, input.lineId, input.productId, input.beneficiaryId, input.amountMinor, input.rateBasisPoints, input.currency, input.eventId, input.availableAt]
      )
      .then((result) => result.rowCount ?? 0);
  }

  reverse(input: Readonly<{ eventId: string; scopeId: string; commissionId: string; refundId: string; amountMinor: number; reason: string }>): Promise<number> {
    const movementKey = `reverse:${input.refundId}:${input.commissionId}`;
    return this.transaction
      .query(
        `with movement as (
          insert into referral.commissionmovement(id,movement_key,scope_id,commission_id,refund_id,direction,amount_minor,reason,event_id,created_at)
          select $1,$2,$3,target.id,$4,'debit',$5,$6,$7,clock_timestamp() from referral.commission target
          where target.id=$8 and target.scope_id=$3 and target.reversed_minor+$5<=target.amount_minor
          on conflict(movement_key) do nothing returning commission_id,amount_minor
        ) update referral.commission target set reversed_minor=target.reversed_minor+movement.amount_minor,
        state=case when target.reversed_minor+movement.amount_minor=target.amount_minor then 'reversed' else target.state end,
        version=target.version+1,updated_at=clock_timestamp() from movement where target.id=movement.commission_id`,
        [`commissionmovement:${movementKey}`, movementKey, input.scopeId, input.refundId, input.amountMinor, input.reason, input.eventId, input.commissionId]
      )
      .then((result) => result.rowCount ?? 0);
  }

  settleDue(scopeId: string, now: string, limit: number): Promise<QueryResult> {
    return this.transaction.query(
      `with target as (select id from referral.commission where scope_id=$1 and state='available' and eligible_at<=$2
      order by eligible_at,id for update skip locked limit $3)
      update referral.commission commission set state='settled',settled_at=$2,version=version+1,updated_at=clock_timestamp()
      from target where commission.id=target.id returning commission.*`,
      [scopeId, now, limit]
    );
  }
}
