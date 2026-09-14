# AU-072｜finance 财务概览读取深审

- `finance.overview.read` 从 authenticated scope 的组织闭包内所有 account 汇总，仅连接 `state='posted'` 的 journal；按会计科目方向分别计算资产、负债、收入、费用与 cash，并返回每币种 journal watermark。
- PGlite 测试构造 posted/draft/reversed journal，验证后两类不计入概览，且 bigint 金额按 decimal text 返回。
- 未发现新的 P0–P3；固定审计 worktree 无可执行 `vitest`，因此没有运行该定向测试或改变运行状态。
