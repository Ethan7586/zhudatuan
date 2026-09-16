# AU-527｜Finance settlement write boundary PGlite 测试

- 审阅范围：`01_core_hexin/services/commerce/tests/repository/FinanceSettlementWriteBoundary.test.ts`（305 行）；定向追踪 finance accounting integrity migration 的 grants/functions。
- 审阅方式：逐段人工阅读；PGlite replay 未在本轮执行。

## 真实运行关系

Approved reconciliation → settlement fact freeze（shopjob/jobs/scope gate）→ immutable journal/entry/ledger/subledger/settlement lines/splits → app adjustment function 与 job payment functions 分工 → payment split state。数据库拒绝 app/job 直接写金融事实，也拒绝 service_role 直接篡改。

## 审计结论

- **G0**：test 实际核对 table privileges、function privileges、role/workload/scope context、direct write rejection、freeze idempotency、adjustment stale calculation、late evidence exclusion以及 partner/platform split paid。该回归测试是财务事实边界的核心规格，不能删。
- 写入能力按 app/job 函数分配，并非所有 finance table 都只读：adjustment/withdrawal 有受控允许。这是有意的责任边界，不应被误报为越权。

## 未验证项

- PGlite 与真实 PostgreSQL privilege/RLS/function SECURITY DEFINER 仍可能不同；未执行 migration replay、外部支付或真实 settlement worker。
