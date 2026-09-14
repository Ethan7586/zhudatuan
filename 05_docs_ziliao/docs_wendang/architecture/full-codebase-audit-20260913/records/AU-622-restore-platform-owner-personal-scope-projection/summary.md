# AU-622｜恢复 Platform Owner Personal Scope Projection

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260901210000_restore_platform_owner_personal_scope_projection.sql`（119 行）。
- 审阅方式：结构性审阅；对比 AU-604/AU-621 resolver replacement，逐行检查 function-text guard、virtual grant 条件与 final assertion。未连接数据库或执行迁移。

## 审计结论

- **G0：保留。** AU-621 的 scope-aware resolver replacement 遗漏了 AU-604 引入的 active Platform Owner virtual personal grant；本 migration 恢复该业务能力且保留新 assignment-scope containment。
- [FACT][E-AU-622-001] 仅在 AU-621 exact predecessor/no future head 运行，且先从现有 function definition 确认 `assignment.assigned_scope_id` 语义存在；replace 不匹配/未嵌入目标文本即 fail closed。
- [FACT][E-AU-622-002] virtual grant 只对 singleton active Owner、有效 owner/self assignments、无实际 owner scope grant 的同一 membership 生效，权限仅来自 `role:self` allow；不为普通成员创建跨 scope grant。
- [FACT][E-AU-622-003] assert 以 active owner 的真实 resolver 结果验证 owner scope、member.profile/address read/manage 权限，并再次确认 assigned scope 语义和 ledger。

## 未验证项

- 未在真实数据库验证 function definition 字面量变化、Owner transfer/bootstrap 交错执行或 virtual/actual owner scope 的互斥结果。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本迁移）；不新增 G1/G2/G3/GX。
- 二次复核：无需；未来 resolver migration 必须保留 Owner virtual scope 反事实测试，避免文本替换丢失 append-only grant tail。
