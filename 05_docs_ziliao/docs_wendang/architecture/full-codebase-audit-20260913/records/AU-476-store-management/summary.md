# AU-476｜门店管理范围与授权契约

- 主审 `20260821069000_add_store_management.sql`（124 行），并人工反查 PartnerOperations、事务数据库上下文、`scope_allowed` 的后续重定义和 resource resolver；未执行迁移、数据库查询或线上验证。
- 迁移发布 operator audience 的 store read/manage operation，并将 operation→store scope 特判纳入 `access.resource_scope`。它以 `access.scope_allowed` 约束 direct scope、组织子树与 store partner scope，撤销 public 执行权且仅授予 shopapp。
- 当前 API Transaction 会写入 server-derived `app.scope_id`；门店读、查询、更新和目标 mall 选择均通过 `access.scope_allowed`，同时使用 optimistic version。地址在写入前使用 KMS 加密，读接口仅返回是否已配置，不回传密文。
- 该历史版本在此前 member-scope 函数之后重新定义了 `scope_allowed`；`20260821080000_restore_member_scope_authorization.sql` 明确恢复 member 的自身/商城范围。现有材料没有证明中间版本在线上造成越权，故不把历史语义切换写成 P0/P1；异常 scope containment 的总体风险已在既有 **F-0055/P2** 记录。
- **G0**：门店 API、scope SQL 和数据库上下文仍共同依赖该演进链。**GX-0032**：跨模块授权 resolver/门店数据范围迁移，禁止删除、改写、跳过或单独重放；需独立复核 current function、版本顺序、成员/店铺反事实访问及恢复演练。未发现新增 P0–P3。
