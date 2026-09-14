# AU-369｜Supabase 成员运营中心

`20260813010000_member_operations_center.sql` 建立成员运营读模型、员工邀请码生命周期、管理员创建普通 storefront 会员、资料更新、导入回执和首次改密审计。所有写入限定普通 employee/storefront 角色，使用 service-role RPC，并在后续 distributor-anchor 迁移中将原始实现改为内部函数、对公开入口加入锁定的 actor 与权限检查。

本轮独立复查确认 F-0237（P2）仍成立：`handleUpdateMemberProfile` 对 `member.update` 只以操作者当前上下文授权，未加载目标 membership 的服务器范围；当前 anchor 包装只重新验证 actor 与 `member.update`，随后仍调用只限制目标 tenant/enterprise、未要求 `target.mall_id = p_mall_id` 的内部实现。静态契约覆盖正常同商城更新与 Owner 保护，但未覆盖同企业跨商城目标拒绝。未发现 P0。

结论为 G0：成员创建、邀请码、导入、初始改密和运营读模型的真实职责；F-0237 保持 P2，待后续独立修复批次处理。本单元未执行成员创建、导入、资料更新、测试或数据库写入。
