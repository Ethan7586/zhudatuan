# AU-311｜Compatibility 会员权限命令中心

会员运行时只从 active membership、未撤销角色、有效 allow override 和有效 deny override 计算；角色授予相加，显式 deny 最终覆盖，且权限/范围变更会触发 `authz_version` 失效。命令中心路由先检查 member/role 读取权限；PII 投影仅在 `member.pii.read` 通过时请求，数据库还以 actor 的 tenant、enterprise、mall 范围过滤可见会员与可授予的范围选项。

访问变更禁止自改和 Owner 目标/角色，委派管理员不得授予超出自身有效权限或自身范围的角色与 scope；更新角色、scope 和 deny 均记录原因、操作人、授权证据及审计日志。状态变更同样禁止自改且以单独的 offboard 权限区分离职操作。路由测试覆盖前置拒绝、PII 参数、step-up、自改与离职权限边界。

本 migration 对 distributor、brand、store 的早期保留 scope 会在后续 `custom_role_center_and_full_scopes` 迁移中由数据库验证器接通，故不构成现行不一致。未发现新增 P0–P3；因审计工作树缺少 Vitest 依赖，未运行测试。
