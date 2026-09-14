# AU-287｜Commerce 遥测核心深审

Commerce 遥测由 `commerceTelemetry` 输出结构化 JSON；OperationMetrics 在 HttpApp finally 路径记录操作结果、阶段、时长和错误码，并写入计数/时长指标。DependencyMetrics 仅用于启动期 SecretStore 两次读取，ProviderMetrics 仅由 extension health worker 消费。OperationMetrics 的 HttpApp fixture 验证失败遥测包含操作、节点、realm 和阶段，而不包含 cookie、Bearer、手机号、密码、验证码或 ticket。

启动期 SecretStore 对非成功响应、非法引用和值均只抛固定错误码；因此 DependencyMetrics 记录的启动失败信息不包含其 bearer 或返回的 secret value。ProviderMetrics 记录 extension health 的 provider、状态和 health reason；其 reason 的具体外部供应方内容未连接运行环境验证。无 P0–P3 新问题；本轮为静态审计，未执行缺少依赖的 Vitest。
