# AU-629｜Canonical Governance Context

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260902132000_canonical_governance_context.sql`（260 行）。
- 审阅方式：逐段人工审阅 boundary/predecessor guards、canonical scope 与 exact-owner resolver、owner/invitation helper、owner-mobile function rewrite 与 assertion；交叉检查后续 resolver consumer migrations、runtime privilege inventory 和原子 owner-mobile function 的初始定义。未连接数据库或执行迁移/测试。

## 审计结论

- **G0：保留。** 此 migration 将 platform owner、operator/member、self/owner/organization scope 的语义归一为一个 security-definer governance resolver，降低敏感 owner 判断散落在各 RLS/function 的风险。
- [FACT][E-AU-629-001] resolver 的 actor context 同时绑定 active membership、member profile、principal 和调用 actor；exact owner 同时比较 authoritative owner membership 与 principal，避免仅凭 role 或 ID 单项提升权限。
- [FACT][E-AU-629-002] canonical scope 将 `self:`、`owner:`、organization scope 映射为 semantic/storage/organization 三元组；后续 senior administrator、invitation runtime、node console projection 等迁移均复用 `resolve_governance` 而不是重复平台 owner 条件。
- [FACT][E-AU-629-003] owner-mobile mutation 不被重写为新 body，而是在已有 atomic function 的第一身份判断插入 exact-owner resolver，动态 rewrite 有 `pg_get_functiondef`、needle/replacement 与最终 definition assertion 三重保护。
- [FACT][E-AU-629-004] runtime grant 只暴露 aggregate resolver，不暴露 canonical helper；owner/invitation wrapper 各自限定 caller role，并读取 transaction-local app membership/actor/scope context。

## 关联问题

- **F-0266（P2）前置阻塞**：本单元的 strict predecessor 是 AU-628；空库按正常 runner 会先在 AU-628 缺失函数 grant 停止，故本 migration 的实际执行尚未验证。该缺陷已单独记录，不重复定级。

## 未验证项

- 未在隔离数据库验证 owner、operator、普通成员、伪造 principal、self/owner/tenant/platform scope 和 RLS wrapper 的反事实行为。
- 未回放 owner-mobile rewrite 与并发 owner transfer；仅静态核对保留 lock/final row check 的设计意图及 definition guard。

## 结论等级

- 新增问题：无；关联 F-0266。无 P0。
- 垃圾代码：G0 1 项（本 migration）；不新增 G1/G2/G3/GX。
- 二次复核：无需新增；F-0266 的独立复核完成前，不应把本迁移的空库可执行性写为已验证。
