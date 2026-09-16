# AU-140｜Purchase 组合 API、支付边界与测试深审

Purchase 是独立部署的 storefront composition：session resolver 先拒绝非 storefront actor，三个 selected module 分别承接 quote、order 和 payment operation。所有跨域数据读取均经 `access.purchase_*` security-definer function；benefit、voucher、external payment 与 payment recovery 都受特定 adapter 边界约束。内部福利支付在 external handler 明确声明非外部 tender 后转入内部 settlement，并记录风险 decision。

新增 F-0174/P2：现有本模块行为测试充分覆盖 internal payment、policy、benefit 和禁用 gateway，但没有直接实例化 quote create 或 order create composition action；route 测试只证明 operation 注册，不能证明 purchase session database function、quote/session/evidence/outbox 写入、过期/版本冲突及 PlaceOrder 的组合边界。未发现 P0/P1；本批不重复执行已知缺失 `vitest` 的定向命令。
