# AU-644｜Governance Invitation Tree Visibility

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260903106000_governance_invitation_tree_visibility.sql`（71 行）。
- 审阅方式：逐段人工审阅 governance-parent schema/backfill/index 与 invitation RLS delta；交叉追踪 AU-640 accepted membership write/backfill 和 Member invitation read flow。未连接数据库或执行 migration。

## 审计结论

- **G0：保留。** migration 从已接受 operator invitation 建立 invitation creator → child operator membership 的可查询治理父链，并使受邀者可见与本人有关的 invitation record，保留 creator 和 exact Owner 的可见性。
- [FACT][E-AU-644-001] `governance_parent_membership_id` 是 self-referencing deferred FK，并对 non-null 值建立 partial index；backfill 只选择 target operator、已接受、有效 child membership 的 invitation，并以 accepted/created timestamp + ID 确定单一父项，且不覆盖已有 parent。
- [FACT][E-AU-644-002] RLS 的 management branch仍先走 `access.zhudatuan_operator_invitation_allowed`，再限制至 creator、accepted membership 或 Owner context；普通 Senior/管理员没有获得无边界 invitation tree enumerate 权限。
- [FACT][E-AU-644-003] 所依赖的 `accepted_membership_id` 由 AU-640 的 invite consume runtime 同 transaction 写入；历史缺失关联保持 null，不伪造 parent relationship。

## 未验证项

- 未在真实 PostgreSQL 验证 parent FK deferred transaction、历史重复 invitation 的排序选择、parent cycle 防护和 creator/acceptor/owner RLS matrix。
- 未确认下游成员树读取是否把该字段当作唯一管理层级来源；该 consumer 属于 member/access 后续专项。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本 migration）；不新增 G1/G2/G3/GX。
- 二次复核：不需要；若将 parent chain 用于权限继承，应另建专项并加入 cycle/depth/tenant boundary tests。
