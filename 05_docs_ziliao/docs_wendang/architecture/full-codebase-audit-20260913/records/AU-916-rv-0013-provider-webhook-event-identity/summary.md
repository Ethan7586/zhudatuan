# RV-0013｜Provider Webhook 事件身份独立复核

- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`。从公共 webhook route → provider port type/HMAC verifier → `channel.accept_webhook` 去重与 job 创建重新取证；未调用公网 webhook 或读取生产 inbox。

1. `ApplyWebhook.ts:15-47` 读取 `x-provider-event-id` 为 `external`，并将其作为 provider context requestId/idempotencyKey、KMS context、SQL `accept_webhook` 参数和审计资源。
2. `ProviderWebhookRequest` 只有 headers/body/receivedAt；generic `PortFactory.ts:36-53` 的 HMAC 精确签名 `${timestamp}.${body}`，不接收或覆盖 event ID。
3. `channel_lifecycle.sql:6-59` 以 `unique(connection_id, external_id)` 去重，并以 external ID 派生 inbox/job ID；只要 external ID 改变，即插入新 inbox/job，后续 `ChannelWebhookJob` 还会发出新的 outbox event。

**F-0094 确认 P1，高置信度。** 持有一份仍在 5 分钟窗口内的合法签名请求者可保持 timestamp/body/signature 不变、替换 event ID，从而绕过持久去重并制造新的渠道事件链。未确认任一 provider 已启用通用协议、存在攻击者或下游已造成资金/履约影响，故不是 P0。

修复必须在最新主线按 provider 协议单独设计：将 event ID 纳入认证内容、从已签正文派生稳定 ID，或增加经签名内容哈希的去重；覆盖改 ID、同 ID 异 body、并发和合法重试，不可盲目统一所有 provider。
