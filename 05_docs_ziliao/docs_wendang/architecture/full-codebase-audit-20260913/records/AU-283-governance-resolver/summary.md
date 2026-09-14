# AU-283｜治理上下文解析器深审

`PgGovernanceResolver` 以已认证 actor、成员和已解析 scope 调用 `access.resolve_authoritative_governance`，拒绝空结果、成员或主体不一致以及无效解析时间，并冻结返回的治理上下文。该上下文进入 `AccessPipeline`，随后被多个 API 运行时注册的管线消费。

数据库函数从正式治理解析结果出发，对 operator 节点上的同一权威 Owner 主体做显式投影，同时保留 `is_exact_owner`，不把普通管理员提升为 Owner。145 行 fixture 直接覆盖 platform/tenant/self/owner 的精确身份、普通管理员、senior administrator、节点 Owner 投影和跨主体拒绝，并对迁移中的权威 Owner 规则进行源级断言。本轮为静态审计，未执行缺少依赖的 Vitest；未发现 P0–P3 新问题。
