# AU-732｜履约 Mall 身份数据库合同

- 审阅范围：`fulfillment_mall_identity_contract.sql`。
- 审阅方式：深入审阅 fulfillment order/line/milestone/return 的 Mall 复合键、资源 scope 解析、跨 Mall 外键拒绝与同 provider 外部引用隔离；未运行 SQL。

## 审计结论

- **G0：保留。** 这是迁移 `20260901221000_add_fulfillment_mall_identity.sql` 的可执行跨 Mall 隔离规格，同时与 FulfillmentPort/Tracking worker 的 mall scoped 查询相对应。
- 测试明确证明跨 Mall `fulfillment.line` 写入应受 composite FK 拒绝，资源 scope 由 fulfillment/return 的 Mall 直接决定，而相同 provider/external reference 可安全存在于不同商城；不应删除。
- 未发现新增问题；未验证当前 migration head 上的实际执行。
