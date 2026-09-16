# AU-704｜Storefront Member Context Projection

- 审阅范围：`20260912220000_publish_storefront_member_context_projection.sql`、`20260913014500_restore_storefront_member_context_owner.sql`、MemberReadOperations、Identity registration runtime、Member read tests。
- 审阅方式：深入审阅 membership→consumer node→parent projection、Mall约束、function ACL/owner及真实 Member read caller；三个同构读取动作按同一 contract结构性审阅。

## 审计结论

- **G0：保留。** projection把 Storefront membership的最新 active consumer node、签约层级与上级（member/Mall）归并为 Identity API唯一可执行的窄读边界，避免应用角色直接读取 registration/node/relation tables。
- [FACT][E-AU-704-001] `member.storefront.members.read`、detail和invitees read均先以认证 Mall scope限制 `access.membership.organization_id`，再使用 lateral projection；function也要求 membership与参数organization相同且 client为 storefront。
- [FACT][E-AU-704-002] projection仅选择当前 active consumer node及非 superseded L6-L11 relation，parent consumer只在同组织 storefront membership中解析 display name；后续 `20260913014500` 将 security-definer owner从 migration role恢复为 `zhudatuanroot`，保留 public revoke和 Identity API execute-only grant。
- 本模块没有新增独立问题。function不自行读取 session actor/scope，属于 Identity API service-role必须由 `MemberReadOperations` 持续实施 scope gate的既有边界假设；未将此观察重复计为新发现。

## 未验证项

- 当前测试以局部 PGlite schema复刻 function，不证明真实 PostgreSQL owner、role inheritance或 runtime session context；固定基线缺少 `vitest` executable，未运行定向 test。
- 未读取生产 function privilege、Identity API connection settings、member registration历史和 Storefront真实 response，未断言线上层级数据完整性。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项；不新增 G1/G2/G3/GX。
- 二次复核：不要求新增独立复核；若改变 Identity API connection role、function ACL或 Member read scope gate，必须同批验证同 Mall allow、跨 Mall/member mismatch deny及owner/privilege matrix。
