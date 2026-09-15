# AU-773｜Public Mall Checkout PG17 fixture

- 审阅范围：`public-mall-checkout.pg17-fixture.mjs` 与 root test entry。
- 审阅方式：与相邻 PG17 fixture 同构，结构性审阅 Docker lifecycle、fresh replay、Web/Purchase/App/Jobs role DSN 和 cleanup；PublicMallCheckout integration test 本体留在业务测试模块。
- 验证：未运行。入口会创建 Docker PostgreSQL、回放迁移和写入隔离业务数据。

## 审计结论

- **G0：保留。** `npm run test:public-mall-checkout:postgres` 注册此 fixture；它将 catalog/cart/quote/order/payment/shipment/refund 回归测试限制在随机 loopback PostgreSQL 17，测试内 `zhudatuanroot` superuser 仅存在于 disposable container。
- 该 fixture 不包含真实公网、支付、物流或生产授权证据；其结论限于 Commerce integration 的 isolated DB behavior。
