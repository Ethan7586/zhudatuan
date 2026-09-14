# AU-078｜finance 发票完整性迁移与集成测试深审

- 迁移用 SECURITY DEFINER create/cancel/decide/red、immutable snapshot triggers、claim、artifact、finalize/release/fail 构成 API/job 分离的发票生命周期；原始与红票均由 frozen settlement lines、profile snapshot、source hash、action proof、版本和 owner scope 重建。
- 迁移的 `claim_issue` 会在外部调用前检查 scope 和 snapshot，持有 90 秒 claim；`register_issue_artifact` 将过期 claimant 标记 orphan；`finalize_issue` 将 document/outbox/status/artifact 一并核验和完成。
- PGlite repository test 已验证迁移 installation、direct write rejection、受控 request/decision/fail、claim race/orphan、税额约束；但 job 调用 claim/finalize、跨 scope、snapshot、red、outbox 和 deadletter 的真实端到端 cases 保留为 `it.skip`。这直接支撑既有 F-0158/P1；未新增 P0–P3。
