# AU-681｜Purchase Partner Agreement Read ACL

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260911163000_allow_purchase_partner_agreement_read.sql`（6 行）。
- 审阅方式：深入审阅。文件很短且为窄授权，但它是 Purchase API quote 路径的启动兼容性断言所要求的 relation；反向核对 QuoteReader、PurchaseApiRuntime readiness 和 partner.agreement 的 RLS registration，未重复审读供应链写模型。

## 审计结论

- **G0：保留。** `partner.agreement` 是 checkout quote 对 product owner 的有效协议/合同事实回退路径；Purchase runtime readiness 也显式断言该 role 的 schema/table privilege。
- [FACT][E-AU-681-001] QuoteReader 对 cart item 以 Mall、active/effective window 查询 `partner.agreement`，并将 agreement id、contract ref/hash和 fulfillment/settlement/invoice capabilities 纳入 quote line。
- [FACT][E-AU-681-002] partner 初始 migration 对全 schema relation 启用 RLS；全 migration 集没有为 `zhudatuanpurchaseapi` 在 `partner.agreement` 上建立 SELECT policy。当前 grant 只能通过 table-ACL readiness，不能满足 RLS。
- **F-0279：P2。** 购买 quote 运行 role 对协议事实的访问未闭环，导致 fallback agreement 被 RLS 隐藏，可能将原本可购买的 owner product 判为无可用供应/合同事实；现有 readiness test 只断言 table grant，未执行实际 RLS 查询。

## 未验证项

- 未在隔离数据库以真实 purchase connection role 执行 quote；需确认该 role 是否通过未见 wrapper/role switch 获得 RLS 例外。

## 结论等级

- 新增问题：F-0279（P2，高置信度，需要独立复核）。无 P0。
- 垃圾代码：G0 1 项（Purchase partner agreement read ACL）；不新增 G1/G2/G3/GX。
- 二次复核：是。
