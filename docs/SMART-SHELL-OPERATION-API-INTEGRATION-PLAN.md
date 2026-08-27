# 旧 Smart 交互外壳 + 新平台 Operation API 融合实施方案

版本：1.0  
日期：2026-08-24  
状态：待批准实施  
施工基线：`Shop/smart-wing`

## 1. 结论与不可变决策

目标不是让两套后台互相跳转，也不是把 `t` 嵌进 `smart`，而是生成一套新的 Console 制品：

- 用户继续使用旧 `smart` 熟悉的 Header、Sidebar、驾驶舱、抽屉、弹窗和商城装修交互。
- 页面数据和所有业务动作只调用新平台 `@shop/sdk` 的 Operation。
- 新 Commerce API 和新领域数据库是唯一业务事实源、唯一写入源。
- `t.hbbtzn.com` 只用于灰度验收；通过验收后由融合 Console 接管 `smart.hbbtzn.com`。
- 旧 Smart API、PostgREST、旧数据库只作为迁移源和限期回滚资产，不提供生产写入。
- 旧会话不转换、不复制；切换后统一使用新平台 `target=console` 会话重新登录。

以下方案一律禁止：iframe、共享 `.hbbtzn.com` Cookie、新旧 API 自动回落、新旧数据库双写、浏览器直连数据库、继续调用 `/api/v1/admin/*`。

## 2. 当前边界

### 2.1 线上边界

```text
smart.hbbtzn.com
├─ 旧 Smart 静态后台
└─ 旧 Admin API / PostgREST / legacy DB

t.hbbtzn.com
├─ /          新 Console
├─ /login/    新 Auth
└─ /api/      新 Commerce Operation API / 新 DB
```

`t` 已完成运行时分离，但目前把 Console、Auth、API 临时压在一个域名下。正式形态应恢复分域：

```text
smart.hbbtzn.com  ── 新融合 Console
auth.hbbtzn.com   ── 新 Auth
api.hbbtzn.com    ── 唯一 Commerce API
t.hbbtzn.com      ── 灰度验收，最终退出生产写路径
```

### 2.2 代码基础

以下能力已经存在，不重新开发：

- `apps/console/src/app/ScopeShell.tsx`：旧 Header、Sidebar、账号安全、工单、命令面板和 Step-up 外壳。
- `apps/console/src/app/ShellNavigation.ts`：旧工作台与新平台 station 的映射。
- `apps/console/src/app/routes.tsx`：Platform、Distributor、Enterprise、Mall 新路由。
- `apps/console/src/services/adminBff/transport.ts`：旧交互组件调用新 Operation 的适配入口。
- `apps/console/src/features/dashboard/api/CockpitApi.ts`：旧驾驶舱读取新 reporting、catalog、inventory、order。
- `apps/console/src/services/adminBff/mallApplications.ts`：旧商城编辑器适配新 Experience Operation。

仓库内其他历史副本、备份和 `pre-contract-*` 目录只作取证参考，不作为编译或部署源。实施前先把当前候选工作树固定为可复现的分支、Commit、Contract Hash 和 Schema Head，禁止直接从未固定的脏工作树发布。

## 3. 目标前端结构

```text
App
└─ 新 identity.session.read
   └─ ScopeShell（旧 Smart 交互外壳）
      ├─ Header / Sidebar / Command / Drawer / Modal
      ├─ Scope Selector：Platform / Distributor / Tenant / Enterprise / Mall
      └─ Domain Pages
         └─ adminBff compatibility adapter
            └─ @shop/sdk CommerceClient
               └─ OperationCatalog + Contract 1.0.0
                  └─ api.hbbtzn.com
```

### 3.1 前端硬规则

