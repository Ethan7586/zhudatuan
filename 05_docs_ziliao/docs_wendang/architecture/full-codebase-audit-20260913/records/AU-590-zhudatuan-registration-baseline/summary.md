# AU-590｜筑大团注册基线迁移

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260828170000_zhudatuan_registration_baseline.sql`（775 行）。
- 审阅方式：逐段人工审阅事务/guard、组织及身份切换、成员权限、专用数据库角色与 RLS、身份通知 job claim、会话解析、一次性 Owner bootstrap、最终断言；交叉检索迁移执行、bootstrap 调用者、JobRunner 和后续会话契约。未连接数据库、未执行迁移或 bootstrap。

## 审计结论

- **G0：保留。** 这是独立 `zhudatuan_registration` 数据库从继承 demo 注册边界前向切换到主打团身份/商城边界的唯一基线迁移；组织闭包、注册政策、商城会员角色、身份停用、数据库权限、审计链和 owner bootstrap 均有明确数据与运行责任，不能因其没有普通应用 import 而删除。
- [FACT][E-AU-590-001] 整个切换置于单一事务和 advisory transaction lock 中；guard 会拒绝组织、闭包、注册政策、商城角色、权限目录和 self role 的冲突状态。旧 demo invitation 被禁用，旧 demo principal/profile/membership/credential/session 被撤销或挂起，注释与 SQL 均明确不删除历史行。
- [FACT][E-AU-590-002] 迁移创建 `tenant-zhudatuan → enterprise-zhudatuan → mall-zhudatuan` 及精确 closure，并把唯一有效注册政策切换为 `registration:zhudatuan:2026-08-28-v1`；商城会员角色只得到 14 项消费者操作权限，支付权限被显式标为高风险并在最终断言中绑定 `payment.intents.create`。
- [FACT][E-AU-590-003] `zhudatuanidentityapi`、`zhudatuanidentityjob` 与 `zhudatuanbootstrap` 均要求非继承、非超级、非 bypass-RLS 专用角色；身份 API / notification worker 使用受限 grant 和 RLS。`runtime.claim_identity_notification_job` 只允许 job role，按 kind/owner、租约过期与 `FOR UPDATE SKIP LOCKED` 领取；`JobRunner` 是仓内实际调用者。
- [FACT][E-AU-590-004] `deployment.bootstrap_zhudatuan_owner` 只允许 bootstrap role、固定数据库和 sentinel；输入仅接受 hash/fingerprint，创建固定 owner 身份、角色和 scope 时写 audit hash chain，并对既有状态作精确幂等校验。仓内 seed 工具的 `BootstrapOwner`、`BootstrapStagingOwner` 与 `Migrate` 实际调用/预检该 function。
- [FACT][E-AU-590-005] 当前运行服务已不使用本迁移定义的 `identity.resolve_session(text)`；2026-09-07 及其后续迁移删除单参数版本、建立 `identity.resolve_session(text,text)`，Commerce 的 `PgAccessResolvers` 也调用双参数版本。因此单参数函数是被数据库迁移历史正式替代的阶段性契约，不是独立的死代码候选。
- [FACT][E-AU-590-006] 后续 `20260829040000_zhudatuan_registration_bootstrap_runtime_repair.sql` 为 one-shot bootstrap 的预检补充三张表的最小 SELECT/RLS policy，并以明确 predecessor checksum 约束修复顺序；这证明基线之后存在已修复的 bootstrap 预检授权缺口。当前文件不得单独重排、截断或删除，否则会破坏后续迁移的前置版本链。

## 边界与未验证项

- 未验证独立注册数据库是否真实以 `shopmigration` 执行、三专用 role 是否已预配置、sentinel 是否轮换、RLS/函数 owner 在真实实例中的最终状态，或 demo 身份是否已成功停用；以上均不能写成已部署事实。
- 未执行切换、owner bootstrap、job claim 或回滚演练；未知实际遗留身份数据、并发登录、通知租约超时和失败重试在该历史 cutover 时的运行结果。
- 该迁移是前向且数据保留式的；恢复需要在后续独立设计中处理撤销/重新授权及审计链，不能以简单回滚 SQL 替代。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本迁移）；不新增 G1/G2/G3/GX。
- 二次复核：无需；若未来要重放独立注册数据库迁移，应由数据库/身份专项复核完整 migration ledger、role provisioning 与真实 RLS 状态。
