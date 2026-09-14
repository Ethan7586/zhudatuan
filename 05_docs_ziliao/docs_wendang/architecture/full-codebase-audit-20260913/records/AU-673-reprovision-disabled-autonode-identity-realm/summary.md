# AU-673｜Reprovision Disabled Autonomous Identity Realm

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260909063000_reprovision_disabled_autonode_identity_realm.sql`（206 行）。
- 审阅方式：以 AU-671 为基线进行差异深审；逐段检查 disabled-only reconfiguration、entry/target 删除重建、会话/票据/intent 外键和权限。未执行供给或删除。

## 审计结论

- **G0：保留 migration 历史。** 它提供 disabled Realm 使用更新 fact 重建 entry/target 的设计；但重建路径与既有身份引用外键不兼容，见 F-0276。
- [FACT][E-AU-673-001] 仅当同 activation/node/Realm、ledger 与 Realm 均 disabled、所有 entry disabled 时，更新 fact 才能进入 reconfiguration；其他 identity/fact 变化均 fail closed。
- **F-0276（P2，新增）**：reconfiguration 直接 `delete from identity.realmtarget`，而 session、authticket 和 loginintent 都以默认 non-cascade foreign key 引用 `(realm_id,target)`；AU-671 disable 只禁用 Realm/entry/ledger，不撤销、迁移或删除这些引用。因此任一历史 session/ticket/intent 仍引用该 target 时，reprovision 会因外键约束失败，不能完成恢复。

## 未验证项

- 未运行含 Realm-bound session、ticket 或 login intent 的 disabled Realm 重供给，未取得实际 SQLSTATE；结论来自明确的 delete 和外键定义。
- 未审到数据保留/清理任务，未知历史引用通常何时被物理清除。

## 结论等级

- 新增问题：P2 1 项（F-0276）。无 P0。
- 垃圾代码：G0 1 项（disabled Realm reconfiguration migration）；不新增 G1/G2/G3/GX。
- 二次复核：修复设计前需要独立复核 Realm disable/recovery 与 session retention 行为。