1. 页面和旧组件不得拼 URL；只传强类型 `OperationId`。
2. GET 必须携带服务端认可的 Scope；浏览器 Scope Hint 只能作为提示，服务端必须重新解析资源范围。
3. 写操作必须带 `Idempotency-Key`；并发更新必须带 `If-Match`/`expectedVersion`。
4. 菜单、按钮和服务端必须同时执行 Scope + Permission + Capability 校验。
5. Critical 操作必须走新平台 Step-up，不能复用旧验证码或旧管理员口令。
6. 所有异步页面具备加载、空态、错误、重试和重复提交防护。
7. 保留旧 Smart 的信息架构和操作反馈；颜色、字号、圆角、间距统一使用 `@shop/design` 和现有 VI Token，不复制旧页面的硬编码样式。
8. `src/pages` 只编排；业务适配放 `src/features` 或 `src/services`；单个可维护源码文件不超过 300 行。

## 4. 导航与功能映射

| 旧 Smart 工作台   | 融合后的主路由                                               | 新平台主要 Operation                                                                                                                    | 实施动作                                                                                                 |
| ----------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 经营驾驶舱        | `/enterprises/current/dashboard`、`/malls/current/dashboard` | `reporting.dashboard.read`、`reporting.sales.read`、`catalog.listings.read`、`inventory.availability.read`、`order.orders.read`         | 直接复用现有 `CockpitApi`；每张卡片独立做组合权限门禁，不能只检查 Dashboard 权限后并发调用全部 Operation |
| 平台中控          | `/platform`、集团/商城设置                                   | `organization.layers.read`、`benefit.*`、`risk.*`、`audit.records.read`                                                                 | 中控治理拆到平台与设置；不得把旧 `control` 语义错误地映射成客服 Support                                  |
| 分销管理          | `/distributors`                                              | `channel.distributors.read/create`、`channel.quotas.manage`、`catalog.pools.allocate`                                                   | 保留旧列表/弹窗，改为真实 Distributor，补组织开通入口                                                    |
| 甲方商品池/渠道   | `/channels`、`/platform/pools`                               | `channel.connections.*`、`channel.syncruns.*`、`channel.operations.*`、`catalog.pools.*`                                                | 用新 Provider 健康、同步和失败重放替换旧登记数据                                                         |
| 商品治理          | `/enterprises/current/products`、`/malls/current/products`   | `catalog.pools.read`、`catalog.products.*`、`catalog.listings.*`、`pricing.rules.*`                                                     | 复用旧筛选/批量交互，所有写入改 Operation                                                                |
| 订单履约          | `/enterprises/current/orders`、`/malls/current/orders`       | `order.orders.read/export`、`order.aftersales.*`、`fulfillment.*`、`payment.refunds.request`                                            | 复用旧订单表、详情抽屉、售后审核和发货交互                                                               |
| 集团应用/商城装修 | `/enterprises/current/applications`、`/malls/current/design` | `experience.applications.*`、`experience.bindings.manage`、`experience.versions.*`                                                      | 使用已适配的旧商城编辑器；补首应用创建、Mall/Pool/Domain 绑定、发布 Step-up 和版本冲突提示               |
| 卡券运营          | `/enterprises/current/vouchers`、`/malls/current/vouchers`   | `voucher.cardlibraries.*`、`voucher.programs.*`、`voucher.reserves.*`、`voucher.batches.*`、`voucher.status.*`、`voucher.redemptions.*` | 旧页面只保留交互；数据、审批、发券和冲正全部使用新券域                                                   |
| 财务对账          | `/enterprises/current/finance`、`/malls/current/finance`     | `finance.overview/entries/statements/reconciliations/settlements/withdrawals/periods.*`、`invoice.*`                                    | 替换旧内存差异数据；金额统一整数分，审批强制 Step-up                                                     |
| 成员权限          | `/enterprises/current/settings`、`/malls/current/settings`   | `member.members.read`、`identity.invitations.*`、`access.roles.manage`、`access.scopes.manage`                                          | 只复用旧视觉和交互，按新 keyset/read-write schema 重写 Adapter；显示授权版本                             |
| 员工资格          | 同上                                                         | `qualification.center.read`、`qualification.policies.manage`、`qualification.decisions.preview`                                         | 保留策略与模拟交互；旧审批、回滚、逐员工更新若无正式 Operation 必须隐藏                                  |
| 客服工单          | `/enterprises/current/support`、`/malls/current/support`     | `support.cases/messages/assignments/agents/accounts/rules/slas.*`                                                                       | 用新客服域替换旧本地 Case 状态；Header 的 Case Center 接通前必须隐藏                                     |
| 供应商/伙伴       | `/channels`、设置页、独立 Supplier App                       | `partner.partners.*`、`channel.connections.*`                                                                                           | Console 负责平台治理，供应商自助继续使用 Supplier App；不在旧后台复制供应商业务状态                      |
| 系统治理          | `/platform`、设置页                                          | `risk.*`、`notification.*`、`audit.*`、`identity.sessions.*`                                                                            | 保留旧治理入口，按新权限拆分动作；旧 AI 分类、HR 同步没有正式 Operation 时显式禁用                       |

