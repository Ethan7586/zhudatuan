# AU-474｜会话管理与撤销事件

- 主审 `20260821067000_add_session_management.sql`（39 行），并人工反查 SessionTicketOperations、identity session 表、模块事件目录及后续 session-validity 查询；未执行迁移、会话操作或线上查询。
- 迁移发布 member audience 的 session list/revoke operation，绑定既有 `identity.session.read/manage` permission，并登记 `identity.session.revoked` event、capability 和 platform entitlement。registry count、event count、capability 映射与 checksum 均作为迁移断言。
- 当前 handler 先以 active membership/actor 解析 realm account；list 仅返回该 account+realm 的未撤销、未过期 session。revoke 同样受 account+realm 限定，支持单个或 `others`，实际撤销后才发布 revoked event；撤销当前 session 时清理 cookie。后续认证/金融边界还检查 revoked、expiry、credential version 与 access version。
- **G0**：该 operation/event 契约是会话失效与投影链的共同事实。**GX-0031**：身份会话撤销与安全事件发布迁移，禁止删除、改写、跳过或单独重放；需独立复核 event outbox 投递、当前 session token 验证和跨 realm 反事实访问。未发现新增 P0–P3；未验证数据库事务中撤销与 outbox 是否原子、实际消费者和线上 session 失效时延。
