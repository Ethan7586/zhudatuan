# AU-420｜平台 Owner 调和迁移

## 范围与方法

- 主审文件：`02_platform_pingtai/database/supabase/migrations/20260820132000_platform_owner_reconciliation.sql`。
- 交叉核对：Commerce 注册迁移执行计划、运行数据库 Owner 边界和阿里云数据库校验脚本。
- 本批为静态调用链与迁移语义审阅；未执行数据库重放、构建或线上操作。

## 运行结论

该一次性迁移以本地用户名 `ethan` 选定唯一 active platform Owner，补齐平台/租户 scope，临时关闭 Owner 生命周期触发器并暂停命名为 `*-test-*` 的活动身份，最后断言平台 Owner 仅剩一名。找不到该身份或发现多个活动 Owner 都会失败。它会写审计日志并重载 API schema。

`RegistrationMigrationPlan` 明确把该文件认定为环境特定 Owner 调和，并在 registration-only 执行链中省略、以 metadata ledger 记录；运行时仍强制 active Owner 数必须为 1。无法由静态仓内证据确认其他 Supabase 或发布通道是否会执行原文件。

## 审计结论

- GX-0006：这是历史身份与迁移控制面，不是可清理代码。任何变更必须先专项核验迁移 ledger、所有执行器、Owner scope、测试账号和恢复方案。
- 本批未新增 P0–P3；该迁移未重放，运行行为保持未验证状态。
