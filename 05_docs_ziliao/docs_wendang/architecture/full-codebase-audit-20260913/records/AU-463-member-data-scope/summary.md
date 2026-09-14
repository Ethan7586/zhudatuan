# AU-463｜成员数据范围授权

- 主审 `20260821056000_authorize_member_data_scope.sql`（30 行），并人工反查 member API、access membership 与后续 resource-scope/RLS consumer；未执行数据库或线上查询。
- `access.scope_allowed` 接受当前授权 scope、其组织下级，或 active membership 所属成员本人/组织及该组织下级；不允许祖先或兄弟范围。函数以 security definer 运行且依 session setting 的 scope/membership。
- 成员资料、地址、导入读取和多处 RLS 使用该共同判断，因此它是个人数据访问控制的当前基础，不是静态辅助函数。
- **G0**：运行接口与 RLS 依赖它。**GX-0022**：隐私/授权核心迁移，禁止删除、改写或单独重放。未发现新增 P0–P3；未验证真实 session setting、全量 RLS consumer 与恢复演练。
