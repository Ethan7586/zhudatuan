# AU-077｜F-0158 发票 worker 写边界独立复核

- 独立从 migration 序列、CommerceRuntime 与 jobs assembly 重查：早期发票表 grant 被 20260828094000 迁移撤销，仓内没有后续 regrant；jobs workload 的 expected role 仍为 shopjob，processor 仍以 direct SQL 写同一表。
- 迁移的部署断言显式要求 shopjob 无 direct write，且仅有 claim/register/release/finalize/fail 受控函数权限；测试为同一边界构造了 skip 的未实现完成生命周期。
- 两轮结论一致：F-0158 确认为 P1。未发现线上正在发生的事故证据，故不升级 P0；未做修复、安装、运行测试或改变线上状态。
