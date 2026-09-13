# AU-011｜`@smart-wing/authz` 兼容权限决策内核

## 1. 唯一目的与边界

本单元只审固定基线中 `@smart-wing/authz` 的全部四个文件，以及它与 `@smart-wing/api-contract`、兼容 Commerce API、Membership RPC、资源 Scope RPC 和发布入口的第一层接缝。它不与 `@shop/authz` 合并，不把两套同名能力推定为等价，也不审全部兼容业务 handler。

- 固定基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`。
- 审计分支开工检查点：CP-10 `2555fbacc832731070d6e20f4938ad3c6525c247`。
- 纳入：4 个文件/267 行、5 个公开符号、8 个关键函数、13 个测试用例、86 条兼容 permission、2 个直接源码调用者、13 个授权 wrapper 路由消费者和兼容数据库投影接缝。
- 排除：`@smart-wing/api-contract` 全包深审、Commerce API 全部 handler、线上数据库/流量、修复、删除、依赖安装、推送、合并和部署。

## 2. 覆盖与真实地位

- [FACT][E-AU-011-002] 4/4 文件、267/267 行完成逐文件与逐关键逻辑深入审阅；其中 83 行生产实现、159 行测试、25 行配置/清单，均为人工维护。
- [FACT][E-AU-011-003] 包公开 `HIGH_RISK_PERMISSIONS`、`isActiveMembership`、`requiresStepUp`、`decide`、`can` 五个符号；仓内只有 `decide` 被两个兼容 Commerce API 源文件直接导入，其余公开面没有包外静态调用。
- [FACT][E-AU-011-004] 当前正式发布图没有加载受保护的兼容 API router：Storefront Worker只加载 `routePublicRequest`；旧 `admin-server.cjs` 被 delivery forbiddenInputs 明确禁止；deployment checker把 `commerce-api` 列为 retired。该包仍被 workspace、根 tsconfig、兼容 build 脚本、Commerce API 清单和测试源码保留，因此不是已验证可删除代码。

本单元新增 P3 3 项、G1 1 项；没有 P0、P1、P2、G2、G3 或 GX。全仓累计为 P0 0、P1候选 8、P2 34、P3 19、NIT 1；G0 2、G1 11、G2 0、G3 0、GX 1。

## 3. 真实运行关系

~~~mermaid
flowchart LR
  CONTRACT[@smart-wing/api-contract\n86 permissions] --> AUTHZ[@smart-wing/authz]
  COOKIE[签名 Session] --> RPC[api_resolve_session_membership_context]
  RPC --> MEMBER[Membership + bindings]
  MEMBER --> WRAP[commerce-api auth.ts]
  DBROW[资源行 Scope RPC] --> WRAP
  WRAP --> AUTHZ
  AUTHZ --> DECISION[AuthorizationDecision]
  DECISION --> ROUTES[13 个兼容路由消费者]
  ADMIN[adminServer.ts] --> AUTHZ
  RELEASE[当前 release policy] -. 禁止旧 admin 制品 .-> ADMIN
  STOREFRONT[Storefront Worker] --> PUBLIC[routePublicRequest only]
~~~

[FACT][E-AU-011-005/006] 兼容链使用 `public.memberships/public.permissions/public.role_permissions/public.membership_scopes`，由 session-bound RPC 投影单一 Membership；资源型订单、售后和商品路由通过 security-definer RPC加载 Scope。正常判定顺序为 membership active/expiry → explicit deny → permission allow → tenant/global binding筛选 → critical step-up → binding存在 → allow。

[FACT][E-AU-011-007] 兼容数据库的 custom role 与 membership assignment 实现会验证非Owner不能授予超出自身有效权限的角色，并验证每个 Scope 在actor可授范围内。这是与 F-0053 对照后值得保留的治理设计，但不等于两套数据库模型可以互换。

## 4. 两套 Authz 的边界

- `@smart-wing/authz`：86 条 permission、20 类、25 critical；Permission 与 Membership 类型来自 `@smart-wing/api-contract`；数据来自 `public.*` 兼容表；无 access version 参数，版本在进入判定前由 session/runtime resolver核对。
- `@shop/authz`：184 条 permission、33 类、54 critical；自身目录包含 scope 与 step-up 元数据；数据来自 `access.*` canonical投影；生产由7个 Commerce runtime的AccessPipeline分阶段调用。
- 两个目录只共享 8 个 code，分别有 78 和176个独有 code；共享 code 中 `order.create`、`order.export`、`member.read`、`audit.read` 的 risk也不一致。名字相近不构成等价替代、迁移完成或删除证据。

## 5. 已确认问题

| 编号 | 等级 | 结论 |
| --- | --- | --- |
| F-0060 | P3 | 包有159行/13用例测试和独立tsconfig，但package没有test/typecheck脚本；根 `test:unit`、`typecheck` 使用 `--workspaces --if-present`，会静默跳过本包 |
| F-0061 | P3 | 公开 `stepUpMaxAgeSeconds` 没有有限值/上限约束；实际源码反事实中 `Infinity` 使26年前的step-up通过。现有两个生产源码caller都未传该选项 |
| F-0062 | P3 | critical permission在确认binding存在前检查step-up；错误Scope先得到 `STEP_UP_REQUIRED`，完成step-up后才得到 `SCOPE_MISMATCH`，形成误导挑战顺序 |

同时补强既有 F-0032：`HIGH_RISK_PERMISSIONS` 是公开可变 Set。隔离进程删除 `order.refund` 后，同一Membership在无step-up时从拒绝变为允许。当前发布图未加载该兼容受保护路由，且仓内没有mutation caller，因此不升级严重度。

## 6. 测试可信度

- 13个测试覆盖 self、deny、store/department、tenant mismatch、enterprise ancestor、platform跨租户、全局grant选择、非层级path、critical step-up和过期step-up。
- 缺口包括 inactive/expiry边界、permission missing、future/exact step-up、mutable critical Set、异常最大窗口和challenge-before-scope。
- 定向源码探针确认：expiry等于now拒绝；900秒整允许，更旧和未来拒绝；explicit deny优先；删除critical Set成员会关闭step-up；Infinity窗口会接受旧验证；错误Scope的critical请求先返回challenge。
- 正式 `npm run test --workspace @smart-wing/authz` 与 `npm run typecheck --workspace @smart-wing/authz` 均因缺少脚本失败；没有安装依赖，也没有另造一个正式测试入口。

## 7. 删除与 UNKNOWN

- DC-0013/G1：包与兼容Authz链当前无正式生产运行入口，但仍有两个直接源码caller、独立公共API、兼容数据库契约、手工兼容build和唯一13用例规格；不满足G3。
- [UNKNOWN] 仓外是否加载该private workspace或手工生成的兼容制品。
- [UNKNOWN] 线上是否仍有任何历史主机运行旧 `admin-server.cjs`；本AU没有连接线上，只能证明当前仓库发布策略禁止它。
- [UNKNOWN] 86条兼容permission及`public.*`权限表的正式退役计划；删除前必须与canonical迁移、历史回滚和数据责任一起定稿。

## 8. 检查点结论

AU-011完成的是兼容Authz的代码健康、真实调用边界和退役状态档案，不是清理或修复。没有修改生产代码、测试、配置、迁移、依赖、锁文件或生成物，没有改变线上状态，也没有推送、合并或部署。CP-11后只执行检查点只读复核和Codex Security安装状态核验；AU-012不在本检查点启动。
