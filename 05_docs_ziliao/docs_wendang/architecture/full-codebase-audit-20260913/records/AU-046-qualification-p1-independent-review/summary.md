# AU-046｜F-0138 资格策略并发写入独立复核

## 独立复核路径

本次不复述 AU-045 的页面审阅，而是从 HTTP 输入、幂等边界和同类写入实现重新追踪。

1. `OperationController.operationInput` 将 `If-Match` 解析为 `request.input.expectedVersion`；只有契约标为 required 时才拒绝缺失值，因此 optional 的含义是“可不带，但带了必须由业务操作决定”。
2. `ExecutionKernel.operationRequestHash` 会把 expectedVersion 纳入幂等请求哈希；不同 idempotency key 的两个请求不会互相去重。
3. 同为 optional 条件版本的 `PartnerOperations` 将 expectedVersion 放入 SQL `where (... version=$n)`，零行返回即 `VERSION_CONFLICT`，证明当前代码库的可选版本约定是“携带即参与并发控制”。
4. `qualification.policies.manage` 不读取 expectedVersion；其 upsert 只按 policy id/scope 串行更新，并无 active_version 条件。两个不同幂等键、相同 If-Match 的管理请求均可成功，第二个请求成为 active_version。

## 复核结论

- F-0138 结论一致，升级为 P1（高置信度）：临界资格策略写入存在可复现的无冲突覆盖路径。
- 不是 P0：固定基线未提供正在发生事故、实际并发写入或线上数据损失证据；本次也未连接数据库或线上。
- 修复、数据回滚、策略下线均未执行。建议将未来改动拆为一个只处理 qualification 策略条件版本的独立修复批次，并在隔离数据库使用两个不同幂等键的并发 fixture 验收。
