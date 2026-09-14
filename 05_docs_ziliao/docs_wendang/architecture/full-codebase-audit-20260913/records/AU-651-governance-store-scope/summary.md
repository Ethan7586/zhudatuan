# AU-651｜Expand Governance Store Scope

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260905011000_expand_governance_store_scope.sql`（97 行）。
- 审阅方式：逐段人工审阅 canonical scope resolver 的 actor binding、组织层级解析、Store branch、SECURITY DEFINER boundary及后续 governance resolver 消费；检索 PostgreSQL contract 与 Node resolver tests。未执行数据库。

## 审计结论

- **G0：保留。** migration 将 active Store ID 规范化为 `store` semantic/storage ID，并把其 governance organization 解析到该 Store Mall 的最近 active Tenant；它不在此函数内授予 Store 访问权。
- [FACT][E-AU-651-001] 所有候选 scope 均建立于 principal 与 active membership 的 actor context；Store branch 只接受 `partner.store.id`、要求目标 Mall active，并以 closure 向上找 Tenant，否则退回 Mall ID。
- [FACT][E-AU-651-002] `resolve_governance` 只将 canonical result 投影成 governance context；调用者仍需在后续资源权限路径执行 scope/capability 授权。因此未发现单凭 Store ID 取得授权的直接证据。
- **F-0272（P3，新增）**：Store normalization 没有 PostgreSQL 级允许/拒绝矩阵测试，当前 Node resolver tests 使用已返回的 session/governance row，不能检验 SECURITY DEFINER function、active 状态与跨 Tenant/错 scope 的数据库实际行为。

## 未验证项

- 未在真实数据库检验 active/inactive Store/Mall、无 Tenant ancestor、异 Tenant Store、actor/membership 不匹配、`p_scope_kind` 为 null 或错误时的结果。
- 未对后续 API 实际 scope authorization 做运行请求；本 AU 仅审该 normalization migration与其 resolver 数据流。

## 结论等级

- 新增问题：P3 1 项（F-0272）。无 P0/P1/P2。
- 垃圾代码：G0 1 项（本 migration）；不新增 G1/G2/G3/GX。
- 二次复核：否；新增 DB contract 时需由权限所有者确认 Store 跨 Mall/Tenant 的产品语义。
