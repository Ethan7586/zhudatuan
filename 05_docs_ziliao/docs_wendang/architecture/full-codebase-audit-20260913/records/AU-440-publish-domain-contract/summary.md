# AU-440｜领域 API、权限与运行契约发布

## 范围与方法

- 主审文件：`02_platform_pingtai/database/supabase/migrations/20260821029000_publish_domain_contract.sql`（897 行，文件头标明由 canonical operation/event catalogs 经 `@shop/contractgen` 生成）。
- 交叉核对：contract/OpenAPI 目录、Commerce operation 注册及运行时 inbox/outbox、lease、scope resolver 和 private channel 调用链。
- 本批为生成物语义、关键 security-definer 函数和调用关系审阅；未重建生成物、执行数据库重放、构建、测试或线上操作。

## 运行结论

迁移发布跨领域 operation 路径、事件版本、permission、role、capability 与 entitlement 的一致目录，并将 runtime inbox/outbox 事件外键绑定到版本化 event 契约。OpenAPI 和 Commerce 的 operation catalog 持续以同一 operation/scope resolver 标识消费这些契约。

关键运行函数包括：失效凭据/会话防护的 `identity.resolve_session`；基于资源和会员身份的 scope 解析；按 entitlement、allow/deny role 权限计算的 capability operation 集；可重放 inbox 接收；限时 token lease；以及带 payload hash 冲突检测的 provider webhook 接收。private channel 函数将目录、库存、订单、退款、追踪和对账封装为带范围及幂等保护的适配器接口。

## 审计结论

- G0：正式 API/事件/权限/能力及运行数据库契约发布，不是删除候选。
- 文件为自动生成迁移，但其中 security-definer scope/session/lease/webhook 语义已人工阅读；任何源 catalog 或生成器变更须以生成物、OpenAPI、SDK 和数据库契约的一致性专项复核。
- 后续迁移扩展 `resource_scope` 的资源类型及权限边界；不得把初始函数与当前函数差异直接视为无用实现。
- 本批未新增 P0–P3；未运行权限绕过、租约竞争或回调重放验证。
