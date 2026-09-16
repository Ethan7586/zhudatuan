# AU-070｜finance 对账差异处置与修复应用入口深审

- `finance.reconciliations.manage` 负责 retry、差异项 resolve/approveitem 与 reconciliation approve；状态条件、scope 和二人分离位于 SQL，approved 后写入稳定 settlement job。
- `finance.reconciliationrepairs.*` 只接受 `INTERNAL_JOURNAL_MISSING` 的 server-authoritative repair；preview/submit/decide/reverse 绑定 idempotency、expected version、preview/request hash，并只委托受管数据库过程；read 使用当前 scope 和 versioned receipt。
- repair wrapper 的 mock 契约测试覆盖严格 body、参数、receipt 和 read scope；但 `ResolveDifference` 没有模块专用行为测试，不能证明 retry/resolve/approveitem/approve 的状态、job 与并发交接。新增 F-0156/P2。未发现 P0/P1；Vitest 未执行（固定审计 worktree 无可执行文件）。
- 实际 SECURITY DEFINER repair workflow 和 PGlite repository integration test 不在本单元覆盖，已保留到 AU-071，防止把应用/数据库结论混合。
