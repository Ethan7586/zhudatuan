# AU-713｜L1 Owner Provisioning Runtime Head

- 审阅范围：`20260906010000_add_l1_owner_role_and_named_scope.sql`、`20260906011000_complete_l1_owner_runtime_head.sql`、CreateMall及 Mall owner provisioning adapter/runtime references。
- 审阅方式：深入审阅 owner provisioning输入、DB writes、role/scope backfill和当前 application caller；纯 head assertion与同构 runtime checks作结构性审阅。

## 审计结论

- **G0：保留。** L1 Owner role复制 platform owner的非 ownership capabilities，但只以 Mall scope assignment生效；CreateMall在同一 transaction创建 organization/pool/application后，把 actor作为新 Mall operator owner并记录 `access.mallowner`。
- [FACT][E-AU-713-001] 正常 CreateMall path固定传入 `organization=scope=mall=plan.mall`，且 stable owner membership id基于 Mall和actor；L1 role backfill提高 active owner membership access version，令旧 session失效。
- **F-0290：P2。** `security definer` `access.provision_mall_owner` 仅验证输入 source membership与principal匹配，没有验证 `p_organization`、`p_scope`、`p_mall` 是同一 Mall、归属同一 hierarchy或已被当前 provisioning session授权；它可据传入值写 operator membership、Mall/owner/self scope grants和 `mallowner`。当前仓内 CreateMall安全传同一值，但 DB boundary未 fail closed。

## 未验证项

- 未以真实 `zhudatuanprovisioningapi` role调用 function、未读取生产 function owner/role inheritance或 provisioning service caller；未断言已有越权/不一致 Mall owner记录。
- 没有本迁移的专用 PostgreSQL role matrix；未运行全量 provisioning suite。

## 结论等级

- 新增问题：F-0290（P2，高置信度，需要独立复核）。无 P0。
- 垃圾代码：G0 1 组；不新增 G1/G2/G3/GX。
- 二次复核：是；以真实 provisioning role验证 valid same-Mall allow、different organization/scope/mall combinations、foreign actor/source membership和non-Mall organization均拒绝，且失败不得留下任一 membership/role/scope/mallowner行。
