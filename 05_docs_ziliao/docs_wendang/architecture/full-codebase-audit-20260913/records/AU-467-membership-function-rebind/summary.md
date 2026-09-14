# AU-467｜Membership 权威函数重绑

- 主审 `20260821060000_rebind_membership_functions.sql`（39 行），并人工反查 session/membership/resource scope/capability consumer；未执行迁移或线上查询。
- 迁移读取五个权威函数定义、确认包含旧表引用后才替换为 `access.membership`。随后全域扫描 identity/access/capability 函数，任何旧引用会 fail-closed，并以 storefront active membership 校验 resolver。
- 这是表迁移后的动态函数修复，不可根据没有静态 import 将其误判为无用。
- **GX-0026**：身份和权限函数迁移，禁止删除、改写或单独重放。未发现新增 P0–P3；未验证全量函数运行、授权权限和恢复演练。
