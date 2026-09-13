# 全代码库系统审计｜03 模块清单初版

## 1. 说明

本清单在 AU-001 只登记可由入口、注册、构建和发布证据证明的模块边界。业务数据所有权、权限边界和完整 API/事件契约仍标为 UNKNOWN，不能把空白理解为“不存在”。

## 2. 一级模块

| 模块 | 职责 | 对外入口 | 上游 | 下游 | 数据所有权 | API/事件契约 | 运行进程 | 发布单元 | 测试范围 | 当前边界问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Console Shell | Operator UI 启动、作用域壳、导航和模块路由 | `index.html`、`src/main.tsx`、ConsoleRouter | 浏览器、runtime config | 15 个 Console 模块、SDK/API | [UNKNOWN] 浏览器缓存待审 | manifest route + SDK，待逐页 | 静态浏览器应用 | console | route/registry 单测、Playwright 计划入口 | [CONFLICT] fufu 静态根与 release pointer 分裂；E2E 配置失效 |
| Auth Web | consumer/operator 身份入口 | `index.html`、`src/main.tsx`、App | 浏览器、host/query | Identity API | [UNKNOWN] session/cookie | identity contract，待身份 AU | 静态浏览器应用 | auth-web | workspace Vitest；Playwright 当前名称错误 | ESLint glob 未覆盖 auth-web；登录链未审 |
| Storefront Web | 商城页面、同源 public API 调度 | App Router、`worker/index.ts` | 浏览器、Cloudflare/Node | Compatibility publicRouter、vinext | Compatibility DB 读写待审 | public API + 页面路由 | vinext Node 或 Worker fetch | storefront；Cloudflare 状态 UNKNOWN | workspace tests、性能检查 | 同一入口横跨 Node/Worker；部署所有权双轨待证实 |
| Miniapp 生成片段 | 微信端环境、领域常量、主题和品牌生成目标 | `miniprogram/app.js` | 生成器或外部工程 UNKNOWN | Storefront/API UNKNOWN | UNKNOWN | UNKNOWN | 未发现完整可启动工程 | UNKNOWN | 生成器检查 | 缺项目/页面清单，不得据此判废弃 |
| Compatibility Commerce API | Storefront 兼容 public API 与参考 admin server | publicRouter；adminServer | Storefront Worker；参考构建 | Compatibility 数据库、外部 AI/HTTP 待审 | Compatibility schema 待审 | Express/public route | public router 编入 Storefront；admin server 是否在线 UNKNOWN | 无独立 release target | service tests | 被源码嵌入 Storefront，不能按独立 target 缺失判无用 |
| Canonical API Composition | 目标化 API 进程组装 | 7 个 API Main + Ready；ConsoleSupportMain | systemd/release | 32 Commerce 模块、RouteRegistry | 按业务模块待审 | OperationCatalog | 多个 Node API 进程 | identity/mall/support/purchase/web/catalog/payment-webhook | bootstrap、HTTP、契约测试 | Profile 与模块 allow-list 需 AU-003 逐项核对 |
| Canonical Jobs Composition | 目标化后台任务组装 | identity/catalog/payment Jobs Main/Ready；聚合入口 | systemd/release、数据库队列 | 32 模块、33 Job | runtime.job 等待审 | Job catalog、event schema | 多个 Node Jobs 进程 | identity-notification/catalog-jobs/payment-jobs | jobs/bootstrap/repository tests | 生产者消费者、去重、租约和恢复未配对 |
| Commerce Module Catalog | 运行时、可观测性和 30 个业务模块的拓扑加载 | `COMMERCE_MODULES` | API/Jobs bootstrap | command/query/route/job/extension registries | 逐模块 UNKNOWN | operation/event | 所有 Canonical target 内 | 随服务 target | 模块及集成测试 | 数据和发布边界是否与模块边界一致尚未审 |
| Shared Packages | config、contract、SDK、kernel、authz、design、telemetry、testing 等 | package exports | apps/services/tools | apps/services/extensions | 通常无独立持久化；待逐包 | TS/JSON/CSS package contracts | 编入消费者 | 随消费者 | workspace tests | 43 workspace 与 17 root TS references 不是同一集合；需逐包解释 |
| Provider/Vendor/Payment Extensions | 供应商、品类与微信支付适配 | workspace export + ExtensionRegistry | Commerce modules | 外部供应商/支付 | 外部/本地映射待审 | adapter contract | 编入目标 service | 随 Canonical targets | adapter tests/checks | 动态启用、凭据、重试和幂等未审 |
| Release Engine | 变更分类、plan/build/package/deploy/rollback | `cli.mjs`、GitHub workflows | Git 提交、workflow input | 构建器、SSH remote agent、systemd/pointer | release state/ledger 待审 | plan/build/package envelopes | GitHub runner + ECS remote agent | delivery tooling | node:test planner/engine | 多套指针/配置事实源；service impact 直接测试不足 |
| Node Runtime/Gateway | API gateway、Cloudflared、systemd unit 和节点清单 | Caddy/tunnel/systemd | Cloudflare、release engine | API/Storefront/static assets | runtime files | host/path routing | ECS | 节点本地 | config/check scripts | 线上有基线外 active unit；fufu Console route 分裂 |
| Database Migration | 打包与执行 Canonical migration | database-migration target/executor | release workflow | PostgreSQL ledger/migrations | schema ownership待数据 AU | migration ledger | 一次性执行器 | database-migration | SQL/fixture/check scripts | 两套 migration tree 与回滚责任未审 |
| Runtime Object/Secret Services | 对象、Secrets/KMS、本地基础服务 | Local* Main、systemd | Canonical services | 文件/OSS/secret store | 待基础设施 AU | HTTP/adapter UNKNOWN | Node helper services | 部分随节点运行 | 工具测试 | local 与 production 命名混合，真实边界待审 |
| Cloudflare Edge Config | h5/mini 路由及 hbbtzn alias Worker 声明 | wrangler configs | Cloudflare routing | Storefront build/alias handler | 无 | fetch/custom domain | Cloudflare Worker | 仓库内部署入口 UNKNOWN | 未发现正式 deploy test | 外部发布所有者和当前版本未知 |

