# AU-653｜Registration Invite Role Projection

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260905013000_registration_invite_role_projection.sql`（69 行）。
- 审阅方式：逐段人工审阅 invitation role predicate、SECURITY DEFINER privilege、ledger guards；交叉检查 MemberPort invitation/consume query、registration projection、unit contract与后续角色泛化迁移。未执行数据库。

## 审计结论

- **G0：保留。** migration 建立注册邀请码可消费角色的白名单：Storefront 为 Mall 会员角色；Operator 为无 permission 的 pending role 或该 Tenant 的 senior administrator role；执行权仅授予应用和 Identity API。
- [FACT][E-AU-653-001] 当前 `MemberPort` 在 invitation read 与 consume 的同一 SQL boundary 调用该 predicate，并额外验证 invitation status/effective/expiry/use count、destination hash、registration policy、目标组织状态/类型和 Operator→Storefront Mall 的 closure 关系。
- [FACT][E-AU-653-002] `consumeInvite` 仅在 operator invitation 下计算 storefront role 与 governance level，随后 registration runtime 将其作为 membership/role/scope projection 输入；无角色或无有效组织边界时返回 `INVITE_INVALID`。
- [FACT][E-AU-653-003] 后续 `20260908013000_generalize_storefront_roles.sql` 将 Storefront predicate 从固定 canonical role ID 放宽为 active Mall 下名为“商城会员”的角色；原 privilege boundary 未放宽，现有 MemberPort unit test 保存 predicate 接入契约。

## 未验证项

- 未在真实 PostgreSQL 使用 application/identity roles 验证每种 role 的 allow/deny 矩阵。
- 未执行真实 invitation consume；应用层 unit test 为 query-shape contract，不覆盖 RLS/trigger/SECURITY DEFINER 的执行行为。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本 migration）；不新增 G1/G2/G3/GX。
- 二次复核：否。
