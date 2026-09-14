# AU-075｜finance 公共能力与模块装配深审

- Finance public capability 仅导出 read/manage；manifest 声明 reporting 依赖、35 个 operation、3 个 published event、http FinanceRoutes 和 reconciliation/settlement/invoice jobs。
- index 公开 manifest、capability、FinancePort 及领域 type；应用注册将 FinanceModule 放入完整 Commerce 模块集，而 Identity 注册单独选取 operator read subset。
- manifest 测试锁定 id/public entry/capability/dependency/layer/entrypoint 和 operation catalog。未发现新的 P0–P3；Vitest 未执行（固定审计 worktree 无可执行文件）。
