# AU-659｜Publish Storefront Member Directory

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260907110000_publish_storefront_member_directory.sql`（60 行）。
- 审阅方式：逐段人工审阅 operation/capability/entitlement 目录发布；反向检查 contract、SDK、Identity API module/entrypoint、Mall-bound query与 PGlite 行为测试。未执行完整服务或生产数据库。

## 审计结论

- **G0：保留。** migration 发布 operator-audience 的 Mall Storefront member directory，使用既有 `member.read` permission 与 platform-root entitlement。
- [FACT][E-AU-659-001] contract、OpenAPI 与 generated SDK 一致定义 `GET /api/v1/member/storefront-members`；Identity Registration API 把 `IdentityOperatorMemberModule` 的完整 member operator read array 加入 operationIds和 module list。
- [FACT][E-AU-659-002] handler fail-closed 要求 resolved scope 为 Mall，查询以 `membership.organization_id=$1`、Storefront client 和 member node context 限定，并只返回 masked mobile/绑定状态等目录事实。
- [FACT][E-AU-659-003] PGlite test 以两 Mall fixture 验证只返回精确 Mall 的 Storefront membership rows、masked/membership-bound identity facts；另有 non-Mall scope 在数据库查询前拒绝的行为测试。

## 未验证项

- 未以真实 Identity API role/RLS 运行 HTTP 请求，未验证 production entitlement 赋予的实际 operator role 集合。
- 未进行 UI 视觉检查；本 AU 仅包含 API/contract/runtime directory publication。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本 migration；有效的 operator directory contract）。
- 二次复核：否。