### 4.1 页面完成定义

一个页面只有同时满足以下条件才算完成：

- 旧 Smart 的核心交互流程可用，深链接、刷新、回退和 Scope 切换不丢状态。
- 页面源码不存在旧 Admin URL、PostgREST、Supabase 管理密钥或旧会话依赖。
- 成功、空、校验失败、401、403、409、Step-up、服务端失败和重试状态都有验收。
- 所有写动作有幂等键；有版本资源使用 `expectedVersion`；成功后读回权威结果。
- 有 Permission 无 Capability、或有 Capability 无 Permission时，菜单隐藏且 API 拒绝。
- 组件测试、旅程测试、合同测试、权限负例和生产构建通过。

### 4.2 开工前 P0 修复

以下是现有融合代码的已确认问题，必须在扩展功能前修复并加回归测试：

1. `order.aftersales.read` 的合同权限是 `order.aftersale.read`，集团/商城售后视图当前误写为 `order.read`。
2. `benefit.grants.create` 的合同权限是 `benefit.grant`，当前 UI 动作误写为 `benefit.grant.create`。
3. `experience.applications.create` 必须提交 `code + publicSlug + name`；`copy` 还必须提交 `reason`。当前通用表单字段不足，不能直接执行。
4. 驾驶舱同时调用多个 Operation；必须按每张卡片的 Permission + Capability 决定是否调用，不能因一个次要卡片无权让整页失败。
5. `ShellNavigation` 中 `control → groupsupport/mallsupport` 的映射需改为 Platform/Setting 治理；客服使用独立 Support 入口。
6. Case Center、AI 分类、HR 同步、旧资格审批/回滚等未接正式 Operation 的入口必须隐藏或标明未接入，禁止用本地状态伪装完成。

## 5. 必须先补的组织与商城开通能力

现有新平台只能创建 Distributor，不能通过正式 Operation 创建 Tenant、Enterprise、Mall；新商城发布还要求存在 Application 与 Mall/Pool/Domain Binding，但目前没有公开 Binding 写 Operation。这两项共同构成“创建后即可装修、发布和运营”的硬阻塞。

### 5.1 新增合同

不提供任意 kind 的通用建树接口，新增四个有明确边界的命令：

| Operation                         | 路径                                                           | 父节点要求                               | 权限                                       |
| --------------------------------- | -------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------ |
| `channel.tenants.create`          | `POST /api/v1/channels/distributors/{distributorid}/tenants`   | Distributor                              | `channel.binding.manage`，Critical         |
| `organization.enterprises.create` | `POST /api/v1/organizations/tenants/{tenantid}/enterprises`    | Tenant                                   | `organization.layer.manage`，Critical      |
| `organization.malls.create`       | `POST /api/v1/organizations/enterprises/{enterpriseid}/malls`  | Enterprise                               | `organization.layer.manage`，Critical      |
| `experience.bindings.manage`      | `PUT /api/v1/experiences/applications/{applicationid}/binding` | Application + Mall + active Pool Binding | 新增 `experience.binding.manage`，Critical |

