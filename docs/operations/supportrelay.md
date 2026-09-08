# 客服实时流运行手册

## 触发症状、用户影响与严重级（Trigger / Impact / Severity）

Redis/Stream 不可用、SSE 断线重连失败、LastEventId 过期、Outbox 实时事件积压、Cursor 写回失败或跨 Scope 事件时触发。权威消息已在 PostgreSQL 持久化，用户仅延迟看到；事件泄露或持久历史缺失为 P0。

## Owner 与前置权限

Support Owner 负责消息语义，Runtime/Reliability 负责 Relay/Redis。诊断需要 Conversation/Event/Outbox/Stream 水位只读权限；重放按 Scope 和 EventId 受审计执行，不读取消息正文除非获支持事件授权。

## 只读诊断（Diagnosis）

核对 PostgreSQL 持久 Event、Sequence/Version/Scope、Outbox、Relay Lease/Fencing、Redis Stream/Cursor/保留窗、SSE LastEventId、连接数/退避和客户端重同步。Redis 不是权威事实，不能以其缺失判断消息丢失。

## 止血（Stop loss）

限制新 SSE 连接和异常 Scope，保留 HTTP 消息写入与历史查询；跨 Scope 立即断开并撤销会话。禁止跳事件、伪造 Cursor、提前标投递或清空 Outbox/Stream。

## 恢复（Recovery）

Redis 恢复后按原 EventId 从 Outbox 重放，发布成功且 Cursor 短事务提交后标实时完成。LastEventId 在保留窗内增量续传；过期返回明确重同步状态，客户端拉 PostgreSQL 权威历史后再连接。重复事件只更新显示，不产生业务副作用。

## 数据核对（Data repair / Validation / Escalation / Audit）

Validation 对齐 EventId、Scope、Conversation、Sequence、Version、Outbox、Redis Cursor 和客户端水位，持久历史完整、重复副作用为 0、正文/成员标识不泄露。Data repair 从 Outbox 重建流；Escalation 跨 Scope/P0；Audit 保存 ID/水位/重试/Trace 不保存正文。

## 回滚边界

Relay/Redis 可重建，持久 Event/Outbox 不回退或删除；已发送事件只追加更正事件。会话撤销后不恢复旧 Token。

## 沟通模板

“客服实时流 `{incidentId}`，Scope `{scope}`，最旧事件 `{oldestAge}`，连接/积压 `{connections}/{depth}`，用户影响 `{impact}`，Owner `{owner}`，证据 `{evidenceRef}`。”

## 关闭条件

持久历史与 Stream 水位追平；断线重连/过期重同步通过；跨 Scope 与正文泄露为 0；积压/连接恢复 SLO；审计关闭。

## 复盘链接（Postmortem）

持久事件缺失、跨 Scope、重连风暴或积压越过 RTO 必须填写 `{postmortemUrl}`。
