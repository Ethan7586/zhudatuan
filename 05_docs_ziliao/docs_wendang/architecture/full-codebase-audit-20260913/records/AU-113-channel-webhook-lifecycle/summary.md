# AU-113｜Channel Webhook 接收与异步处理深审

本审计点覆盖 provider Webhook HTTP 入口、connection 上下文与 provider resolver、验签/规范化、KMS 原文加密、数据库 inbox/job 原子写入，以及 Worker 对 provider operation、tracking job 和 outbox 的处理。

`channel.accept_webhook` 对 `(connection_id, external_id)` 去重，并仅在首次写入时投递 stable job；Worker 以行更新 claim，已 applied/ignored 的重复 job 直接结束。真实路由与 `app/jobs.ts` 均已交叉确认。

先前 F-0094/P1 候选在此链复查中保持：通用 verifier 的认证材料不包含 event ID，而该 ID 是数据库去重键。没有新增 P0/P1。现有 Channel 测试仍仅为 manifest 静态目录，已归入 F-0167/P2；未运行 Vitest。
