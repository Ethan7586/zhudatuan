# AU-666｜Canonical Identity Targets

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260908011000_canonicalize_sfl_identity_targets.sql`（81 行）。
- 审阅方式：结构性审阅。核对 AU-660/661/663 的 intermediate target 证据、当前 AuthTarget parser、ticket runtime、migration precondition/forward conversion/terminal assertions，以及 legacy target 的拒绝测试；未重复深读已审 ticket 或 Realm 实现，未执行迁移。

## 审计结论

- **G0：保留。** 该前向 migration 将 L1 专用的中间 target 名称归一为 `console`/`storefront`，但将各 Realm 的 return origin 保留在 Realm target 数据中；它消除了 AU-660 仅观察中间 schema 时产生的表面契约漂移。
- [FACT][E-AU-666-001] precondition 明确要求 L1 旧 target 存在且通用 target 尚未存在；migration 同步转换 session、ticket 和 realmtarget，最后重建只允许应用层 `AuthTarget` union 四值的数据库 check 与 Realm target foreign keys。
- [FACT][E-AU-666-002] 终态 assertion 明确拒绝 `console-hbbtzn`/`storefront-hbbtzn` 在 Realm target、session 和 ticket 中残留；当前 auth web tests 也将 legacy target 输入视为无效。
- [FACT][E-AU-666-003] `PgAuthTicket` 以 `(realm_id,target)` 读取 return origin，故同名 `console`/`storefront` target 的跨 Realm 回跳仍由 Realm 数据隔离，而不需要将 Realm 名编码进 API target 值。
- **F-0274 已关闭（基线代码与迁移链证据）。** 它不再计入当前问题总数；生产数据库是否已实际执行到本 migration 仍未验证，需作为运行状态而非代码缺陷核对。

## 未验证项

- 未读取生产 `runtime.schemaversion` 或 Realm target 数据，无法确认线上是否已执行这项前向迁移。
- 未运行 L0/L1 password、registration 和 WeChat roundtrip；只验证了静态 schema/调用链与 legacy input rejection tests。

## 结论等级

- 新增问题：无。无 P0。
- 关闭问题：F-0274（P2 → 已关闭，待运行状态确认）。
- 垃圾代码：G0 1 项（target canonicalization migration）；不新增 G1/G2/G3/GX。
- 二次复核：否。