`channel.tenants.create` 在同一事务中创建 Tenant 组织节点、闭包边和 `channel.tenantbinding`。另外两个命令调用统一的 `OrganizationPort.createChild`，在同一事务中完成：

1. 校验父节点种类、状态和调用者 Scope。
2. 服务端生成稳定 ID，禁止客户端指定数据库 ID。
3. 插入组织节点及自身/祖先 Closure。
4. 写入 `organization.change` 和统一 Operation Audit。
5. 返回节点 ID、父 ID、kind、version。
6. 相同幂等键重试返回同一结果；同键不同请求拒绝。

`experience.bindings.manage` 接收 `mall`、`pool`、`domain`，并校验 Application Scope、Mall kind、Mall 对该 Pool 的有效挂载、Domain 格式和唯一性。成功后才能进入装修版本发布。首应用创建表单必须严格提交 `code`、`publicSlug`、`name`；复制还必须提交 `reason`。

### 5.2 代码改动位置

1. 在 `packages/contract/definitions/operations.yml` 添加四个 Operation，并在权限目录增加 `experience.binding.manage`；Tenant/组织创建追溯 `MVP03/MVP04`，Experience Binding 追溯 `MVP06/MVP15`。不要手改生成文件。
2. 运行 `npm run generate --workspace @shop/contractgen`，生成 OpenAPI、OperationCatalog、SDK 和 Controller 清单。
3. 扩展 `services/commerce/src/modules/organization/OrganizationPort.ts`，增加受父子矩阵约束的 `createChild`。
4. 在 `OrganizationOperations.ts` 实现 Enterprise/Mall 命令。
5. 在 Channel 模块实现 Tenant + Channel Binding 原子命令。
6. 在 Experience 模块实现 Application + Mall/Pool/Domain Binding 命令。
7. 新增数据库迁移发布 Operation、Permission、Capability 和默认 Platform Owner Grant；不得修改历史迁移。
8. 在 Console 新增 `features/provisioning` 和“组织开通向导”，逐步调用并显示可恢复进度。
9. 修复 4.2 的权限码、表单字段、组合门禁和导航映射。
10. 增加合同、集成、权限、旅程、幂等、Closure 与 Experience 发布不变量测试。

### 5.3 本次组织树实际操作

组织开通向导固定执行：

1. Platform Scope 下调用 `channel.distributors.create` 创建“优业”。
2. Platform Scope 下调用 `channel.distributors.create` 创建“喜悦会”。
3. 选择“优业”，调用 `channel.tenants.create` 创建“鸿泰业务租户”。该技术层对普通集团/商城运营隐藏，但平台安全管理员可见。
4. 选择该 Tenant，调用 `organization.enterprises.create` 创建“鸿泰集团”。
5. 选择“鸿泰集团”，两次调用 `organization.malls.create`，创建“鸿泰惠民通”和“鸿泰甄选”。
6. 为每个商城选择已授权商品池，调用 `catalog.pools.allocate/attach`；没有有效商品池时向导不得继续。
7. 为每个商城调用 `experience.applications.create`，提交合规的 `code`、`publicSlug`、`name`。
8. 调用 `experience.bindings.manage` 绑定 Application、Mall、Pool 和 Domain，再创建初始装修版本。
9. 通过邀请、Role 和 Scope Operation 配置各级管理员；不按手机号或姓名猜测归属。

## 6. 分阶段实施

