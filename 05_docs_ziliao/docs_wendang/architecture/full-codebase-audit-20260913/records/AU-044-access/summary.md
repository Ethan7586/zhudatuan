# AU-044｜settings/members 与 Access 模块深度复核

## 1) 审核范围

- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 目标：从前端 `settings/members` 入口到 `services/commerce` 的 `access` 模块，完整追踪：
  - 模块注册与路由挂载
  - 访问/成员/角色查询链
  - 会员转移与转移凭据验证
  - service 侧能力边界、分页行为与持久化适配
- 核心文件（本批次已覆盖，完整清单见 `files.csv`）：
  - `01_core_hexin/apps/console/src/feature/access/manifest.ts`
  - `01_core_hexin/apps/console/src/feature/access/AccessRoute.tsx`
  - `01_core_hexin/apps/console/src/feature/access/AccessQuery.ts`
  - `01_core_hexin/apps/console/src/feature/access/RoleAccessWorkspace.tsx`
  - `01_core_hexin/apps/console/src/feature/access/MemberAccessWorkspace.tsx`
  - `01_core_hexin/apps/console/src/feature/access/AccessRoleCommand.ts`
  - `01_core_hexin/apps/console/src/feature/access/OwnerTransferPanel.tsx`
  - `01_core_hexin/apps/console/src/feature/access/OwnerTransferDialog.tsx`
  - `01_core_hexin/apps/console/src/feature/access/OwnerTransferQuery.ts`
  - `01_core_hexin/apps/console/src/feature/access/OwnerTransferSchema.ts`
  - `01_core_hexin/services/commerce/src/modules/access/05_interface_jieru/IdentityOperatorAccessModule.ts`
  - `01_core_hexin/services/commerce/src/modules/access/05_interface_jieru/AccessModule.ts`
  - `01_core_hexin/services/commerce/src/modules/access/03_application_yingyong/AccessReadOperations.ts`

## 2) 入口与运行链路

- [FACT][E-AU-044-001] `settings/members` 由 `feature/access/manifest.ts` 注册到 Console 模块入口，再经 `feature/member/MemberRoute.tsx` 挂载 `MemberAccessWorkspace(primary="members")`；`settings/access` 才由 `AccessRoute.tsx` 挂载角色/权限中心。
- [FACT][E-AU-044-002] 成员/角色查询经过统一 `AccessQuery`，前端以 `access.center.read` 发起查询；该查询函数支持可选 cursor。
- [FACT][E-AU-044-003] `AccessReadOperations.ts` 使用 `queryPage(...,500)` + `keysetResult`，返回 `nextCursor`。
- [FACT][E-AU-044-004] 服务侧 `IdentityOperatorAccessModule` 与 `AccessModule` 将 access capability 注册到 commerce runtime，并由 `module.manifest.ts` 声明。

## 3) 一致性复核结论

- [P3][F-0137] `access` 分页的调用方未完全闭环：`AccessQuery.ts` 可带 cursor 调用服务端，但 `ProfileRoute` 与 `RoleAccessWorkspace` 固定请求首屏；`MemberAccessWorkspace` 在 `primary="members"` 模式下也固定 `accessCursor=undefined`，其“下一页”仅推进成员查询 cursor。
  - 当同一 scope 的 access 结果超过 500 条时，个人页、权限中心或成员管理页中用于补充角色/权限的 access 数据可能仅保留首屏；成员基础记录的单独分页不受此结论影响。
  - 该问题不改变服务端写入或权限校验主路径，但可能使大范围目录的角色/权限展示不完整。

## 4) 风险与边界

- 风险性质：P3（可用性/可观测性边界）。
- 影响范围：`settings/members` 与 `settings/profile` 运行时渲染层。
- 当前状态：未进行修复，仅登记为审计问题。
- 复核状态：后续修复前需保持二次复核闭环（P1/P0 门槛除外）。
