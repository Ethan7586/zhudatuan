# AU-138｜Catalog 风险决策、SKU 查询与迁移测试深审

风险拒绝由 Risk Worker 的 `riskscan` 专用 job 读取决策后，在同一事务内撤销仍为 published 的 listing 并写唯一的 outbox 事件；`decision` 实为 risk decision id，因而 outbox 幂等键按决策而非按文字原因隔离。SKU 查询仅由 inventory import runtime 使用，按 SKU id/code 与 product owner/source-listing scope 限定可见性。两项 PGlite migration fixture 与 manifest 测试直接验证索引和供应网络数据事实。

未发现 P0–P3 新问题。定向 Vitest 已按项目既有入口尝试，但审计 worktree 未安装依赖，`vitest` 不存在（退出 127）；该运行失败只记录为未验证，不改变静态调用结论。
