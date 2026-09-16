# AU-443｜目标 schema 基线断言

## 范围与方法

- 主审文件：`02_platform_pingtai/database/supabase/migrations/20260821032000_assert_target_head.sql`（30 行）。
- 交叉核对：前置对象退役/回填对账，以及后续迁移使用 `runtime.schemaversion` 的链式头部校验。
- 本批为静态迁移语义审阅；未执行数据库迁移、权限探测或线上操作。

## 运行结论

该迁移以 fail-closed 断言验收第一阶段目标：预期业务 schema 集合、operation/event/capability 一致性、无 legacy public/inventory/stage/API 对象、无宽泛默认角色授权、无应用角色 BypassRLS、所有 security-definer 显式 search path、全表 RLS、无测试身份以及回填对账为零差异。

它最后记录带校验值的 schema version；后续大量领域迁移又以前序 version 为前提，形成线性迁移头完整性链。因此它既是历史切换验收点，也是诊断缺失/漂移的阻断器。

## 审计结论

- G0：目标迁移头的 fail-closed 验收断言，不是删除候选。
- 静态审阅不能证明任一实际环境通过全部断言；真实执行记录、角色权限和迁移 ledger 均需在独立安全/数据复核中验证。
- 本批未新增 P0–P3。
