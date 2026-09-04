# zhudatuan 全架构审计

> 审计日期：2026-09-01  
> 审计对象：`/Users/Ethan/Desktop/Projects/zhudatuan/main` 当前工作区  
> 审计方式：只读目录盘点、关键配置交叉核对、仓库内置架构闸门实跑、TypeScript 类型检查  
> 说明：当前 `main` 已被 Ethan 明确判定为失效主线；本文用于提炼旧系统资产与问题，不把它认定为新系统基线。

## 一、总论

`zhudatuan` 不是“没有架构”，而是同时存在太多套架构，而且彼此冲突。

它拥有很强的业务内核、合同系统、数据库完整性设计、Provider 扩展模型和测试资产；但仓库真值、前端体系、数据库轨道、质量闸门与部署模型已经失去统一。

当前最准确的判断是：

> `zhudatuan` 是一个很强的业务设计与工程资产库，但已经不是一个可靠的软件主线。

## 二、当前实际架构

```text
Console
  → @shop/design / @shop/sdk / @shop/contract
  → services/commerce
  → Canonical PostgreSQL / Redis

Auth Web
  ├→ Canonical Identity API
  └→ Compatibility REST API

Storefront
  ├→ @shop/sdk
  ├→ @smart-wing/api-contract
  ├→ 本地 MOCK 状态
  └→ 内嵌 services/commerce-api Worker
       → Compatibility PostgreSQL

JobsMain
  → 33 个任务
  → Outbox / Provider / Finance / Notification

Provider/Vendor Extensions
  → 京东、天猫、餐饮、鲜花、蛋糕、支付等外部系统
```

这不是一套完整架构，而是以下四套体系叠在一起：

1. `@shop/*` Canonical 目标体系。
2. `@smart-wing/*` Compatibility 历史体系。
3. Hard-cut 审计脚本描述的未来体系。
4. 当前 ECS、Caddy、PM2 和预览环境形成的实际运行体系。

## 三、总体评价

| 维度 | 评分 | 结论 |
|---|---:|---|
| 业务领域覆盖 | 8/10 | 模块全面，业务理解深 |
| 合同与 SDK | 9/10 | 当前最成熟、最值得保留 |
| 后端模块化 | 6/10 | 外形清楚，内部直接写库严重 |
| 数据库设计 | 6/10 | 完整性强，但复杂度失控 |
| Console | 7/10 | 三套前端中最成熟 |
| Storefront | 4/10 | 多设备重复、Mock 与双合同混杂 |
| Auth Web | 3/10 | 页面和网络逻辑高度集中 |
| VI 系统 | 5/10 | Token 基础不错，但存在多套视觉体系 |
| 测试资产 | 7/10 | 数量与类型丰富，但闸门互相冲突 |
| 部署与交付 | 3/10 | 文档模型与实际运行模型不一致 |
| 仓库治理 | 1/10 | 当前最大问题 |
| 当前可交付性 | 2/10 | TypeScript 和多个核心闸门均失败 |

## 四、主要优点

### 4.1 领域划分完整

`services/commerce` 已划分约 31 个领域模块，包括：

- Identity
- Access
- Organization
- Member
- Capability
- Catalog
- Pricing
- Inventory
- Cart
- Checkout
- Order
- Payment
- Fulfillment
- Finance
- Channel
- Referral
- Benefit
- Voucher
- Support
- Notification
- Risk
- Audit
- Reporting
- Extension

后端模块注册器具备：

- 显式模块依赖。
- 缺失依赖检查。
- 循环依赖检查。
- 注册顺序计算。
- API 与 Jobs 工作负载分离。

这是可以提炼到新系统的好设计。

### 4.2 合同体系成熟

当前实际包含：

- 242 个 Canonical Operations。
- 206 个 Capability。
- 60 个事件。
- 1,738 个错误定义。
- 213 个 OpenAPI Path。
- 242 个 OpenAPI HTTP Method。
- 自动生成 SDK、OpenAPI、事件与错误合同。

Operation 同时描述权限、风险、幂等、并发版本、Step-up、数据范围和需求来源。

