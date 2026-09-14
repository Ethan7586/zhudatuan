# AU-465｜成员端操作受众契约

- 主审 `20260821058000_align_member_operations.sql`（31 行），并人工反查 capability audience、后续 resource scope 与各模块入口；未执行数据库或线上查询。
- 迁移将 17 个购物到库存读取动作设为 member audience，并以精确数量与 runtime contract checksum 断言结果。
- 该 audience 并非展示标签：后续 access resource-scope 函数以其确定成员个人 scope，实际影响路由鉴权和资源解析。
- **G0**：各业务 API 已注册。**GX-0024**：跨域授权契约迁移，禁止删除、改写或单独重放。未发现新增 P0–P3；未验证逐操作终端身份、权限和前端兼容性。
