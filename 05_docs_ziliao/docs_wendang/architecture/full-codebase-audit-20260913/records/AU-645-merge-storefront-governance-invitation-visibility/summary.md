# AU-645｜Merge Storefront And Governance Invitation Visibility

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260903107000_merge_storefront_and_governance_invitation_visibility.sql`（63 行）。
- 审阅方式：对 AU-642/AU-644 同构 RLS policy 采用差异性深入审阅：核对 policy merge 是否同时保留 provisioned Mall storefront role 和 invitation governance visibility；审阅 pre/post conditions。未连接数据库或执行 migration。

## 审计结论

- **G0：保留。** 此 merge migration 恢复先前两次 policy rewrite 中必须共同存在的两条语义：任意 active Mall 的 independent storefront invitation role，及 creator/accepted membership/exact Owner 的 operator invitation history visibility。
- [FACT][E-AU-645-001] storefront anonymous registration branch使用 conditional canonical/`role-...:<organization>` ID，并验证 target active Mall；因此保留 AU-642 的 provisioned Mall registration能力。
- [FACT][E-AU-645-002] authenticated operator branch仍要求 `zhudatuan_operator_invitation_allowed`，随后限制 createe/accepted/owner context，保留 AU-644 的治理树可见性且不扩大 Senior Administrator 至 platform-wide enumeration。
- [FACT][E-AU-645-003] exact predecessor禁止跳过 AU-644，postcondition从 catalog读取 policy expression 并同时要求 independent role marker 与 Owner context marker，避免其中一条语义被下一次 rewrite 静默覆盖。

## 未验证项

- 未在真实 PostgreSQL 验证 anonymous registration、provisioned Mall storefront、creator、accepted child、Owner和普通 operator 的 RLS allow/deny matrix；沿用 F-0268 的 invitation policy database contract 缺口。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本 migration）；不新增 G1/G2/G3/GX。
- 二次复核：不需要；后续 policy rewrite 必须保留 merge assertion并扩充真实 RLS fixture。
