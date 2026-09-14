# AU-686｜Hosted Node Provisioning

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260911210000_create_sfl_hosted_node_provisioning.sql`（232 行）。
- 审阅方式：深入审阅。核对 JSON input、idempotency/locking、parent/Realm/level validation、write ordering、role grant、public TypeScript port 和 PostgreSQL contract；未重复审读 hosted Mall opening 下游业务流程。

## 审计结论

- **G0：保留。** `organization.provision_hosted_node` 是 provisioning role 唯一可执行的 security-definer command，负责将已存在的 active Realm 纳入 hosted node/relation/provisioning ledger 三张表，且不授予该 role表访问权限。
- [FACT][E-AU-686-001] command 以精确 JSON key set、canonical timestamp、request hash和两把 advisory locks保护 idempotency key/node id；同 key 不同 request拒绝，同 key相同 request replay，另一 key复用 node id拒绝。
- [FACT][E-AU-686-002] parent relation在 effective time 被共享锁读取，level chain必须满足 L1–L11规则；Realm必须已绑定目标 node/profile/Mall，并为 consumer 指向 parent 的 sovereign host，之后才写 node、version-1 relation及 provisioning fact。
- [FACT][E-AU-686-003] database contract `sfl_hosted_node_provisioning_contract.sql` 执行 L1/L5/L6/L7–L11样本、replay、idempotency collision和不修改既有 sovereign nodes的断言。TypeScript public port只传递该 command；仓内未找到其已注册 HTTP operation/worker consumer。
- 对“零内部 TypeScript consumer”不作删除结论：function 是明确授予 `zhudatuanprovisioningapi` 的公共数据库 command，可能由仓外/运维 provisioning caller 使用；记为未验证运行入口，而非垃圾代码。

## 未验证项

- 未读取 Provisioning API 的部署命令、生产 DB function invocation audit或仓外调用方，不能确认当前生产入口。
- 未执行 SQL contract，未验证多个事务下 advisory lock 竞态。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（hosted node provisioning public DB command）；不新增 G1/G2/G3/GX。
- 二次复核：否。
