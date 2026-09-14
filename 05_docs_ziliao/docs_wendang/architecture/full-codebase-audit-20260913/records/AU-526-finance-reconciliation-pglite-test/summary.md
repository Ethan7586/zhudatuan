# AU-526｜Finance reconciliation PGlite 契约与匹配状态机

- 审阅范围：`01_core_hexin/services/commerce/tests/repository/FinanceReconciliation.test.ts`（590 行）；定向阅读 ReconcileStatement、ResolveDifference 与 reconciliation integrity migration。
- 审阅方式：逐段人工阅读；PGlite test 未执行。

## 真实运行关系

Provider statement object → ReconcileStatement hash/CSV/period validation → transaction stage statement lines → payment/refund/fulfillment/journal candidates match → reconciliation items/summary/difference outbox → operator resolve/approve → settlement job。对账接受任何具 Statement capability 的标准化 provider 输入，所有数据按 scope 隔离。

## 审计结论

- **F-0252（P1，高置信，需独立复核）**：match SQL 对同一 statement line 的多个候选使用 `distinct on(line_id) order by priority,internal_id`，因此按字符串 id 任意选定一个 internal fact。文件中明确存在“歧义 provider reference 不得任意选择”的 skipped test，预期为 `MANY_TO_ONE_UNSUPPORTED` difference；当前实现没有该分支。错误匹配可使 reconciliation item 变 matched，进而影响 approve/settlement。
- **G0**：已启用测试实际覆盖跨 scope statement identity、legacy backfill、internal fact uniqueness、provider normalization、输入金额/税/时间/类型 fail-fast。多个 `it.skip` 证明 tender/partial refund、双向缺失、late evidence、item approval/version 与 ambiguity 尚未得到运行验证，不能被误报为测试已通过。

## 未验证项

- 没有构造真实数据库并发、多条相同 provider reference 或 settlement 下游；P1 需要独立核查 DB uniqueness、payment provider ingestion、operator resolution 与 settlement guard 是否存在其它 fail-safe 层。
