# AU-479｜控制台成员命令与密码验证

- 主审 `20260821072000_add_console_member_commands.sql`（38 行），并人工反查 member-manage 与 password-verify handler、治理解析、会话撤销及 assurance 写入；未执行迁移、成员命令或线上查询。
- 迁移发布 operator `identity.members.manage` 和 member `identity.password.verify`，新建高风险 `member.manage` permission 并授予 platform Owner，同时登记 capability/entitlement 和 registry 完整性断言。
- 当前 member-manage 先锁定目标 membership 且以 `scope_allowed` 限制范围；目标为 owner 只能由 exact owner 操作，目标为 senior administrator 只能由 owner 操作。状态离开时会到期角色/范围授予、撤销 override、禁用相关 invite、递增 access version 并撤销会话；资料/部门更新也撤销会话。
- password verify 仅选当前 account+realm 的 active password credential，成功后把 assurance 绑定当前 actor/session/account/realm，十分钟过期，并只提高当前未撤销 session 的 assurance level。
- **G0**：成员生命周期、session invalidation 和 step-up assurance 皆依赖此 API/permission/capability 契约。**GX-0035**：成员特权管理与密码 assurance 历史发布，禁止删除、改写、跳过或单独重放；需独立复核事务原子性、owner target 反事实、会话撤销以及日志脱敏。未发现新增 P0–P3；未验证真实 RLS、异步 event/outbox 或线上密码验证频率限制。
