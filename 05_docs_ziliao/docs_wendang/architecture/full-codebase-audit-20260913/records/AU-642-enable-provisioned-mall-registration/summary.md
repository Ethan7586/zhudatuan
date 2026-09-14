# AU-642｜Enable Provisioned Mall Registration

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260903104000_enable_provisioned_mall_registration.sql`（348 行）。
- 审阅方式：逐段人工审阅 provisioned Mall role clone、owner provisioning delta、registration trigger/RLS delta、assertions；同构 invitation/registration 区间按 AU-633/635 已审定义仅复核本文件的 Mall-generalization 差异，并交叉检查 application contracts/tests。未连接数据库或执行 migration。

## 审计结论

- **G0：保留，但受既有 F-0266 阻断。** migration 使每个 provisioned Mall 获得独立 storefront role（以 base Mall role permission 为基线），并将 storefront invitation、membership role、scope grant 与 registration RLS 从固定 base Mall 泛化到任意 active Mall。
- [FACT][E-AU-642-001] existing `access.mallowner` rows先补建 `role-zhudatuan-storefront-member:<organization>` 与同基线 permission count；新 provisioning function 对后续 Mall 在同 transaction 创建同 role/mappings、owner membership 与 mall/owner/self grants。
- [FACT][E-AU-642-002] registration trigger/RLS 使用 `candidate_membership.organization_id` 与 conditional canonical role ID；storefront scope grants 必须等于该 active Mall，而 operator invitation branch 仍固定于 tenant/base storefront，未发生无证据的 operator scope 扩张。
- [FACT][E-AU-642-003] `IdentityInvitation` 与 `IdentityRegistration` contract 已覆盖 L1 Mall 的 independent storefront invitation role/registration projection；SQL company-template fixtures 也包含 `mallowner` relation。migration assert 检查全部 existing owner role/mapping、function definition marker 与 schema ledger。
- **F-0266（P2，已登记）**：AU-641 function prerequisites 仍因 AU-628 的历史 grant 顺序无法在 clean standard runner 中到达；本文件的 provisioning/generalized registration 依赖该先前能力，未重复计数。

## 未验证项

- 未以真实 DB role/RLS 验证 arbitrary active Mall 的 storefront invite registration，及 role clone 的 duplicate/retry/partial-failure matrix。
- 未确认现网 existing mallowner 的 permission mapping 与 base role 是否存在语义差异；migration仅断言映射数量相等。

## 结论等级

- 新增问题：无；关联 P2 1 项（F-0266）。无 P0。
- 垃圾代码：G0 1 项（本 migration）；不新增 G1/G2/G3/GX。
- 二次复核：沿用 F-0266；后续 provisioning contract repair 应同时跑 L1 storefront invitation/registration matrix。
