# AU-516｜RiskGate 风险结果契约

- 审阅范围：`01_core_hexin/services/commerce/src/foundation/security/RiskGate.ts`（19 行）；定向追踪 AccessPipeline、PurchaseOperations、risk adapters 与所有 API runtime 注入。
- 审阅方式：逐段人工阅读与静态调用追踪；未执行风险数据库函数或生产请求。

## 真实运行关系

Web/console/catalog/provisioning/identity/purchase API runtime 创建各自 risk adapter 并注入 AccessPipeline/container。授权链在 feature/capability/resource gate 之后调用 `evaluate`；`allow` 继续，`challenge` 映射 step-up、`review` 映射人工风险复核、`deny` 映射风险拒绝。购买支付动作也直接复用同一 fail-closed mapping。

## 审计结论

- **G0**：RiskGate 是 adapter 边界和 DI token，而不是空抽象；四种 outcome 的固定错误契约让业务 API 不依赖具体 risk provider。非 allow 统一拒绝，未见默认放行分支。
- `safeReason`/`decision` 是风险 adapter 的返回契约；此基础类型不决定具体速度、金额、名单或 signal 策略，不能只凭它未含规则实现判为无用或安全缺陷。

## 未验证项

- 未读取 risk adapter 实际数据库/外部规则，也未验证 challenge/review 的前端流程、decision audit、重试和可观察性；各 adapter 单元后续单独审计。
