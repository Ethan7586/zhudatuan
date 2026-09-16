# AU-069｜finance 结算审批、调整与快照验证深审

- `finance.settlements.adjust` 以 settlement 版本和 draft 状态锁定 adjustment/settlement/line；申请和决定人不能相同。获准调整先更新金额和版本，再固化 adjustment facts、版本化 snapshot 与事件。
- `finance.settlements.decide` 仅对不同申请人、匹配版本的 draft settlement 执行；批准前重新派生并核对结算来源、规则、行、分账、已批准调整及 active snapshot，随后记账、标记 platform split paid 并写出事件。
- PGlite 测试对调整后 snapshot、规则/来源/冻结行篡改、late-payment 排除、最终计提和时区 recognition time 进行了真实数据库验证。定向 Vitest 未执行：固定审计 worktree 没有可执行 `vitest`；未安装依赖或改变运行状态。
- 未发现新的 P0–P3；已有结算/对账测试缺口 F-0151 仍适用于 AU-064 所列 job，而不适用于本批已覆盖的 close 链路。
