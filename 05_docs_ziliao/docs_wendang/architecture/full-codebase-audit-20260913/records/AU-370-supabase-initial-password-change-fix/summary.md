# AU-370｜Supabase 首次改密歧义修正

`20260813020000_fix_initial_password_change_ambiguity.sql` 是已应用首次改密 RPC 的前向修正：用明确的 `target_member` 与 `storefront_membership` 变量替代会与 `memberships.target` 混淆的记录名。修正后仍只允许 active member 的 `must_reset_password` 凭据改密，递增 credential version、撤销既有会话并写入审计。

当前公开登录路径在强制改密状态下调用该 RPC，并拒绝复用临时密码。后续 distributor anchor 再将其包装为锁定成员运行时的公开入口；因此该小迁移仍是既有安装修复与完整迁移重放的必要步骤。

结论为 G0：首次改密兼容修正职责。未发现新增 P0–P3 或删除候选；未执行改密、测试或数据库写入。
