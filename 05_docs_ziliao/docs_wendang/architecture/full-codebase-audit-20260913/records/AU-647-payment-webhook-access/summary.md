# AU-647｜Payment Webhook Database Access

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260903110000_zhudatuan_payment_webhook_access.sql`（124 行）。
- 审阅方式：逐段人工审阅 dedicated DB role、schema/table/function grant、RLS policy 与 assertion；交叉检查 webhook handler、runtime compatibility gate、local/Alibaba role provisioner和 deployment quality gate。未连接数据库或执行 webhook。

## 审计结论

- **G0：保留。** migration 把 WeChat payment webhook 收敛到无继承、无高特权的专用 database role，只提供按 resolved Mall scope 的 payment read、受限 job/audit insert 和两条 scoped security-definer function。
- [FACT][E-AU-647-001] role guard拒绝 super/create/replication/bypass-RLS/inherit及任何 role membership；grant只覆盖 runtime/payment/audit 的最小 schema、六张 payment read table、job/audit writes 和 webhook scope/accept functions，assert反向检查 identity/access/ordering/finance/raw envelope/outbox及 payment DML均不可用。
- [FACT][E-AU-647-002] handler先验签，再以 provider reference/application hash 解析 Mall，写入 transaction-scoped database context；随后对 intent/refund金额、币种、payer/scene/application hash做完整性校验，provider envelope dedupe accepted 后才投递受 RLS 限制的 payment job和审计记录。
- [FACT][E-AU-647-003] runtime Ready gate验证 current/session user、schema marker、relations/functions、selected and forbidden privileges；local Postgres init 与 Aliyun dedicated role provisioner均在 migration 前创建该 role，因此 migration 的显式 preprovision requirement有仓内实现和 deployment check支持。

## 未验证项

- 未在真实 PostgreSQL/RDS 角色下执行 RLS cross-Mall read/job/audit拒绝矩阵，亦未调用第三方 webhook。
- 未验证部署环境实际已运行专用 role provisioner；只能确认代码/控制面路径存在。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本 migration）；不新增 G1/G2/G3/GX。
- 二次复核：不需要；上线前由支付/部署所有者按正式 role 运行 compatibility gate和一条签名测试 webhook。
