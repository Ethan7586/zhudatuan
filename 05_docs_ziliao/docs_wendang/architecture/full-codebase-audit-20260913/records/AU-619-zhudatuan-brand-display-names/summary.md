# AU-619｜主打团历史演示名称

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260901060000_zhudatuan_brand_display_names.sql`（68 行）。
- 审阅方式：结构性审阅；逐行检查 migration head/source guards、固定 ID update、版本行为与最终断言。未连接数据库或执行迁移。

## 审计结论

- **G0：保留。** 本 migration 将固定历史演示 tenant/mall/application/pool 的展示名称改为“主打团历史演示”，用于区分生产/演示品牌；不是可凭文字替换删除的文件。
- [FACT][E-AU-619-001] 只更新四个固定 ID 的 `name`，保留所有主键、scope、关联与数据归属；organization/application/pool 的 version 仅随可观察显示变更递增。
- [FACT][E-AU-619-002] 仅接受明确 predecessor 且无 future head，source 只允许旧名或已迁移新名；错误数据库、未知源数据会 fail closed。
- [FACT][E-AU-619-003] 最终 assert 检查四个名称与 migration ledger，防止半完成的展示数据重命名。

## 未验证项

- 未连接真实数据库或打开前端页面验证名称在各 UI/API 读模型中的展示；线上演示数据是否存在未知。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本迁移）；不新增 G1/G2/G3/GX。
- 二次复核：无需；若正式停用演示数据，需单独评估其 deployment/seed/历史兼容责任，不能据名称迁移删除。
