import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';

export async function allocatePaymentToEconomicLegs(
  database: OperationDatabase,
  input: Readonly<{ mall: string; payment: string; order: string; amountMinor: number; currency: string }>,
): Promise<void> {
  await database.query(`with legs as (
      select id,amount_minor from ordering.suborder where order_id=$3 and amount_minor>0
    ), balanced as (
      select count(*)>0 and coalesce(sum(amount_minor),0)=$4::bigint valid from legs
    )
    insert into payment.allocation(mall_id,payment_id,target_type,target_id,amount_minor,currency)
    select $1,$2,'supplier_economic_leg',legs.id,legs.amount_minor,$5 from legs,balanced where balanced.valid
    union all
    select $1,$2,'order',$3,$4,$5 from balanced where not balanced.valid`,
  [input.mall, input.payment, input.order, input.amountMinor, input.currency]);
}
