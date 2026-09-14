# AU-043｜Console 个人信息页深度复核

## 1) 审核范围

- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 目标：对 Console 个人信息页（`settings/profile`）从入口、查询、会话权限、模型转换、展示与降级态进行运行链路一致性复核。
- 核心文件：
  - `01_core_hexin/apps/console/src/route/ConsoleRouter.tsx`
  - `01_core_hexin/apps/console/src/feature/profile/ProfileRoute.tsx`
  - `01_core_hexin/apps/console/src/feature/profile/ProfileModel.ts`
  - `01_core_hexin/apps/console/src/feature/profile/ProfileRoute.test.tsx`
  - `01_core_hexin/apps/console/src/feature/profile/ProfileModel.test.ts`
  - `01_core_hexin/apps/console/src/feature/profile/profile.css`
  - `01_core_hexin/apps/console/src/feature/profile/profile-access.css`
  - `01_core_hexin/apps/console/src/feature/profile/profile-responsive.css`
  - `01_core_hexin/apps/console/src/feature/access/AccessQuery.ts`
  - `01_core_hexin/services/commerce/src/modules/access/03_application_yingyong/AccessReadOperations.ts`

## 2) 入口与运行链路结论

- [FACT][E-AU-043-001] `settings/profile` 已由 `ConsoleRouter.tsx` 路由树直接挂载：`/scopes/:scopeKind/:scopeId/settings/profile`（lazy import 到 `ProfileRoute`），属于已建的 Console 前端入口之一。
- [FACT][E-AU-043-002] `ProfileRoute.tsx` 通过 `useConsoleContext()` 获取会话/作用域后读取导航入口与会话权限；`permission center` 可见性由 `access.center.read` 显式控制，且查询 key 固定为 `context.scope.kind/id/accessVersion/permission/500`。
- [FACT][E-AU-043-003] `ProfileRoute.tsx` 与 `AccessQuery.ts` 之间是“单次读取 + 客户端静态展示”模型：`readAccess(context, undefined, signal)` 固定不带 cursor，仅固定 `limit=500`。
- [FACT][E-AU-043-004] 服务端 `access.center.read` 在 `AccessReadOperations.ts` 上使用 `queryPage(...,500)` 与 `keysetResult`，会返回 `nextCursor`（当超量命中时），但该 cursor 在当前页未被消费，形成可能的“身份展示边界缺失”风险。

## 3) 关键实现审阅

### 权限与身份映射

- [FACT][E-AU-043-005] `ProfileRoute` 对会话成员身份的展示逻辑是：
  1. 先按 `context.session.permissions.includes('access.center.read')` 决定是否请求；
  2. 在返回列表中按 `membership.id === context.session.membership` 查找当前身份；
  3. `ProfileModel.partitionAssignedRoles` 以 `role:self` 显式排除，并按 `governance` 与 `business` 双分组；
  4. `permissionGroupsOf` 使用 `@shop/authz` 的 `PERMISSION_CATALOG` 做按域分组（去重与排序）。
- [FACT][E-AU-043-006] 无法读取 assignments 时有可见降级提示（“未授权读取”/“正在读取”/“身份列表未返回”），并保持主工作区内容可见。

### 可观测性、展示与样式

- [FACT][E-AU-043-007] 主要文本与卡片逻辑都基于会话和 access 数据构建，含 `current governance`、`membership scopes`、`permission groups`、`scope trail` 等展示入口，文本中可见“未返回/未设置/默认文案”。
- [FACT][E-AU-043-008] 样式按桌面/窄中屏/窄屏/极小屏定义 `profile-access.css` + `profile-responsive.css` 响应规则；`profile.css` 覆盖容器/网格/卡片/降级态与状态文案样式。

## 4) 测试与验证

- [FACT][E-AU-043-009] `ProfileModel.test.ts` 覆盖 governance 与 business 角色分离、名称保留、按目录分组与去重（无外部 mock）。
- [FACT][E-AU-043-010] `ProfileRoute.test.tsx` 覆盖：
  - 正常渲染（中文标题、身份/权限/范围等关键字段）；
  - 空值/无权限/禁用状态下的明确空态提示；
  - CSS 响应规则关键断言（`profile.css` + `profile-responsive.css`）。

## 5) 风险与新增结论

- [P3][F-0137] `access.center.read` 结果为 keyset 分页（支持 `nextCursor`），而个人信息页查询固定单次 `readAccess(context, undefined, signal)`，未消费 `nextCursor`，在大规模成员范围下可能导致“当前会话 membership 不在第一页”时出现身份未命中、身份展示退化为“未找到”。
  - 影响范围：仅影响“个人信息页身份聚合页”的展示准确性；不阻断基础会话/业务入口。
  - 严重度：P3（边界可用性下降；需确认是否已有上层可观测告警）。
  - 复核状态：未执行代码修复，仅登记为审计问题；待 P0 例外门槛之外可按流程归类治理。

未发现 P0 级证据。  
无新增废弃逻辑或可直接删的 G3 候选；`个人信息页`在当前导航与权限链路中仍有明确展示职责。
