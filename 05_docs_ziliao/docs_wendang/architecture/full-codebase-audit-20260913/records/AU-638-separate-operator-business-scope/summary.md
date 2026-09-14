# AU-638｜Separate Operator Business Scope

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260903100000_separate_operator_business_scope.sql`（123 行）。
- 审阅方式：逐段人工审阅 resource scope resolver 的 client-conditional delta、资源归属表、predecessor/lock/assertion；与 AU-624/625 的 mall identity resolver 及 runtime readiness consumer 交叉核对。未连接数据库或执行 migration。

## 审计结论

- **G0：保留。** migration 修正共享 member-audience operation 的 scope 语义：Storefront membership 继续拥有个人 resource scope；Operator 不再因 operation audience 是 member 而被错误投影到个人 profile，而是进入资源/组织 scope 的正常解析路径。
- [FACT][E-AU-638-001] 相对此前 resolver 的唯一关键行为差异是 member/cart/checkout branch 增加 `client='storefront'`；Storefront 的 order/support read personal-scope 分支保持不变，operator 无 resource 时回退其 membership organization。
- [FACT][E-AU-638-002] resolver 对显式资源按 organization、partner、catalog、pricing、inventory、experience、cart/checkout、order/fulfillment、verification/payment、voucher/benefit/finance、channel/support/notification/reporting/risk/extension 的已知 data owner 链依次解析，无法解析时 fail-closed 抛出 `RESOURCE_SCOPE_NOT_FOUND`。
- [FACT][E-AU-638-003] migration 要求 AU-637 exact head 且拒绝未来 ledger，持有 scope advisory lock；同一 transaction assertion 对 active operator 验证 catalog/order 返回 organization scope、对 active storefront 验证同两操作返回 personal member scope。

## 未验证项

- 未在隔离 PostgreSQL 对同一 operation 的 operator/storefront 请求及跨 tenant resource 执行实际 authorization/RLS 反事实矩阵。
- 各资源表的 data-owner mapping 后续仍会随其所属模块文件逐项审计；本文件只确认其统一 resolver 的当前路由。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本 migration）；不新增 G1/G2/G3/GX。
- 二次复核：不需要；变更 resource scope resolver 时需以双 client 与跨 scope fixture 复测。
