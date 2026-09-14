# AU-631｜Senior Administrator Role

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260902134000_senior_administrator_role.sql`（152 行）。
- 审阅方式：逐段人工审阅 tenant-scoped role、permission projection/exclusion、governance resolver replacement 与 assertion；交叉检查 permission-to-operation catalog、Access read projection、GovernanceResolver test 和后续 business-permission alignment。未连接数据库、执行迁移或测试。

## 审计结论

- **G0：保留。** 本 migration 为每个 active tenant 建立 senior administrator role，并把它投影为独立 governance level，明确不等同于 platform owner。
- [FACT][E-AU-631-001] role ID 以 tenant 作用域确定，迁移先移除旧 mapping 再由 active operator capability/permission 重建 allow；owner-only permission 排除项使用真实 permission code（例如 `access.role.manage` 对应 operation `access.roles.manage`）。
- [FACT][E-AU-631-002] resolver 只在 active operator membership 持有同 organization 的 active/time-valid senior role 时返回 `senior_administrator`；exact owner 仍只由 authoritative platform owner membership + principal 双重匹配决定。
- [FACT][E-AU-631-003] role assertions 阻止 owner-only permission 泄漏；后续 AU-632 在同一 role 的基础上补齐已批准 business permission，不改变 owner-only 排除边界。GovernanceResolver test 也覆盖 senior projection 不提升为 owner。

## 关联问题

- **F-0266（P2）前置阻塞**：本 migration 经 AU-628 strict predecessor chain；空库运行在 F-0266 前已停止，未重复定级。

## 未验证项

- 未在隔离数据库以 senior administrator / ordinary operator / owner 三种 membership 验证实际 operation decision、跨 tenant assignment 或 expire time；未核验现有 tenant 是否都有 active role 行。

## 结论等级

- 新增问题：无；关联 F-0266。无 P0。
- 垃圾代码：G0 1 项（本 migration）；不新增 G1/G2/G3/GX。
- 二次复核：无需新增；涉及 senior 权限集合的后续变更须重新验证 owner-only deny、跨 tenant 和时间失效。
