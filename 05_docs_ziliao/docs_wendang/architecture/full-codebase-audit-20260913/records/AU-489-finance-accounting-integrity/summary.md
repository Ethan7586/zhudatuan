# AU-489｜财务会计完整性迁移深审

- 审阅对象：`02_platform_pingtai/database/supabase/migrations/20260828093000_finance_accounting_integrity.sql`（1,741 行）。
- 方法：人工分段审阅 ledger/账户、事件规则、posting/reversal/correction、试算表、期间关闭、子分类账、结算事实、不可变触发器、RLS/grant、历史回填和断言；静态追溯 FinancePort、Settlement Job、Benefit/Voucher/Referral 调用与后续规则迁移。未执行迁移、数据库、队列或线上查询。

## 真实运行与数据边界

业务事件经 `FinancePort.post` 或 Finance Worker 进入 `finance.post`：规则矩阵验证 event type 与借贷账户角色，按 `(scope, reference_type, reference_id)` 幂等建立 posted journal、两条 entry、子分类账投影、试算表和 outbox 事件。`finance.reverse`/`correct` 保留不可变原分录关系；期间控制要求已平、子账一致、事件/任务/对账/提现条件齐备才可关闭。

结算 Worker 以 jobs 身份冻结 settlement line/split；API 身份只可应用已批准调整和平台 split；双角色直接写被撤销。账本、规则、已终态 statement 与子账均有不可变触发器或只读 RLS。后续 Referral 和 supplier four-flow 迁移补充了各自晚加入的 event rule，说明规则矩阵是运行时权威而非注释。

## 评审结论

- **GX-0012（扩展）**：这是法定账本、期间、结算和历史 finance backfill 的事实边界，禁止删除、单独重放或与业务功能修改混合。当前 API/Worker 对 `finance.post`、冻结/支付和读取函数均有静态入口。
- **F-0244 / P2**：`deployment.sandbox_member_welfare_bootstrap`（后续 `20260828180000`）以 `benefit.sandbox.grant` 调用本迁移的 `finance.post`；固定基线中该 event type 没有任何 `finance.accountingeventrule`，因此 `finance.post` 会因 `FINANCE_ACCOUNTING_EVENT_UNSUPPORTED` 中止整个专用沙箱福利初始化。该流程由 `zhudatuansandboxbootstrap` 角色、sentinel 和显式 owner confirmation 限制，未证实是线上常规资金链。
- 未发现 P0。现有历史 journal、试算表、子账、结算、迁移 ledger、备份和恢复方案均未在真实数据库复验。

## 后续验证边界

后续修复只能从最新主线的独立小分支进行：首先确认是否仍需要该 test-only bootstrap；若需要，应令事件规则与调用在同一受控迁移中一致，并在隔离数据库验证初始化原子性、重复调用、账平、审计记录和不影响常规福利。另由独立审计者核验 GX-0012 的历史对账、权限/RLS、期间关闭、提现/结算幂等和恢复演练；本审计分支不改代码或数据库。
