# AU-083｜WebBusiness Pricing 读取运行入口深审

独立 `WebBusinessApiMain` 将 `WebBusinessRuntimeModule` 与 `WEB_BUSINESS_MODULES` 启动为 node-local API。`WebPricingModule` 是 selected module，只注册 `pricing.offers.read`；没有规则管理、checkout、下单或支付写入口。

对 storefront actor，`WebBusinessScopeResolver` 将该 operation 解析为由 membership/session 绑定的 mall scope，随后 `WebPricingOperations` 只读该 mall 的有效 pricebook/price。该 SQL 与全量 Commerce Pricing operation 重复且当前逐句一致。现有 scope 与 entry 测试锁定 mall resolver、operation allowlist 和不暴露 checkout/payment route。

未见新 P0–P3。该读取面同样未解释 published pricing rule，所以已确认的 F-0159/P1 同时影响商品显示；本批不产生重复问题。固定审计 worktree 缺少 Vitest，未执行测试。
