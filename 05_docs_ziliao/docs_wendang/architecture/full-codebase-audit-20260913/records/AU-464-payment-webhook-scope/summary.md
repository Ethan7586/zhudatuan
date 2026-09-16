# AU-464｜支付 Webhook 的 scope resolver 演进

- 主审 `20260821057000_resolve_payment_webhook_scope.sql`（34 行），并人工反查 PaymentWebhook 与后续 payment mall identity 迁移；未执行回调、迁移或线上查询。
- 初始 resolver 依据 payment/refund provider reference 反查订单 scope，并撤销公共/匿名/认证/service-role 执行权，仅授予应用身份。
- 当前实现已由后续三参数 `payment.webhook_scope(kind, reference, application_hash)` 替代；Webhook 同时核验 attempt 的支付场景和应用哈希。原迁移仍是固定 schema 演进与恢复所需 ledger。
- **GX-0023**：资金回调隔离历史迁移，禁止删除、改写或单独重放。未发现新增 P0–P3；未验证真实渠道回调、函数权限和升级/恢复演练。