## 3. Console 模块目录

[FACT][E-AU-001-007] 当前显式注册 15 个模块：

| 模块 ID | entry path | 注册来源 | 深审状态 |
| --- | --- | --- | --- |
| cockpit | `cockpit` | feature/cockpit/manifest.ts | 仅结构性审阅 |
| control | `control` | feature/control/manifest.ts | 仅结构性审阅 |
| applications | `applications` | feature/application/manifest.ts | 仅结构性审阅 |
| products | `products` | feature/product/manifest.ts | 仅结构性审阅 |
| supply-chain | `supply-chain` | feature/supply-chain/manifest.ts | 仅结构性审阅 |
| orders | `orders` | feature/order/manifest.ts | 仅结构性审阅 |
| referral | `referral/settings` | feature/referral/manifest.ts | 仅结构性审阅 |
| channels | `channels` | feature/channel/manifest.ts | 仅结构性审阅 |
| vouchers | `vouchers` | feature/voucher/manifest.ts | 仅结构性审阅 |
| finance | `finance` | feature/finance/manifest.ts | 仅结构性审阅 |
| storefront-members | `storefront-members` | feature/storefront-member/manifest.ts | 仅结构性审阅 |
| access | `settings/members` | feature/access/manifest.ts | 仅结构性审阅 |
| qualification | `settings/qualification` | feature/qualification/manifest.ts | 仅结构性审阅 |
| reports | `reports` | feature/report/manifest.ts | 仅结构性审阅 |
| support | `support/:caseId?` | feature/support/manifest.ts | 仅结构性审阅 |

每个 manifest 是否正确声明 operation、权限、空态、错误态和真实页面组件，留给独立模块 AU。

## 4. Canonical Commerce 模块目录

[FACT][E-AU-001-011] `COMMERCE_MODULES` = Runtime + Observability + 以下 30 个业务模块：

1. Identity
2. Organization
3. Access
4. Capability
5. Partner
6. Member
7. Qualification
8. Catalog
9. Pricing
10. Inventory
11. Experience
12. Marketing
13. Referral
14. Cart
15. Checkout
16. Order
17. Provisioning
18. Fulfillment
19. Verification
20. Payment
21. Voucher
22. Benefit
23. Finance
24. Channel
25. Support
26. Notification
27. Reporting
28. Risk
29. Audit
30. Extension

注册表只证明模块被组装，不证明职责单一、依赖方向正确、数据归属清晰或每个 target 都需要整个模块集合。上述问题仍为 UNKNOWN。

## 5. Workspace 库存

[FACT][E-AU-001-002][E-AU-001-003] 43 个 workspace 分组如下：

| 分组 | 数量 | 名称/范围 |
| --- | ---: | --- |
| Web apps | 3 | `@smart-wing/auth-web`、`@shop/console`、`@smart-wing/storefront-web` |
| Services | 2 | `@shop/commerce`、`@smart-wing/commerce-api` |
| Shared packages | 12 | api-contract、authz、config、contract、design、design-system、interaction、kernel、sdk、smart-wing-authz、telemetry、testing |
| Providers | 12 | book、cake、core、directcharge、flower、foodvoucher、jdfresh、jdproduct、meal、movie、private、tmallmarket |
| Vendors | 6 | cakeuncle、core、jd、tmall、wanlian、wenxuan |
| Payment | 1 | wechatpayment |
| Internal tools | 7 | contractgen、localinfra、localkms、localobjects、localsecrets、requirementgen、seed |

miniapp 目录没有 package.json，不进入 npm workspace 的构建、测试和类型检查传播。

## 6. 初始所有权边界

| 能力 | 代码所有者候选 | 读者/调用者 | 当前置信度 |
| --- | --- | --- | --- |
| Console route catalog | Console route layer | Console shell/navigation/tests | 高；注册证据直接 |
| HTTP operation path/method | Contract OperationCatalog | Commerce RouteRegistry、SDK、前端 | 高；具体兼容契约待审 |
| Canonical module组合 | commerce/app/modules.ts | API/Jobs bootstrap | 高 |
| Job catalog | commerce/app/jobs.ts | JobsBootstrap/QueueJob | 高；数据库所有权待审 |
| Service target到 entry | release adapter service-targets | release build/impact | 高 |
| Node到 pointer/unit | release manifest + remote policy | deploy engine/ECS | 中；线上漂移存在 |
| fufu Console静态根 | 线上 Caddy | 浏览器 | 高（观察时）；期望所有者冲突 |
| Cloudflare Worker发布 | UNKNOWN | h5/mini custom domains | 低；缺外部证据 |

## 7. 下一轮拆分原则

后续不会把“Console”“Commerce”一次性作为一个超大模块审完，而会按完整链路拆分。例如：Console Cockpit 页面 → SDK operation → Canonical route → handler → repository → table；或 payment event → runtime.job → payment-jobs consumer →外部支付方→重试/补偿。每个单元仍只写报告，不在审计分支修复。
