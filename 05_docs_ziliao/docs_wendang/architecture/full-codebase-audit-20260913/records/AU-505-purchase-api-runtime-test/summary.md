# AU-505｜Purchase API runtime 测试与启动边界

- 审阅范围：`01_core_hexin/services/commerce/src/bootstrap/PurchaseApiRuntime.test.ts`（110 行）；定向追踪 `PurchaseApiRuntime.ts`（383 行）、`PurchaseApiMain.ts` 与 purchase session resolver。
- 审阅方式：逐段人工阅读测试及对应启动/权限 SQL；静态追踪，未启动 API、数据库、支付回调、KMS 或 Secret Store。

## 真实运行关系

`PurchaseApiMain` → Purchase environment → node manifest/来源域/secret 与 payment binding 校验 → Secret Store 取得 API 连接和 quote key → 可选 WeChat payment configuration/callback host 校验 → `assertPurchaseRuntimeCompatibility` → purchase API container。该 API 的数据库角色仅获经选择的读写权限，显式禁用 finance post、refund/recovery 和关键对象的宽泛更新。Purchase session resolver 在 session 解析后拒绝 Console audience credential。

## 审计结论

- **F-0248（P2，高置信）**：runtime compatibility SQL 查询全局 contract schema version/checksum，但最终 fail-closed 条件遗漏 `state.contract`。这使 purchase API 在 migration head、purchase marker、表、函数和授权均符合、但 contract checksum 不一致时仍可启动并接受购买/支付相关请求。测试覆盖多类角色/权限失败，但没有 contract 失配的拒绝回归。
- manifest 的 checkout/api/storefront feature、origin、secret/payment binding、生产 lifecycle 与 WeChat callback host/scope 校验均有真实运行职责，结论 **G0**。
- 专用数据库权限矩阵与 purchase session audience 拦截均有真实安全边界职责，结论 **G0**；不得仅因 SQL 很长或测试大量 mock 而视为死代码。

## 边界与未验证项

- 数据所有权：API 写入 runtime idempotency/outbox/job、quote、checkout、cart、库存、订单、payment 与 fulfillment 的受限字段；finance 保持禁止边界。实际数据库 grants 未在本单元连接验证。
- 外部契约：WeChat callback 必须落在 node API host 且 scope 必须等于 manifest data scope；实际 DNS、支付平台回调和 endpoint 注册未验证。
- 建议的独立验证：隔离 PostgreSQL 维持其它健康状态、仅篡改 runtime contract checksum，断言 runtime 创建失败且无 API listen/写操作；确认后在独立修复分支把 `contract` 纳入 gate，并加入失败回归。
