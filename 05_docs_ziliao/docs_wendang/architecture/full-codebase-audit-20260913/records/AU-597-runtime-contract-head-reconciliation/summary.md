# AU-597｜运行时契约 Head 对齐迁移

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260829190000_reconcile_runtime_contract_head.sql`（177 行）。
- 审阅方式：逐行人工审阅 operation/event/permission/capability/role/entitlement 写入、contract checksum 更新与断言；交叉检查 Referral HTTP/Worker 注册、runtime compatibility consumers 和 migration preflight。未连接数据库或执行迁移。

## 审计结论

- **G0：保留。** 该迁移是 Referral 基础数据与运行 API/event/permission/capability/tenant-role/entitlement 同步的唯一 ledger 环节；删除会让真实 Referral routes 与授权目录脱节。
- [FACT][E-AU-597-001] 它登记 15 个 Referral operation、两个 event、对应 capability/permission/operation mapping，并将 member-facing操作绑定到 self permission、operator-facing操作绑定到 tenant operations/finance role；最终断言验证 count 和角色分权。
- [FACT][E-AU-597-002] `Migrate` 将本 migration 的 max version 当作 registration bootstrap preflight 的前置事实；各 API/Worker runtime 用 `RUNTIME_CONTRACT_CHECKSUM` 比对 schema ledger，说明 contract row 是真实启动链而非文档。
- [FACT][E-AU-597-003] 该文件无条件把 `runtime.schemaversion` 的 contract checksum 更新为目标值，掩盖未知旧值；已记录为 F-0262，不能以最终“值已等于目标”断言替代前置 drift 检查。

## 未验证项

- 未执行 migration，未验证历史 database 中是否出现未知 checksum、role/permission collision、既有 entitlement 状态或 Referral route 与数据库操作目录的完整一致性。

## 结论等级

- 新增问题：F-0262（P2）。无 P0。
- 垃圾代码：G0 1 项（本迁移）；不新增 G1/G2/G3/GX。
- 二次复核：否；修复 F-0262 时应由数据库/发布所有者复核 unknown-checksum replay 与启动兼容性。
