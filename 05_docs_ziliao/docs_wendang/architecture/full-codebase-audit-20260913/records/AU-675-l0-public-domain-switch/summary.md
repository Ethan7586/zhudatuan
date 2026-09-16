# AU-675｜L0 Public Domain Switch

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260909203000_switch_l0_public_domain_to_fufu.sql`（105 行）。
- 审阅方式：逐段人工审阅 L0 entry/return-origin domain cutover、non-L0 snapshot invariant和断言；反向检查 auth web、node manifest/config、API/bootstrap及 Storefront domain tests。未访问公网域名或生产数据库。

## 审计结论

- **G0：保留。** migration 原子切换 L0 的 accounts/API/Storefront entry 与 return origins 到 `fufu.wang`，并显式证明不触及非 L0 Realm。
- [FACT][E-AU-675-001] precondition 要求精确旧 L0 registry；迁移只更新 L0 两个 entry、添加 L0 Storefront entry、更新四个 L0 target origin，并在临时 snapshot 对非 L0 entry/target 执行双向集合相等检查。
- [FACT][E-AU-675-002] 当前 auth web、SFL node config、Identity API bootstrap、SDK registry 和 Storefront tests 都使用 accounts/api/console/fufu domains；legacy L1 host 仍独立为 hbbtzn，未被 L0 switch 混用。
- [FACT][E-AU-675-003] auth web/Storefront tests 对 host-to-node、target、application 与 origin 作正反向验证，且 production Storefront host policy拒绝 development fallback。

## 未验证项

- 未解析 DNS、证书、CDN/反代或真实 browser login；不能证明域名现场已完成切换。
- 未读取生产 Realm registry 和 migration ledger，不能确认线上已执行到该 migration。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（L0 public domain cutover migration）；不新增 G1/G2/G3/GX。
- 二次复核：否。
