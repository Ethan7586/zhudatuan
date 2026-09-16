# AU-674｜Identity Notification Node Routing

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260909160000_route_identity_notifications_by_node.sql`（68 行）。
- 审阅方式：逐段人工审阅 dedicated claim function、lease 条件与 privilege；反向检查 JobRunner claim 分支、Identity notification runtime/node manifest guard 和 central/node worker tests。未启动 worker 或调用生产队列。

## 审计结论

- **G0：保留。** central Identity notification worker 与 node-scoped worker 使用互斥领取路径：central claim 只处理 null/non-node scope，node worker 仅按精确 node scope 领取。
- [FACT][E-AU-674-001] dedicated function 的 candidate 条件排除 `scope_id like 'node:%'`，只允许 `zhudatuanidentityjob` 且限制 batch/lease；使用 `FOR UPDATE SKIP LOCKED` 与 lease deadline 重取保证并发 worker 不重复领取。
- [FACT][E-AU-674-002] JobRunner 在 identity notification 且无 scope 时调用专用 function；传入 scope 的 node runtime 改用精确 scoped SQL。两条 SQL 选择范围互不重叠。
- [FACT][E-AU-674-003] runtime tests 分别验证 central 不调用通用 claim、node worker 不调用 dedicated claim，且 node manifest 必须为 active identity-enabled operating Mall 并使用自身 secret namespace。

## 未验证项

- 未运行实际两个 worker 并发抢占同一 backlog，未验证数据库 lease timeout 后的重领时序。
- 未查看线上 node scope job backlog，未知是否存在未被任何 node worker 配置领取的 `node:%` job。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（Identity notification central/node worker routing）；不新增 G1/G2/G3/GX。
- 二次复核：否。
