# AU-635｜Administrator Registration Role Boundary

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260902138000_fix_administrator_registration_role_boundary.sql`（120 行）。
- 审阅方式：对 AU-633 同构 trigger 采用差异性深入审阅：逐项核对唯一行为 delta、前序 function/RLS 继承、后续 ledger consumer 和测试检索；未重复逐行审读 AU-633 已覆盖且本文件未改动的邀请策略。未连接数据库或执行 migration。

## 审计结论

- **G0：保留。** 这是 AU-633 registration trigger 的单目的收紧：把 membership role 写入由“任一 candidate invitation role”改为按 candidate client/organization 分支验证，Storefront 只能获取 canonical storefront role，Operator 才能接收该邀请载明的 pending 或 senior role。
- [FACT][E-AU-635-001] 唯一实际行为 delta 位于 `membershiprole` 分支：`role:self` 仍保留；storefront 明确要求 `mall-zhudatuan` + `role-zhudatuan-storefront-member`，operator 明确要求 `tenant-zhudatuan` + `candidate_invitation_role`。
- [FACT][E-AU-635-002] candidate invitation role、手机号 challenge、membership state、scope grant 以及 function execute boundary均沿用 AU-633 已审阅定义；本 migration 既不改 invitation policy/RLS，也不扩大 runtime role。
- [FACT][E-AU-635-003] 紧随其后的 AU-636 把本 version/checksum 作为 exact predecessor，且后续 Senior Administrator permission migration以 AU-636 为前置；标准 sorted migration chain 可继续追踪。

## 未验证项

- 未以真实 PostgreSQL trigger 执行 storefront/operator 双 membership registration 的 allow/deny 矩阵；该数据库层 contract 缺口已由 F-0268 统一记录，不重复计数。
- 未审阅基线后续 node-mall widening migration；其作为独立文件进入后续 AU。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本 migration）；不新增 G1/G2/G3/GX。
- 二次复核：不需要；沿用 F-0268 所列数据库权限矩阵验证。
