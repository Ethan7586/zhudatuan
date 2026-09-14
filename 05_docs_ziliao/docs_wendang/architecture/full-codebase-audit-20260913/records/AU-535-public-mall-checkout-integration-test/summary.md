# AU-535｜Public Mall checkout PostgreSQL 集成测试

- 审阅范围：`01_core_hexin/services/commerce/tests/repository/PublicMallCheckout.test.ts`（589 行）；定向阅读三个主场景、runtime DB role boundary、fixture lifecycle。
- 审阅方式：逐关键逻辑人工阅读；需要五个 PostgreSQL endpoint，本轮未执行。

## 真实运行关系

Web role browse/catalog/pricing/inventory → owner cart → purchase role quote/order/payment → payment job → fulfillment → refund job；同一测试还验证 wrong-mall listing 拒绝、RLS tenant line 写拒绝、authority tables closed 且 purchase role 只有三类 projection function。

## 审计结论

- **G0**：这是少数跨五个 DB role、模块 operation、job processor 和 RLS 的 purchase E2E integration test；mock gateway/risk/audit 仅隔离外部 provider/observability，核心持久化链实际使用 PostgreSQL。
- **F-0255（P3，高置信）**：random fixture 在 beforeAll 写入 organization/identity/access/catalog/pricing/inventory/cart/checkout/order/payment/fulfillment 等事实；afterAll 仅关闭 pools/admin，未见对称 cleanup。重复运行会持续污染 shared test database，风险高于 AU-533 的单身份 fixture。

## 未验证项

- 未运行 endpoint-gated chain；真实 payment provider、KMS、risk/audit、HTTP auth、external webhook 和外部 harness DB reset 责任未验证。
