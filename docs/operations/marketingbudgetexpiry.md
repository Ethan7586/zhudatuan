# 营销预算预留过期

`marketingbudgetexpiry` 在报价确认产生的营销预算预留到期时运行。任务按订单幂等释放仍处于 `reserved` 的额度，已支付提交、已释放或已退款记录不会被改写。

处理失败时由 Runtime 使用同一任务 ID 重试；禁止人工直接修改 `marketing.campaign.spent_minor` 或删除 `marketing.redemption`。排障时核对任务 Scope、订单 ID、预留到期时间、活动规则版本和预算版本。