实际审计中，Generated Artifacts、Operation、Event、Provider、Extension 和 Job 检查均可通过。

### 4.3 后端横切处理能力完整

Canonical API 已形成统一处理链：

```text
请求
→ 路由匹配
→ 合同版本
→ 身份
→ 权限与数据范围
→ 风险与二次验证
→ 幂等
→ Expected Version
→ Operation Handler
→ 数据库事务
→ 审计、事件与指标
```

设计意图正确，比普通 CRUD 后台成熟。

### 4.4 Provider 扩展模型成熟

扩展系统具备：

- Manifest。
- 签名验证。
- 能力声明。
- Scope 隔离。
- 健康检查。
- 候选版本 Stage。
- Activate / Discard。
- 运行时冻结。
- Vendor 与 Provider 分离。

Provider 扩展模型是旧工程最值得保留的资产之一。

### 4.5 异步任务体系完整

当前定义 33 个 Job，全部具有对应 Runbook，并统一描述：

- Queue。
- Concurrency。
- Timeout。
- Retry。
- Lease。
- Idempotency。
- Dead Letter。
- Owner。

### 4.6 测试资产丰富

仓库约有 261 个测试文件，覆盖：

- Unit。
- Component。
- Contract。
- PostgreSQL Integration。
- Redis。
- Journey。
- Recovery。
- Security。
- Performance。
- Browser。

CI 实际启动 PostgreSQL 和 Redis，不完全依赖 Mock。

### 4.7 数据完整性意识强

Canonical 数据库包含 Migration、RLS、Outbox、财务分录、幂等、版本控制和多种一致性检查。

财务、支付、退款、库存和审计均有较强的数据约束和测试证据。

### 4.8 VI 已具备设计系统雏形

`packages/design` 已拥有：

- Design Token。
- 基础组件。
- 工作台组件。
- Storybook。
- 品牌资产。
- Web 与小程序 Token 生成脚本。

Console 有 29 个文件实际使用 `@shop/design`，说明它不是纯文档设计系统。

## 五、严重问题

### 5.1 没有唯一可信版本

审计时仓库状态为：

- 62 个本地分支。
- 33 个远端分支。
- 58 个已注册 Worktree。
- 本地 `main` 落后远端 33 个提交。
- 本地 `main` 独有 2 个提交。
- 419 条工作区状态。
- 217 个已跟踪文件发生变化。
- 约新增 20,050 行、删除 5,717 行。

因此当前目录是并发施工现场，不是可复现版本。

### 5.2 多套事实来源互相冲突

已确认的冲突包括：

- README 写 217 个 Operation，实际是 242 个。
- README 写 165 条 Canonical Migration，实际是 182 条。
- README 宣称没有 Miniapp，但工作区存在一个未完成的 `apps/miniapp`。
- `config/artifacts.json` 把 `auth-web`、`storefront-web`、`commerce-api` 定义为正式兼容链路。
- `04_tools/scripts/audit/regression.mjs` 却把上述三个目录判定为 Retired Directory。
- Owner UI 清单锁定了登录页，但实际 Hash 已经漂移。
- 21 项 MVP 当前全部仍是 `Designed`，交付闸门拒绝通过。

这意味着系统无法稳定回答“哪套架构才是真的”。

### 5.3 Canonical 与 Compatibility 两套内核长期共存

目前同时存在：

- `@shop/contract` 与 `@smart-wing/api-contract`。
- `@shop/authz` 与 `@smart-wing/authz`。
- `packages/design` 与 `packages/design-system`。
- `services/commerce` 与 `services/commerce-api`。
- Canonical PostgreSQL 与 Compatibility PostgreSQL。

Compatibility 数据库有 57 条 Migration，其中 55 条与 Canonical Migration 完全同名且内容完全一致。

兼容层已经不再是轻量 Adapter，而是第二套业务内核。

### 5.4 数据库复杂度超过维护能力

Canonical Migration 中存在：

- 182 条 Migration。
- 194 个 `CREATE POLICY`。
- 1,338 个 `RAISE EXCEPTION`。
- 533 次函数创建或替换。
- 20,856 行数据库对象清单。

