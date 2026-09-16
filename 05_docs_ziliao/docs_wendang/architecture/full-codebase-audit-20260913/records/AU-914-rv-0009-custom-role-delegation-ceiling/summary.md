# RV-0009｜自定义角色委派上限独立复核

- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`。从权限目录/Console 选择器 → `access.roles.manage` route → custom role 持久化/assignment 重追；未读取线上角色或调用日志。

1. `PermissionCatalog.ts:8-30` 包含 critical `access.role.manage`、`access.scope.manage`、`capability.assignment.manage` 等；`AccessRoleCatalog.ts` 和 `RoleEditor.tsx:61-88,216-243` 将整个目录暴露给可写角色编辑者，无 actor-specific ceiling。
2. `AccessOperations.ts:22-79` 仅要求权限值为字符串数组，再从所有 active code 插入 `access.rolepermission`；没有比较 actor effective permission、风险级别或 Owner-only 集合。
3. `manageRoleAssignment:185-315` 只在 role ID 形如 `role-senior-administrator-v1:` 时要求 Owner；同样关键 permissions 装入任意 custom role 不触发该检查，随后可写 membershiprole/scopegrant/access version。
4. 迁移 `20260902140000...:109-130` 明确将上述关键 permissions 作为 senior administrator 的 Owner-only 治理集，证明其高阶语义已存在但未按 permission content 延伸至 custom role。

**F-0053 确认 P1，高置信度。** 已获 `access.role.manage` 的非 Owner 可创建含其未拥有的高治理权限的 custom role，并按正常 assignment 路径投影给自己或范围内成员；这是可达的权限提升链。未确认线上是否存在可利用角色、entitlement 或实际滥用，故不是 P0。

修复须在最新主线单独进行：先确定可委派集合/治理层级，后在服务端强制 subset/Owner ceiling，并让 Console 选择器与数据库 version/assignment 语义保持一致；已创建越界角色的清理需另立受管数据批次。
