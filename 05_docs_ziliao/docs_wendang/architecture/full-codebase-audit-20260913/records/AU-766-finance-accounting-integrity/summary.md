# AU-766｜财务会计完整性验证

- 审阅范围：`finance-accounting-integrity.mjs`。
- 审阅方式：深入审阅 posting、金额安全边界、trial balance/subledger、append-only reversal/correction、period control、reconciliation/event/job/settlement dependencies、函数 EXECUTE boundary 与异常断言。
- 验证：未运行。函数要求 fully replayed database，且会写入大量 finance/channel/runtime fixture 数据；当前审计工作树也缺内部 dependency link。

## 审计结论

- **G1 / DC-0084：** 仓内启动者未确认，但它是高价值 PostgreSQL 行为规格，不能按无引用删除。
- 测试精确覆盖 CNY、最大安全 minor、幂等、反转/更正不改源 journal、闭账禁止新 posting、控制面 ready 条件、subledger/general ledger 一致性与权限拒绝；不覆盖真实渠道对账数据、长期 ledger、并发锁争用或生产角色配置。
