# AU-472｜邀请生命周期与注册政策绑定

- 主审 `20260821065000_add_invitation_lifecycle.sql`（70 行），并人工反查 invitation create/revoke、member invite 读取、`access.resource_scope` 演进及后续 scope-hint 迁移；未执行迁移、数据库查询或线上验证。
- 迁移将历史 `member.invite` 补齐 label、创建时间、registration policy、terms hash、version，并以非空、长度、版本与 registration-policy 外键约束固化；任何无法绑定政策的历史记录会使迁移失败而非静默继续。
- 它同时发布 operator audience 的 create/revoke operation，赋予由既有 `member.invite`/`member.read` 派生的 invitation-manage 权限和 capability entitlement。当前 create 重新读取有效 policy、写入绑定值；revoke 和 member read 仍读取 invite 的状态/version/组织范围。后续 resolver 又为 create/revoke 分别定位组织或 invitation 所属范围，并增加 scope-hint 优先规则。
- **G0**：invite 行保存可追溯的条款/政策与实际授权范围。**GX-0029**：邀请身份、条款同意与授权数据的历史规范化，禁止删除、改写、跳过或单独重放；需独立复核历史 policy 选择、scope 迁移和恢复演练。未发现新增 P0–P3；未验证历史 invite 是否都能关联真实 policy、运行时 RLS 与 invitation 接受链路。
