# AU-620｜Identity Notification Challenge Job 修复

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260901070000_identity_notification_challenge_jobs.sql`（47 行）。
- 审阅方式：逐行人工审阅 head guard、job predicate/reclassification/assert；交叉检查 RegistrationOperations producer、JobRunner dedicated claim、Identity Notification job processor 与 challenge RLS。未连接数据库或执行迁移/任务。

## 审计结论

- **G0：保留。** 此 migration 修复历史 queued identity challenge job 的 kind，使其重回专用 worker 和挑战 secret/delivery RLS 访问链。
- [FACT][E-AU-620-001] 仅在 registration database、精确 predecessor、无 future head 时执行；只更新 owner=identity、queued、payload 精确为单一 existing challenge 的历史 `notification` job。
- [FACT][E-AU-620-002] RegistrationOperations 当前直接生产 `identitynotification`；JobRunner 对该 kind 调用 `claim_identity_notification_job`，processor 拒绝 generic/mixed/untrusted payload，故迁移是历史兼容修复而非多余重命名。
- [FACT][E-AU-620-003] identity job 对 challenge/secret/delivery 的 RLS 绑定 running `identitynotification` job，错误 kind 会使专用 worker/RLS 链失配；assert 拒绝残余 queued legacy challenge job。

## 未验证项

- 未回放 legacy job、真实 worker claim/retry/deadletter 或通知 provider 投递；线上是否存在被修复 job 未验证。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本迁移）；不新增 G1/G2/G3/GX。
- 二次复核：无需；新 notification job kind 必须同时检查 producer、claim function、processor payload gate 和 challenge RLS。
