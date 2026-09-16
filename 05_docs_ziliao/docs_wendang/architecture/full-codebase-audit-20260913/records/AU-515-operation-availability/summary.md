# AU-515｜OperationAvailability 节点 feature 与就绪门

- 审阅范围：`01_core_hexin/services/commerce/src/foundation/security/OperationAvailability.ts`（61 行）及同名 test（63 行）；定向追踪所有 API runtime 注入、AccessPipeline gate 和现有 contract error 记录。
- 审阅方式：逐段人工阅读、静态调用追踪；未启动节点 API 或读取部署 manifest。

## 真实运行关系

所有主要 API runtime 将 `NodeOperationAvailabilityResolver` 注入 AccessPipeline。对每个 operation，resolver 从 OperationCatalog module 和 actor target 推导 feature 集，在 server-resolved manifest 上逐项检查；随后 resource gate 至少要求 active lifecycle、resource binding、runtime config 和 release pointer 非空，失败返回 `RESOURCE_NOT_READY`。

## 审计结论

- **G0**：identity/catalog/checkout/orders module→feature 映射、console 补加 console feature、未知/非 console module 默认 identity feature，均由实际 API 运行时和 AccessPipeline 使用；测试覆盖声明 feature 缺失及将 operation/resource 交给可替换 readiness adapter。
- 默认 readiness adapter 当前只实施“节点总体发布就绪”而非资源类型级探测：其接口保留 operation/resource 给专用 adapter，但默认实现仅检查 manifest 生命周期和三类引用存在。这是明确的当前语义，静态证据不足以声称为缺陷；后续资源专属 readiness 设计应另行审计。

## 未验证项

- 未读取真实 active node manifest、release pointer 或 Resource binding，未验证停用/缺失状态的端到端 503 行为。