优点是约束严密，缺点是改动成本极高。

当前 Migration 守卫已经因为修复序列漂移而失败，说明数据库约束规模已超过当前维护流程的承载能力。

### 5.5 分层外形存在，写库边界没有守住

`services/commerce` 中有 161 个文件直接执行 SQL：

- Application 层：44 个。
- 模块根部：63 个。
- Infrastructure 层：19 个。
- Domain 层：0 个。

Domain 保持纯净是优点，但大量 Application 和模块根文件绕过 Repository / Port，导致领域归属失效。

实际审计发现：

- 15 项跨 Schema 写入归属违规。
- Identity 直接写 Member、Access Schema。
- Referral 直接写 Finance Schema。
- Identity 中存在事务边界违规。
- Identity 分页结果缺少 Cursor。

### 5.6 当前代码不能通过 TypeScript

Typecheck 失败，主要来自身份注册入口引用大量不存在的模块和导出，包括：

- `IdentityRegistrationApiRuntime`。
- `IdentityOperatorAccessModule`。
- `IdentityOperatorCatalogModule`。
- `IdentityRegistrationModule`。
- 多个 `ReadOperations`。
- `defineSelectedModule`。

这说明一些分支内容只迁入了调用方，没有迁入被调用方。

### 5.7 Storefront 架构重复严重

Storefront 同时维护：

- Android：约 1,000 行 TSX。
- Mini Program：约 983 行。
- Tablet：约 1,241 行。
- Laptop：约 1,891 行。
- Mobile：约 945 行。

合计约 6,060 行设备专用界面。

正式源码路径仍直接导入 `MOCK_PRODUCTS`、`MOCK_ORDERS`、`MOCK_USER` 等数据。

Storefront 同时依赖新 SDK、旧合同、旧设计系统和本地 Mock，无法形成清晰的数据边界。

### 5.8 Auth Web 是巨型页面

`LoginPage.tsx` 当前约 1,563 行，内部同时承担：

- 页面布局。
- 登录方式切换。
- 环境配置。
- API 请求。
- 注册。
- 找回。
- 跳转。
- 多端回流。
- 错误处理。

重复审计还发现多个直接 `fetch`、重复环境读取和重复设备 ID 逻辑。

它不是单纯“页面比较长”，而是多个应用层职责集中在一个组件中。

### 5.9 Console 相对成熟，但仍有视觉和模块债务

优点：

- 模块 Manifest。
- 懒加载路由。
- TanStack Query / Table。
- Canonical SDK。
- 共享设计包。
- 页面级测试。

问题：

- Access 与 Member 形成双向跨 Feature 引用。
- 存在 50 个 CSS 文件。
- `smart-wing-vi.css` 约 1,460 行。
- `legacy-admin-theme.css` 约 927 行。
- 同时保留 Demo、旧主题、设计参考和新版组件。
- Finance 模块膨胀到约 52 个文件。

### 5.10 行数闸门失去意义

旧仓库强制所有产品源码不超过 299 行，但当前有 26 个文件违反。

部分代码为了规避物理行数，把多个语句压在同一行，反而降低可读性。该闸门测量的是换行数量，不是复杂度。

Ethan 为新系统指定的“每一个页面不低于 300 行”与旧闸门方向相反，因此未来不能把旧 `check-line-budget.mjs` 直接搬入 `zdt-next`。

### 5.11 架构闸门存在，但没有进入主 CI

现有主 CI 会运行数据库、类型、测试和构建，但不会运行：

- Boundary。
- Dependency。
- Runtime Graph。
- Naming。
- Line Budget。
- Hard-cut Regression。
- E2E。
- Lint。
- Format。

仓库虽然有大量架构脚本，违规仍可持续累积。

两个总质量命令还引用了多个不存在的 npm Script，例如：

- `check:artifacts`。
- `check:approved-ui`。
- `check:deployment`。
- `check:supplychain`。

### 5.12 多个审计脚本自身已经过期

实跑结果：

