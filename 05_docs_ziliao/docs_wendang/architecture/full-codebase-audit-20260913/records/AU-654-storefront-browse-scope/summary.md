# AU-654｜Bind Storefront Browse Scope

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260905014000_bind_storefront_browse_scope.sql`（109 行）。
- 审阅方式：逐段人工审阅 Storefront browse scope 分支、foreign hint 拒绝条件、migration assertion 与 execute grants；交叉检查 Web Business scope resolver、API route contract和单元测试。未执行数据库。

## 审计结论

- **G0：保留。** migration 对 Storefront active Mall membership 的 catalog/pricing/inventory 浏览操作规范化为该 membership 的 Mall scope；任何非该 Mall 的 scope hint 不产生 scope。
- [FACT][E-AU-654-001] 分支先要求 membership 为 active storefront client，且其 organization 为 active Mall；subquery 只在 hint 为空或精确等于 membership Mall 时返回 scope。migration assertion同时检查合法 Mall 与 platform-root foreign hint 的正反例。
- [FACT][E-AU-654-002] 当前 Web Business runtime 对 Storefront 的这三类操作改由 `access.web_storefront_scope(membership,session)` 解析，避免接受 resource/hint；相应 unit test 固定三项操作均使用 session-bound scope。Console target 仍通过 canonical resolver 传递显式 scope hint。
- [FACT][E-AU-654-003] migration 保留原有 role execute boundary，且 RegistrationMigrationPlan 将其作为原文执行的 post-history migration ledger source；未发现 Storefront 借由 scope hint 切换到其他 Mall 的代码路径。

## 未验证项

- 未在实际 PostgreSQL 验证无 hint、同 Mall hint、foreign Mall hint、inactive Mall/membership 的完整行为矩阵。
- 未核验所有非 Web Business runtime 是否仍调用四参数 `access.resolve_scope` 的 Storefront 分支。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本 migration；通用 DB compatibility branch，不能以 Web Business 后续专用 resolver 为由删除）。
- 二次复核：否。
