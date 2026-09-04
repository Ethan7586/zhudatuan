# 权限版本会话撤销

`sessionrevocation` 消费 `access.version.changed`，仅撤销目标成员权限版本以前的未结束会话。事件通过 Runtime Inbox 去重；撤销与 Inbox 完成在同一数据库事务中提交，并发布 `identity.session.revoked`。

失败时由统一 Job Runner 按退避策略重试；超过重试上限进入 `runtime.deadletter`。恢复前核对成员、事件版本和最新 AccessVersion，不得手工修改会话版本或跳过 Inbox。
