# AU-855｜Owner 邀请与身份重置规格审阅

- 审阅日期：2026-09-15
- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 范围：`membership-permissions/06-TIERED-MULTITENANT-OWNER-INVITATION-SPEC.md`、`07-OWNER-IDENTITY-RESET-SPEC.md`，共 2 个文件、301 行。
- 方法：深入审阅身份/成员/位阶/Scope 分层、Root Owner 保护、邀请码一次展示与双 Membership 原子注册、身份重置事务及验收矩阵；独立追查 operation 契约、Senior Administrator 权限投影、数据库迁移、CredentialOperations 与测试。

## 结论

06 号规格将 Principal/Profile 与 Membership/Role/Scope 分开，要求管理员邀请和短信 OTP 分离，并把角色/Scope 变更、事务与失效边界写为服务端约束。07 号规格将身份重置限制为精确 Root Owner，要求 subject tombstone、会话/挑战撤销、同一 subject advisory lock 与全事务回滚。

审阅中曾发现 Senior Administrator 迁移含 `identity.registration.reset` 文本；独立复核确认该权限位于 owner-only 排除/断言列表，未授予 Senior Administrator。当前 `CredentialOperations` 还在执行路径要求 `governance.isExactOwner`。因此没有证据表明该规格被后续实现放宽。

两份规格均为 G0。未发现新增 P0–P3；未运行测试、构建、数据库、部署或外部控制面动作，也未修改业务代码、配置、测试、工作流或运行资源。