- Boundary：5 项违规。
- Dependencies：3 项违规。
- Runtime Graph：因 Miniapp 文件缺失直接崩溃。
- Line Budget：26 项违规。
- Duplicate / Version Drift：75 项违规。
- Call Graph：278 项违规。
- Naming：58 项违规。
- Schema Ownership：15 项违规。
- Transaction Boundary：4 项违规。
- Hard-cut Regression：42 项违规。
- Frontend Manifest：仍寻找不存在的 `apps/auth`。
- Test Topology：仍寻找不存在的 `apps/auth`。
- Environment Audit：依赖未完成的 Miniapp 文件。
- Migration Audit：修复序列漂移。
- Deployment Audit：要求 CI 中并不存在的阶段。

这些闸门已经不是统一标准，而是不同历史时期规则的集合。

### 5.13 部署模型不统一

文档目标包括 ACK、ALB、OSS 和不可变容器制品；当前项目专用配置却是：

- ECS。
- Caddy。
- PM2。
- `/opt/zhudatuan/current`。
- 本地静态目录。

当前 PM2 清单只声明 Storefront 与 API，没有声明 `JobsMain`。

Compatibility BFF 又被嵌入 Storefront Worker，导致前端运行时和后端兼容 API 被绑定为同一个发布单元。

### 5.14 可观测性只有抽象，没有完整落地

系统已经定义：

- Log。
- Metric。
- Trace。
- Operation Metric。
- Job Metric。
- Provider Metric。
- Dependency Metric。
- Client Error。

但服务端最终主要把 JSON 写入 stdout，没有看到稳定的 Trace / Metric Exporter 或统一采集后端。

属于“埋点模型存在，运行平台尚未闭环”。

### 5.15 依赖版本与实现逻辑漂移

重复审计共发现 75 项问题，包括：

- React 19.0.1 与 19.2.8 并存。
- Tailwind 4.1、4.2、4.3 并存。
- TypeScript 5.8 与 5.9 并存。
- 多套 Vite、Vitest、Node Type 版本表达方式。
- Auth 直接 HTTP 请求绕开 SDK。
- 微信支付模型、签名、加解密同时存在于 Extension 与 Compatibility BFF。
- 环境配置读取散落在组件和服务中。

## 六、根本原因

`zhudatuan` 失控不是某一个文件或某一次合并造成的，而是以下结构性原因长期叠加：

1. 每次升级都保留旧体系，缺少明确退役点。
2. Compatibility 层逐渐成长为第二套业务内核。
3. 多个并行任务基于不同基线开发。
4. 规则、制品清单、部署配置和真实代码分别演进。
5. 闸门数量持续增加，但没有统一维护和统一进入 CI。
6. 页面、服务、数据库和部署的“完成”使用了不同判据。
7. 预览资产、正式资产、兼容代码和生产代码长期共处一个工作区。

## 七、可提炼资产

### 7.1 值得保留的内容

- 领域清单和业务名词。
- 242 个 Operation 的业务语义。
- Capability、Error、Event 目录。
- Provider / Vendor 接口和 Manifest 模型。
- 33 个 Job 及其 Runbook。
- 财务、库存、支付的一致性测试思想。
- VI Token 与基础组件规范。
- Journey 验收用例。
- 模块依赖注册与循环检测机制。
- 幂等、Expected Version 和 Outbox 设计。

### 7.2 不适合整体搬入 zdt-next 的内容

- 当前 Git 历史和分支结构。
- 双合同与双权限体系。
- 两套数据库 Migration Ledger。
- Compatibility BFF。
- Mock Storefront 数据层。
- 旧质量闸门集合。
- 当前部署配置。
- 多套 CSS / VI 历史实现。
- 旧目录命名与旧 Package Scope。

## 八、最终判断

`zhudatuan` 的业务与工程资产价值高，但当前整体不可作为 `zdt-next` 的代码基线。

`zdt-next` 后续应当从旧系统中逐项提炼业务语义、合同思想、扩展接口、任务模型、VI 规范和验收用例，而不是整体合并旧仓库。

最终结论：

> 保留知识，不继承混乱；保留业务，不继承双轨；保留验证思想，不继承失效闸门。