| 阶段            | 交付物                                                                     | 写入源                 | 晋级门禁                                                                |
| --------------- | -------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------- |
| G0 基线冻结     | 唯一代码基线、功能清单、Contract/Schema/Release Hash、旧新库快照和恢复证据 | 现状                   | 快照可恢复；候选分支可重复构建                                          |
| G1 融合壳收敛   | 旧 Shell + 新 Session/Scope/Routes/SDK；完成 4.2 P0 修复和旧 URL 静态检查  | 新平台测试库           | Console 测试、类型、构建通过；零旧 API 调用；权限码与合同一致           |
| G2 组织开通     | 四个缺失 Operation、组织向导、请求中的实际组织树和两个可发布商城应用       | 新平台测试库           | Closure、Channel/Experience Binding、审计、幂等、Step-up 和越权负例通过 |
| G3 核心运营     | 驾驶舱、商品、订单、商城装修、成员资格                                     | 新平台测试库           | 核心旅程和跨 Scope 负例通过                                             |
| G4 高风险域     | 卡券、福利、支付、退款、财务、供应商、客服                                 | 新平台测试库           | 金额、券余额、日结、Provider 和审计对账通过                             |
| G5 `t` 灰度     | 签名 Release 部署到 `t`；5%→25%→50%→100% 组织白名单                        | 新平台生产库           | 401/403/409/5xx、P95、队列、审计和业务验收达标                          |
| G6 数据迁移     | 需要保留的旧组织、成员及业务事实一次性迁移和对账                           | 每域切换前旧、切换后新 | Count/Hash/金额/状态/父子关系零差异                                     |
| G7 `smart` 切换 | `smart` 新 Console、独立 Auth/API、旧服务只读隔离                          | 新平台生产库           | 完整登录与交易冒烟；旧公网 API 不可达                                   |
| G8 稳定观察     | `t` 退出生产写路径，旧服务停用，保留限期快照                               | 新平台生产库           | 完成一个业务周期和一次财务日结                                          |

灰度必须按账号和组织白名单，不按浏览器随机流量：Platform 内部账号 → 优业 → 鸿泰集团 → 鸿泰惠民通 → 鸿泰甄选及其他组织。

## 7. 旧数据迁移

前端融合不等待旧数据迁移：G1-G5 直接展示新平台数据。只有确认需要保留的旧业务事实才进入 G6。

迁移顺序固定为：

```text
Organization/Closure/SourceBinding
→ Principal/Membership/Role/Scope
→ Partner/Catalog/Inventory/Experience
→ Qualification
→ Order/Fulfillment/Payment
→ Voucher/Benefit
→ Finance/Audit references
```

规则：

- 旧 ID 与新 ID 使用不可变映射，优先写入 `organization.sourcebinding`；不得按名称合并。
- 每个业务域切换时先关闭旧 Command、任务和消费者，排空 Inbox/Outbox/Job 后记录 Watermark。
- 迁移使用同一快照、显式字段、UTC 时间和整数分；禁止 `select *`、随机 ID 或当前时间伪造历史。
- 一个业务域在任何时刻只有一个写入方；旧 API 切换后只读或返回 410。
- Reporting、搜索和缓存从新事实重建，不迁移浏览器缓存。

## 8. 权限与安全验收矩阵

| 身份                   | 自身范围   | 子范围             | 平行范围        | 其他 Distributor/Tenant | Platform            |
| ---------------------- | ---------- | ------------------ | --------------- | ----------------------- | ------------------- |
| Platform Operator      | 按权限允许 | 按权限允许         | 按权限允许      | 按权限允许              | Critical 需 Step-up |
| 优业 Distributor Admin | 允许       | 允许其后代         | 仅显式授权      | 拒绝                    | 拒绝                |
| 鸿泰 Tenant Admin      | 允许       | 允许鸿泰集团及商城 | 拒绝平行 Tenant | 拒绝                    | 拒绝                |
| 鸿泰集团 Admin         | 允许       | 允许两个所属商城   | 拒绝平行集团    | 拒绝                    | 拒绝                |
| 商城 Admin             | 允许本商城 | 仅商城内资源       | 拒绝另一商城    | 拒绝                    | 拒绝                |
| 普通员工               | 仅本人资源 | 拒绝运营资源       | 拒绝            | 拒绝                    | 拒绝                |

每种身份必须额外验证：

