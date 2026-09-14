# AU-478｜平台 Owner 门店管理权限授予

- 主审 `20260821071000_grant_store_administration.sql`（19 行），并人工反查 PartnerOperations、capability/rolepermission 解析、平台 Owner 后续角色演进；未执行迁移、数据库查询或线上验证。
- 迁移为 `role-platform-owner-v2` 增加既有 `partner.read` 与高风险 `partner.manage` allow，并断言 manage 授权实际存在。该权限正是 AU-476 发布的 organization store read/manage operation 的 capability 输入。
- 当前 AccessPipeline 先解析 membership capability，缺少 operation 则拒绝；获得 capability 后，PartnerOperations 仍通过 `access.scope_allowed` 限制门店查询、更新与 target mall。高权限角色不是绕过资源范围 SQL 的直接通道。
- 后续平台 Owner 迁移继续对 rolepermission 作精确增删并对可用 operation 断言，说明这是特权角色版本链而非可重建的冗余映射。
- **G0**：此映射使平台 Owner 可实际调用已发布的门店管理契约。**GX-0034**：平台 Owner 特权角色授权演进，禁止删除、改写、跳过或单独重放；需独立复核 current allow/deny 合集、owner membership、scope 限制和审计记录。未发现新增 P0–P3；未验证真实 owner 权限、capability 查询或线上操作日志。
