# AU-461｜Membership 所有权迁移

- 主审 `20260821054000_move_membership_owner.sql`（16 行），并人工反查 identity、member 与 access 的现行 SQL；未执行迁移或线上查询。
- 迁移将 `member.membership` 转入 `access` schema，并 fail-closed 断言新对象存在、旧兼容对象彻底消失。
- 身份会话、联合身份、凭据安全、成员查询、组织范围和 owner 保护均已直接使用 `access.membership`，故它是实际授权模型而非目录改名。
- **G0**：运行服务依赖新 schema。**GX-0020**：身份/权限核心表迁移，禁止删除、改写或单独重放。未发现新增 P0–P3；未验证真实升级、RLS/grant 和恢复演练。