- 无 Permission、有 Capability：拒绝。
- 有 Permission、无 Capability：拒绝。
- Explicit Deny 与 Allow 同时存在：拒绝。
- Scope Grant 未生效、已过期或 `accessVersion` 过期：拒绝。
- Critical 操作没有有效 Step-up：拒绝。
- 浏览器伪造 Scope、Role、Tenant、Mall 或父子路径：服务端忽略并反查。
- 旧 Smart Cookie 调新 API、新 Cookie 调旧 API：均拒绝。
- 未登录为 401；已登录但越权为 403；不存在与无权资源不能泄露可枚举差异。

## 9. 测试与质量门禁

开发增量按以下顺序执行：

```bash
npm run generate --workspace @shop/contractgen
npm run test --workspace @shop/console
npm run typecheck --workspace @shop/console
npm run test:contract
npm run test:integration
npm run test:journey
npm run test:security
npm run build:console
npm run quality
```

另外增加一个 CI 静态门禁，保证 `apps/console/src` 不出现：

```text
/api/v1/admin
PostgREST 管理路径
Supabase service role
旧 admin session 名称
t.hbbtzn.com 硬编码
```

浏览器验收至少包含：登录、退出、刷新、深链接、Scope 切换、组织开通、商品上下架、订单发货、装修保存/校验/发布/恢复、邀请成员、权限变更、Step-up、越权拒绝和服务端失败恢复。

## 10. 部署与切换

### 10.1 `t` 灰度制品

构建参数：

```text
VITE_API_BASE_URL=https://api.hbbtzn.com
VITE_AUTH_BASE_URL=https://auth.hbbtzn.com
VITE_CLIENT_VERSION=<SemVer Release ID，例如 1.0.0-rc.1>
```

- 从 CI 生成签名、带 Hash 的 Release Bundle；生产服务器不现场编译。
- 静态 Hash 资源长期 immutable；HTML 和 release pointer 不缓存。
- 原子切换 release pointer，保留上一套完整制品。
- `t` 只给验收白名单；不得形成第二套长期正式后台。

正式配置必须同步修改：

- `infrastructure/aliyun/delivery.yml` 的 Console canonical host 改为 `smart.hbbtzn.com`；`console.hbbtzn.com` 如保留，只做页面跳转别名。
- 灰度期 `API_ALLOWED_ORIGINS` 精确包含 `smart`、`auth`、`t` 和正式业务端域名；稳定后删除 `t`，禁止 `*`。
- `AUTH_RETURN_TARGETS.console=https://smart.hbbtzn.com`。
- Cookie 保持 Host-only；继续校验 `shop_session`、`shop_csrf` 和 CSRF Header，不扩大到 `.hbbtzn.com`。
- `smart` 只承载 SPA 和静态资源，不在同一 `/api/v1` 下混接新旧合同。

### 10.2 正式切换顺序

1. 固定 Release、Commit、Contract、Schema 和制品 Hash。
2. 验证新旧数据库快照真实可恢复。
3. 如需迁移，开启维护状态、停旧 Command、排空队列并完成对账。
4. 验证新 API 的 startup/live/ready、CORS、Session、CSRF 和 Scope。
5. 部署独立 Auth 和融合 Console，但暂不接正式流量。
6. 用平台、分销、Tenant、集团、两个商城账号完成正负例冒烟。
7. 原子切换 `smart.hbbtzn.com` 到融合 Console。
8. 从 `smart` 删除旧 `/api/v1/admin/*` 和 legacy API 公网路由。
9. 吊销旧后台会话，要求新平台重新登录。
10. 观察 401、403、404、426、5xx、P95、Inbox/Outbox/Job、审计和核心业务指标。
11. 稳定后让 `t` 页面跳转 `smart`；`t` 的 `/api/*`、`/health/*` 返回 404/410，不转发写请求。
12. 观察期结束后停止旧服务写权限和自启动，旧库保留加密快照至回滚期结束。

切换后必须确认 `smart.hbbtzn.com/api/ready` 不再返回 legacy 表信息而是 404；新健康检查只允许从 `api.hbbtzn.com/health/ready` 读取。旧 API、PostgREST 和路径代理只能监听服务器回环地址。

## 11. 回滚条件

以下任何一项出现即停止晋级并冻结新写：

