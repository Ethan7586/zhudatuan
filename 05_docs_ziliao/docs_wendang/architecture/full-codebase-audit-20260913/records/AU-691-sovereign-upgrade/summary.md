# AU-691｜SFL Sovereign Upgrade

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260912050000_create_sfl_sovereign_upgrade.sql`（485 行）。
- 审阅方式：深入审阅。核对 Web member operation、upgrade/rollback state machine、domain/resource/manifest facts、node/Realm relation changes、SQL fault/rollback contract及仓内 resource-reference consumers；未尝试调用外部域名、边缘、隧道、支付或部署资源。

## 审计结论

- **G0：保留。** module 是 hosted Mall node 到 sovereign node 的版本化 topology/state transition，保留 planned→resources_ready→bindings_complete→upgraded receipts、domain/resource/manifest facts和 database rollback history。
- [FACT][E-AU-691-001] `member.sovereignty.upgrade` 已注册为 Web/Member runtime operation；action从 authenticated access传入当前 membership与 server-resolved node context，DB command对 node/Realm/Mall/opening/membership/account加锁并限制目标为 active hosted operating-Mall node。
- [FACT][E-AU-691-002] command对五个不同 host、idempotency、node claim、relation version和数据库 fault rollback有完整保护；SQL contract覆盖 consumer rejection、cross-node isolation、interruption rollback、replay和 privileged rollback function 的 topology恢复。
- **F-0281：P2。** command把调用者提供的 domain/resource/payment/secret/runtime reference 直接写为 candidate 后在同一事务置为 active，并立即将 node 切为 sovereign、Realm host 置空；仓内没有发现引用真实性/部署回执/资源所有权验证，也没有发现这些 active binding/manifest facts 的实际 provisioner consumer。它证明“声明已提交”，不能证明外部资源已就绪。

## 未验证项

- 未检查仓外 Provisioning/Alibaba Cloud/DNS/edge system是否在 API 调用前完成资源和所有权验证；若存在受控外部 preflight，F-0281 的影响需重新评估。
- 未读取生产 active upgrade、manifest、outbox或 rollback runbook，不能确定实际运营流程。

## 结论等级

- 新增问题：F-0281（P2，高置信度，需要独立复核）。无 P0。
- 垃圾代码：G0 1 项（sovereign upgrade/rollback topology and binding state machine）；不新增 G1/G2/G3/GX。
- 二次复核：是；需独立重查 Web entitlement、外部 resource preflight/receipt及 active binding消费者。
