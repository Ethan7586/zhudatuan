# AU-571｜Storefront Compatibility 售后、账本与登录失败迁移

- 审阅范围：`02_platform_pingtai/database/storefront-compatibility/supabase/migrations/20260724113000_after_sales_and_ledgers.sql`（278 行）。
- 审阅方式：逐段人工审阅账本/售后 RPC、订单状态转换、登录失败累计器和 privilege；定向比对 Commerce API caller、后续登录阈值迁移、Canonical 同名 migration。未执行数据库 replay。

## 审计结论

- **G0**：该迁移定义仍在业务调用链中的服务端 RPC 和其演进历史，不能删除。
- [FACT][E-AU-571-001] `api_account_ledgers` 与 `api_after_sales` 均按 tenant/enterprise/mall/user 对账本或售后记录做范围过滤；`api_create_after_sale` 先锁定用户自身订单，验证状态/金额/未完成售后，再插入申请、将订单置为 `refund_pending` 并写审计事实。
- [FACT][E-AU-571-002] Commerce API `orderRoutes.ts` 的售后读取与提交 handler 分别调用 `api_after_sales` 和 `api_create_after_sale`；应用层还先执行 permission、resource scope、请求 body 与 phone verification 检查。此迁移内所有 RPC 只授予 service_role。
- [FACT][E-AU-571-003] `login_attempts` 以 IP hash 单行 UPSERT 统计 15 分钟窗口失败次数，初版第 5 次起封禁 15 分钟；后续 `20260817190000_login_attempt_limit_ten.sql` 调整了最终阈值，不能以本文件初版常数描述当前登录策略。
- Compatibility 与 Canonical 同名 migration SHA-256 相同；共同历史需在各自隔离数据库中顺序重放，不能混跑。

## 未验证项

- 未在真实 PostgreSQL 执行售后重复提交、订单状态竞争、退款执行与账本对账反事实；后续退款/authorization migrations 的最终状态仍待逐文件审阅。
- 未验证 caller 到 service_role 的 credentials 边界、IP hash 来源/轮换/代理可信链、远端 DB RLS/privilege 和实际封禁体验。