- 任意跨 Tenant、跨 Distributor、跨集团或跨商城数据泄露。
- 新旧两边同时成功写入同一个业务动作。
- 重复扣款、退款、发券、核销，订单/库存丢失，券余额不守恒或财务借贷不平。
- 数据 Count、Hash、整数分金额、状态或父子关系对账不一致。
- 关键写操作缺失 Actor、Scope、Reason、Trace 或审计记录。
- 5xx 超过 1% 或旧基线两倍，P95 超过旧基线两倍，队列持续积压。

新写尚未开放时可撤回路由并恢复上一制品。新写已经开放后必须先冻结、保存 Watermark，再使用匹配的应用制品和整库快照回滚；不得只回滚前端，也不得把双写当作回滚方案。

## 12. 工作包与顺序

| ID         | 工作包                                                      | 依赖                      | 产出                                               |
| ---------- | ----------------------------------------------------------- | ------------------------- | -------------------------------------------------- |
| BASE-01    | 固定唯一候选分支与基线证据                                  | 无                        | Commit、Contract/Schema/Release Hash、快照恢复记录 |
| FE-01      | 收敛 ScopeShell、导航和新 SDK 调用门禁                      | BASE-01                   | 可构建的融合 Console；零旧 URL                     |
| FIX-01     | 修复权限码、商城表单、驾驶舱门禁和中控导航                  | BASE-01                   | 4.2 六项 P0 缺陷回归测试                           |
| API-ORG-01 | 新增 Tenant/Enterprise/Mall 与 Experience Binding Operation | BASE-01                   | 合同、处理器、权限、迁移、审计、测试               |
| FE-ORG-01  | 组织与商城开通向导                                          | API-ORG-01、FE-01、FIX-01 | 可创建完整组织树、商品池挂载及两个可装修商城应用   |
| FE-CORE-01 | 驾驶舱、商品、订单、商城装修                                | FE-01                     | 日常运营核心闭环                                   |
| FE-GOV-01  | 成员、角色、Scope、资格、系统治理                           | FE-01                     | 权限治理闭环                                       |
| FE-RISK-01 | 卡券、福利、财务、客服、供应商                              | FE-CORE-01                | 高风险业务闭环                                     |
| QA-01      | 合同、集成、旅程、安全和浏览器矩阵                          | 上述工作包                | 自动化与验收证据                                   |
| REL-01     | `t` 灰度 Release                                            | QA-01                     | 5/25/50/100% 验收记录                              |
| MIG-01     | 需要的数据迁移与对账                                        | REL-01                    | ID 映射、Watermark、对账报告                       |
| CUT-01     | `smart` 原子切换和旧服务隔离                                | REL-01、可选 MIG-01       | 正式融合后台与可回滚证据                           |

估算：一名前端、一名后端和一名 QA/Ops 并行时，核心可操作版本约 5–7 个工作日；包含卡券、财务、迁移演练和正式切换约 12–18 人日。任何阶段只有门禁通过才能进入下一阶段。

## 13. 最终验收结果

完成后必须能够现场演示：

1. 从 `smart.hbbtzn.com` 使用新身份登录。
2. 看到旧 Smart 风格的外壳、导航、驾驶舱和商城编辑体验。
3. 在平台范围创建优业、喜悦会。
4. 在优业下开通鸿泰业务租户和鸿泰集团。
5. 在鸿泰集团下创建鸿泰惠民通、鸿泰甄选，并完成各自商品池和 Experience Binding。
6. 给不同管理员分配 Scope 后，只能看到和操作自己的组织子树。
7. 商品、订单、装修、卡券、财务、成员、资格和客服全部调用新 Operation API。
8. 旧 Admin API 不再被浏览器调用，旧数据库没有新的业务写入。
9. 每个关键写入均可从 Audit 追溯 Actor、Scope、Operation、Reason、Trace 和结果。

这九项全部通过，才可以宣布“旧 Smart 交互外壳 + 新平台 Operation API”完成。
