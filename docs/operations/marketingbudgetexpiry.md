# 营销预算预留过期

`marketingbudgetexpiry` 在报价确认产生的营销预算预留到期时运行。任务按订单幂等释放仍处于 `reserved` 的额度，已支付提交、已释放或已退款记录不会被改写。

处理失败时由 Runtime 使用同一任务 ID 重试；禁止人工直接修改 `marketing.campaign.spent_minor` 或删除 `marketing.redemption`。排障时核对任务 Scope、订单 ID、预留到期时间、活动规则版本和预算版本。

## Trigger, impact and owner

Trigger 是营销预算预留超过报价 TTL；Impact 是活动额度虚占或重复释放。Marketing Owner 主责，Checkout 与 Finance Owner 协同。

## Stop loss and diagnosis

Stop loss 暂停异常 Campaign 的新优惠，不改已支付订单。Diagnosis 核对 Job lease、Scope、订单/Quote、预留、活动规则版本、预算版本、支付状态与时钟。

## Recovery and data repair

Recovery 复用原 Job ID；Data repair 只追加经审计的释放/冲正事实，禁止手改累计金额或删除兑换记录。

## Validation, escalation and audit

Validation 证明额度守恒、已支付预留不释放、重复任务无副作用。Escalation 覆盖预算为负、跨 Scope、重复折扣。Audit 保存 Campaign、Quote/Order、前后额度、Job/Event/Trace。

## Postmortem

资金影响、错误优惠或 SLO 超限必须完成 Postmortem。
