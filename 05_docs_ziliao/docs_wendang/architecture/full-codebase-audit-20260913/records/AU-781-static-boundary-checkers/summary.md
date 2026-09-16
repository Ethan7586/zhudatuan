# AU-781｜静态边界检查器

- 审阅范围：`check/adapters.mjs`、`check/domain-boundary.mjs`、`check/duplicates.mjs`、`check/ownership.mjs`。
- 审阅方式：深读数据库/Redis adapter 探针、节点域边界投影、TypeScript AST 重复检测与 schema-write ownership 规则；相同 AST 扫描和输出骨架只作结构性覆盖。
- 验证：`domain-boundary.mjs`通过；`duplicates.mjs --self-test`通过，但完整检查报告候选；`ownership.mjs`报告127条失败；adapter 未运行，因其明确要求受控 PostgreSQL 和 Redis 测试端点，审计不创建或改变这些外部状态。

## 审计结论

- **G0：全部保留。** `domain-boundary`是 identity node registry、环境投影与跨节点 fallback 的正式只读门禁；`duplicates`以 TypeScript AST 和依赖清单发现候选；`adapters`验证真实 PostgreSQL 队列锁与 Redis lease；`ownership`旨在阻断模块跨 schema 写入。
- **F-0300 / P2：** ownership checker 直接将服务目录首段当作 schema owner，未映射中文/业务目录名。例如 `payment_zhifu` 默认只允许写 `payment_zhifu.*`，但本模块对其自有 `payment.*` 的写入也被判违规；固定基线输出127条，门禁无法区分真实跨域写入与命名映射假阳性。
- **重复检查器边界：** 完整扫描检出大量“同构”候选（例如多个 API 环境 `secureEndpoint`、兼容支付 provider 实现），候选并不等同应合并或应删除。该工具不理解外部 SDK 兼容边界、版本冻结和模块所有权；不产生 G3 结论。
