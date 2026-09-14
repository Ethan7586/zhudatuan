# 全代码库系统审计｜03 模块清单

## 1. 说明

本清单截至 AU-002 登记可由入口、注册、构建、发布、页面可达性和 API 第一跳证明的模块边界。业务数据所有权、服务端权限边界和完整 API/事件契约仍标为 UNKNOWN，不能把空白理解为“不存在”。

## 2. 一级模块

| 模块 | 职责 | 对外入口 | 上游 | 下游 | 数据所有权 | API/事件契约 | 运行进程 | 发布单元 | 测试范围 | 当前边界问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Console Shell | Operator UI 启动、runtime 接纳、作用域壳、导航和模块路由 | `index.html`、`main.tsx`、`ConsoleRouter`、landing/scope loaders | 浏览器、node/runtime config | 15 个 manifest/34 routes、document prefetch、Canonical SDK/API | session/profile/scope 在浏览器内；服务端数据归属 UNKNOWN | manifest route + Operation SDK，待逐页 | 静态浏览器应用 | console | route/registry/loader 源码测试；正式 E2E 配置失效 | [CONFLICT] fufu 静态根与 release pointer 分裂；70 CSS 中 6 个图外，尚未定级 |
| Auth Web | consumer/operator 身份节点入口与页面状态机 | `index.html`、`main.tsx`、App、host/query entry resolver | 浏览器、build/runtime node registry | Identity/Registration HTTP clients | [UNKNOWN] session/cookie/ticket | identity response schemas；服务端契约待身份 AU | 静态浏览器应用 | auth-web | workspace Vitest 清单；缺 malformed 2xx 反事实 | Owner-approved UI 与实际挂载/哈希冲突；九处 Schema 结果被丢弃；登录全链未审 |
| Storefront Web | 商城 App Router 页面、同源 public API 和认证 SDK 调度 | `worker/index.ts`；`/`、`/h5`、`/[device]`、desktop 路由 | 浏览器、Cloudflare 或 Node | Compatibility publicRouter、vinext handler、Canonical SDK | Compatibility DB/Canonical API 数据所有权待审 | public API + App Router + RequestContext | vinext Node 或 Worker fetch | storefront；Cloudflare 当前发布状态 UNKNOWN | workspace/static markup tests；真实状态码未验 | 同一入口横跨 Node/Worker；认证 API 动态边界；部署所有权双轨待证实 |
| Miniapp 生成片段 | 微信端 Environment、领域常量、主题和品牌生成输出 | `miniprogram/app.js` | 四条生成链、`wx.getExtConfigSync()`；外部工程 UNKNOWN | 只确认 `App.globalData.environment` | UNKNOWN | [CONFLICT] delivery matrix 声称业务能力，但当前 API client 缺失 | 仅 App 初始化片段，未发现完整可启动工程 | candidate 会复制片段；完整发布单元 UNKNOWN | test topology 只检查 app.js；navigation 必现缺 app.json | 多套机器规则对 required/current 拓扑互相冲突；不得据此判废弃 |
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
| access | `settings/members` | feature/access/manifest.ts | 已深入审阅 |
| profile | `settings/profile` | route/ConsoleRouter.tsx（lazy） | 已深入审阅 |
| qualification | `settings/qualification` | feature/qualification/manifest.ts | 已深入审阅（AU-045） |
| reports | `reports` | feature/report/manifest.ts | 已深入审阅（AU-047） |
| support | `support/:caseId?` | feature/support/manifest.ts | 仅结构性审阅 |

AU-002 已结构性核对全部 manifest、静态/动态可达性以及路由装配；每个 manifest 对应页面的 operation、权限、空态、错误态和业务正确性仍留给独立模块 AU。Console 的入口骨架与 loader 已深入审阅，不等于 15 个页面模块均已深入审阅。

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

### AU-049｜Notification 派发与偏好边界（2026-09-14）

| 模块职责 | 对外入口 | 上游/下游 | 数据所有权 | 运行/发布单元 | 当前边界结论 |
| --- | --- | --- | --- | --- |
| 通知模板、公告、成员偏好、端点与事件投递 | Console 模板/公告读页；notification HTTP 操作；notification/identitynotification Jobs | 上游为业务 outbox/inbox 事件；下游为 KMS、SMS、邮件、微信和站内渠道 | `notification.template/preference/endpoint/dispatch/attempt/announcement` | Commerce API + notification Worker；由 Job catalog 注册 | 正常队列、偏好与回执链明确；generic dispatch 与 runtime.job 的恢复状态机未闭合（F-0143，P1 候选，AU-050 独立复核） |

### AU-051｜Audit 记录与归档边界（2026-09-14）

| 模块职责 | 对外入口 | 上游/下游 | 数据所有权 | 运行/发布单元 | 当前边界结论 |
| --- | --- | --- | --- | --- | --- |
| command/access 审计哈希链、脱敏、读取与冷热归档 | `audit.records.read`；AUDIT_SINK；auditarchive job | 上游为多个 API runtime；下游为 PostgreSQL audit schema、KMS、对象存储 | `audit.record/accessrecord/archiveref/retention` | Commerce API runtimes + maintenance Worker | 链写入、不可变触发器和先存后删归档闭合；归档端到端未在本地运行验证 |

### AU-052｜Risk 判定与复核边界（2026-09-14）

| 模块职责 | 对外入口 | 上游/下游 | 数据所有权 | 运行/发布单元 | 当前边界结论 |
| --- | --- | --- | --- | --- | --- |
| 风险评估、策略回放/激活、案件审核与目录阻断 | risk API；RISK_GATE；riskscan job | 上游为 API 风险门；下游为 catalog、runtime outbox/job、PostgreSQL risk schema | `risk.policy/policyversion/replay/signal/decision/case/listentry` | Commerce API + risk Worker | 事务锁、创建者分离、回放门槛与 catalog 任务已闭合；策略终态重建语义未验证 |

### AU-054｜Experience 页面配置与发布边界（2026-09-14）

| 模块职责 | 对外入口 | 上游/下游 | 数据所有权 | 运行/发布单元 | 当前边界结论 |
| --- | --- | --- | --- | --- | --- |
| 运营页面 application/version、公开页面投影与 CDN 内容发布 | Experience HTTP operations、`experience.published` outbox、`experiencepublish` job、public read | 上游为 Console/Identity operator/mall provisioning；下游为 catalog binding、PostgreSQL、对象存储、cache | `experience.application/version/release/binding/publication` | Commerce API + experience queue Worker | publish 先 scheduled、Worker 以不可变对象/事务锁激活，公开读仅取 active/valid；主发布链缺行为测试（F-0144，P2） |

### AU-055｜Marketing 活动预算边界（2026-09-14）

| 模块职责 | 对外入口 | 上游/下游 | 数据所有权 | 运行/发布单元 | 当前边界结论 |
| --- | --- | --- | --- | --- | --- |
| 活动读取、预算预留/提交/释放 | `marketing.campaigns.read`；MarketingPort | 上游为 Console、checkout、order、payment；下游为 PostgreSQL campaign/redemption | `marketing.campaign/redemption` | Commerce API + order/payment Workers | 预留条件更新、付款提交、超时/关闭释放与 job role/RLS 已闭合；预算状态机缺行为测试（F-0145，P2） |

### AU-056｜Referral 推荐佣金与提现边界（2026-09-14）

| 模块职责 | 对外入口 | 上游/下游 | 数据所有权 | 运行/发布单元 | 当前边界结论 |
| --- | --- | --- | --- | --- | --- |
| 推荐绑定、佣金、反冲、结算与提现 claim | Referral HTTP operations；`referral` job | 上游为 member、order/payment outbox；下游为 catalog、runtime inbox/job、Finance journal/withdrawal | `referral.setting/product/member/binding/commission/*movement/withdrawalclaim` | Commerce API + finance queue Worker | 事件事实锁、稳定佣金 id、skip-locked 结算与提现会员锁闭合；真实 DB/RLS/Finance 端到端未验证 |

### AU-057｜Cart 购物车边界（2026-09-14）

| 模块职责 | 对外入口 | 上游/下游 | 数据所有权 | 运行/发布单元 | 当前边界结论 |
| --- | --- | --- | --- | --- | --- |
| 当前购物车、项目更新与下单转换 | Cart member HTTP operations；CartPort | 上游为 Storefront/WebBusiness；下游为 Experience、Catalog、checkout/order | `cart.cart/item` | WebBusiness API + order transaction | put 使用 active cart/有效 listing；batch 仅改既有 item，无法初始化或新增项目（F-0146，P2） |

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

## 8. AU-002 客户端边界对账

| 客户端 | 页面/路由所有者 | API 第一跳所有者 | 样式根 | 数据所有权结论 | 当前主要 UNKNOWN |
| --- | --- | --- | --- | --- | --- |
| Console | ConsoleRouter + 15 个显式 manifests | SessionLoader/document prefetch 与各模块 SDK | 四个 design sheets + `style.css` 收集链 | 浏览器只持有 session/profile/scope 视图；业务表归属未审 | 34 routes 的逐页授权、状态、operation 与真实 API 终点 |
| Auth | App + node entry resolver，无 Browser Router | canonicalIdentity/canonicalRegistration | `main.tsx` 静态样式入口 | 身份服务拥有关系待服务端专项；浏览器 Cookie/ticket 生命周期未审 | Owner-approved 权威页面、完整登录/刷新/退出、后端事务 |
| Storefront | vinext App Router；Worker 先行分流 | Compatibility publicRouter；浏览器 public catalog/Canonical SDK | `app/globals.css` | Compatibility 与 Canonical 双数据来源的所有权未定 | Cloudflare/Node 当前发布者、缓存、未知 device HTTP 状态 |
| Miniapp | 当前只见 App 初始化；页面所有者 UNKNOWN | 当前不存在可审 API client | 生成主题资源；页面样式 UNKNOWN | UNKNOWN | 外部工程、线上制品、完整页面/API/身份/发布链 |

[FACT][E-AU-002-001][E-AU-002-002] 四个应用目录共 700 个固定基线文件：16 个文件/1,756 行累计深入审阅，673 个结构性审阅，8 个自动生成文件，3 个构建产物。结构性审阅只证明入口、可达性、样式/资源关系和 API 第一跳已枚举，不证明实现逻辑已经深审。

## 9. AU-003 Canonical 进程模块库存

| 模块/运行单元 | 职责 | 对外入口 | 上游调用者 | 下游依赖 | 数据所有权 | 运行/发布单元 | 测试范围 | 当前边界问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| API Bootstrap + NodeServer | selected module/operation 注册、冻结、HTTP 适配、节点上下文 | bootstrapApi / listen | 七个 target API 与聚合 API | ModuleRegistry、RouteRegistry、HttpApp | 不拥有业务数据 | 被每个 API bundle 内联 | registry/entry/NodeServer tests；本 AU 未运行 | Catalog Ready 未覆盖 serving path（F-0014） |
| Identity API | 身份注册/会话与选定运营只读/管理面 | WeChat 关闭时 68、开启时 70 operations | Auth、Console、节点 gateway | identity/member/access 等 13 个 selected modules | 待身份专项 | identity-api；L0/L1 | 入口测试静态枚举 | operation 内授权、事务、Cookie 未审 |
| Mall Provisioning API | 商城创建与读取 | 5 operations | Console | organization/catalog/experience/owner ports | 跨模块单事务责任待审 | mall-provisioning-api | 入口与 CreateMall tests 静态 | CreateMall 发布 impact 漏 target（F-0011） |
| Support API | 工单与消息 | 7 operations | Console | support runtime/DB | support 候选 | support-api 物理 unit | 无独立 entry test 证据 | Main 内 health 只 warn，systemd curl 才阻断 |
| Purchase API | quote、order、payment selected mutation/read | 7 operations | Storefront/clients | checkout/order/payment | 各业务模块候选 | purchase-api | 入口测试静态 | 事务/幂等/支付边界未审 |
| Web Business API | Console/Storefront 非 purchase 业务面与 public catalog 包装 | 19 operations + public router | Console、Storefront | 9 selected modules | 各模块候选 | web-api | 入口测试静态 | 同进程 public/canonical 失败边界待审 |
| Catalog Operator API | 商品运营 operations 与 node-scoped health | 8 operations | Console、gateway | catalog DB/object store | catalog 候选 | catalog-api | 入口/runtime tests 静态 | Ready 对象分裂（F-0014） |
| Payment Webhook API | WeChat payment webhook 接纳 | 1 operation | 微信支付平台 | payment gateway/DB/job/audit | payment 候选 | payment-webhook-api | 加密 fixture/幂等测试静态 | 合法路径与 provider timeout 待支付专项 |
| Jobs Bootstrap + JobRunner | 注册 33 generic jobs、claim/lease/retry/deadletter | bootstrapJobs / QueueJob | Full Jobs 与三个专用 runtimes | PostgreSQL、processors、cache/providers | runtime queue/deadletter 基础设施 | bundle 内联 | JobRunner 单一 scope success test | wait listener 累积（F-0012）；processor 幂等未审 |
| Identity Notification Jobs | 身份挑战通知消费 | identitynotification | identity producers | DB + challenge dispatchers | identity queue 候选 | identity-notification-jobs；L0/L1 | runtime/config tests 待专项 | 生产快照 NRestarts=189；所查时段可见依赖未就绪重试，189 次的完整原因未确认 |
| Catalog Jobs | import/publication/export/可选 media | 3+1 QueueJobs | catalog/reporting producers | DB、object store | catalog/reporting queue 候选 | catalog-jobs | 入口/runtime tests 静态 | 多 consumer 与 scope/媒体启用待审 |
| Payment Jobs | query/refund 恢复消费 | 2 QueueJobs | payment webhook/order/payment producers | DB + gateway | payment queue 候选 | payment-jobs | 入口/runtime tests 静态 | 外部重试/幂等/补偿未审 |
| OutboxRelay + RuntimeScheduler | 转发 outbox；生成四类周期 job | runtime.outbox / time bucket | Full Jobs | OutboxStore/EventPublisher/LeaseStore/runtime.job | runtime 基础设施 | 当前无正式 Full Jobs target | 未运行 | 同类 wait leak；当前生产所有者未知 |
| Migration Executor + Runner | 顺序执行迁移、冻结历史、ledger 回执、目标 schema 校验 | release database-migration target | GitHub release/remote agent | PostgreSQL、KMS、artifact files | 全库 schema 演进 | 按发布一次性进程；非 systemd 常驻 | adapter/remote tests；真实 DB 未跑 | SQL/ledger 非原子窗口（F-0013） |
| Legacy/aggregate entries | ApiMain、JobsMain、FullJobsMain、JobsEntrypoint、MigrationMain、RegistrationMigrationMain、SmokeMain | 本地/staging/历史调用 | 构建、测试、legacy unit或 UNKNOWN | 全域 runtime | 不作新所有权判断 | 无当前 10 个 target | 零散 tests/配置 | 均不满足删除认定条件 |

[FACT][E-AU-003-002] AU-003 深入审阅 43 个文件、1,904 行，结构性审阅 51 个直接依赖文件。33 个 generic jobs 和 300 个迁移只完成入口/结构盘点，不能把本表当作逐任务或逐迁移业务审计完成证明。

## 10. AU-004 发布与节点运行模块库存

| 模块/运行单元 | 职责 | 对外入口 | 上游调用者 | 下游依赖 | 数据/状态所有权 | 运行/发布单元 | 测试范围 | 当前边界问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Deploy Direct | 规划、构建、打包并Direct激活 | workflow_dispatch | 人工操作者/deploy-now | release engine、SSH agent | GitHub run与本地release state | GitHub job | release engine 79/80 | 跳完整验收F-0015；base=HEAD^ F-0020 |
| Quality/Candidate | 规划、依赖、可选验证/build/package/stage | workflow_dispatch | 人工操作者 | npm/release engine/agent | candidate state | GitHub job | 部分step continue-on-error | 不构成Direct前置；清空验证动作 |
| OSS Console | immutable OSS制品与L1 Console原子切换 | workflow_dispatch | 人工操作者 | OSS、SSH激活脚本、公网版本接口 | L1 Console current/OSS object | GitHub job + ECS script | 成功run只读核验 | 与agent双writer F-0016 |
| Release Manifest/Planner | 15 target、2 node、影响与顺序 | CLI/API | workflows/tests | Git、workspace图、规则 | plan schema | runner内进程 | planner/adapter tests | control-plane分类F-0017；after非requires |
| Remote Agent | stage、activate、rollback、status、锁 | SSH CLI | release engine | filesystem/systemd/Caddy/health | target pointer/receipt/rollback evidence | ECS agent | direct/guarded tests | 正式只走Direct |
| L0 Edge | fufu静态与服务路由 | 公网HTTPS | 浏览器 | static roots/loopback services | active Caddy主机状态 | Caddy | fixed config validate | active权威与release pointer分裂F-0001/F-0017 |
| L1 Edge | HBBTZN tunnel/gateway路由 | Cloudflare tunnel/4430 | 浏览器/Cloudflare | L1 static、L0/L1 services | node runtime config | cloudflared + Caddy systemd | validate/AutoNode health | 账户侧配置UNKNOWN |
| systemd runtime | 15类业务/平台进程与Ready | unit实例 | agent/control-plane | target/node current、runtime env | 进程状态 | 18种unit/timer/path | unit静态+生产只读 | 普通Deploy不安装定义F-0017 |
| Release retention | 回收未保护release | timer/path/service | systemd/人工 | release roots、pins、process CWD | 删除集合 | root oneshot | syntax；行为环境阻塞 | 需Bash4环境复核 |
| Control-plane installer | 安装agent/policy或显式runtime | engine install/人工 | quality或操作者 | /opt、systemd、特殊Caddy transition | 主机控制面文件 | ECS root script | 静态/部分tests | workflow只调用agent模式 |
| AutoNode | 主权节点11步计划、执行与补偿 | 显式CLI | 人工；正式消费者UNKNOWN | Cloudflare/DNS/TLS/systemd/process | activation ledger/owned resources | 独立控制面 | 4 pass；4文件环境阻塞 | 不属于普通Deploy下游 |
| Legacy deploy兼容 | 历史发布/检查线索 | 退役或人工脚本 | UNKNOWN/check:deployment | origin/main/旧Caddy路径 | 历史责任 | 非正式target | 无运行验证 | 不满足删除条件 |

[FACT][E-AU-004-013] AU-004 深入审阅45个人工文件、4,283行，结构性审阅28个人工文件、9,347行，并核对2个自动生成node manifest、396行；大型engine/provider只对发布关键逻辑形成结构性结论，生成输出也不计作逐行人工审阅。

## 11. AU-005 共享状态模块库存

| 模块 | 职责 | 对外入口 | 上游 | 下游 | 数据/密钥所有权 | 运行/发布单元 | 测试范围 | 当前边界问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PostgreSQL runtime | 连接池、事务上下文、业务及runtime持久状态 | pg pool/SQL/functions | APIs、Jobs、Migration | host PG17或staging RDS proxy | 各业务schema+runtime平台共享表 | registration DB systemd；database-migration target | Pool/UoW/context/PG16 fixture | fresh PG17 init冲突F-0023；backup owner UNKNOWN |
| Redis cache | 非权威JSON TTL cache | Cache token | aggregate CommerceRuntime | 外部Redis | 外部服务；应用仅key | 当前无dedicated target | Cache/RedisCache tests | 同进程不重连F-0028 |
| Outbox relay | outbox claim、顺序、retry/deadletter | OutboxRelay | runtime.outbox producers | RuntimeEventPublisher | runtime.outbox | 仅JobsMain/FullJobsMain；无正式target | store/publisher mocks | 正式控制面缺失F-0022；GX-0001 |
| Event publisher | event version→inbox dedup→handler jobs | RuntimeEventPublisher | OutboxRelay | runtime.inbox/job | runtime平台 | 随aggregate Jobs | Event/Publisher tests | 被测实现无正式上游进程 |
| Job runner/scheduler | claim、lease、heartbeat、deadline、retry、schedule、cleanup | QueueJob/JobRunner/RuntimeScheduler | dedicated/aggregate entries | processors/runtime tables | runtime.job/lease/deadletter | identity/catalog/payment dedicated；aggregate缺失 | JobRunner/Catalog runtime tests | generic export回收F-0024；processor幂等未审 |
| Secret Store | ref→secret value | loopback HTTPS 8543/8553 | 所有workloads | JSON catalog | catalog文件owner UNKNOWN | internal runtime/node secret service | Handler/Catalog/policy tests | production Main绕过授权F-0021 |
| Local KMS | envelope encrypt/decrypt | loopback HTTPS 8544/8644 | 需要敏感字段加密的workloads | AES-GCM/单master | master owner UNKNOWN；ciphertext归业务 | internal runtime | Handler/LocalKms tests | Main绕过授权；rotation/restore UNKNOWN |
| Local Objects | upload/read/inspect/signed read | loopback HTTPS 8555/8655 | Catalog/Reporting/Import/API | node StateDirectory | L0/L1 node-local | sfl object store systemd | LocalObjects test | loopback public URL、clean、metadata F-0025–27 |
| Catalog media OSS | 多target媒体复制与校验 | adapter/replication job | Catalog Jobs | Aliyun OSS | Catalog逻辑owner；云账户owner UNKNOWN | catalog-media/catalog-jobs | adapter/replication tests结构审阅 | 与Local Objects不可混画；云恢复UNKNOWN |

[FACT] AU-005深入审阅64个人工文件、3,920行，结构性审阅36个人工文件、4,801行，并核对1个自动生成事件映射、150行；合计101文件、8,871行。

## 12. AU-006 共享配置模块库存

| 模块 | 职责 | 对外入口 | 上游调用者 | 下游依赖/输出 | 运行/发布单元 | 测试范围 | 当前边界问题 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Environment primitives | process/browser读取、pick、required、integer、enum、Bearer、distinct | @shop/config/server | 所有专用parser | 冻结值或稳定错误码 | 内联到服务/前端bundle | index.test | 三个公共helper/Client投影暂无生产消费者，G1 |
| API parsers | API/DB/Secret/KMS/Object/Node键与profile | @shop/config/server | API Main/Ready、部署检查 | 专用Bootstrap | 七类API target | index + 4专用测试 | 四专用测试未进正式script；origin重复语义F-0031/F-0034 |
| Jobs parsers | full/identity/payment配置 | @shop/config/server | aggregate与dedicated Jobs | Jobs runtimes | identity/payment targets；aggregate无target | index.test | Catalog Jobs另有私有parser；aggregate GX-0001 |
| Migration/Local parsers | 一次性迁移和local/staging设施 | @shop/config/server | MigrationMain/local tools | DB/文件/TLS/本地服务 | 一次性unit/本地工具 | index.test | local endpoint仅前缀F-0035 |
| SFL Node Kernel | Manifest/Registry/Topology/digest/Host/ref | sfl-node-kernel | Commerce、Console、AutoNode、检查器 | 节点权威对象 | 构建与各bundle内联 | 720行专项test | 嵌套对象未深冻结F-0032；relation连续性UNKNOWN |
| SFL Registry | L0/L1声明、resource/domain/target映射 | sfl-node-registry | Identity、Console、生成器 | declaration projections | bundle/build | SFL/Console间接 | 返回同一可变引用F-0032 |
| Console Runtime Kernel | artifact/node runtime解析与AppConfig | sfl-console-runtime | Console、build/release/AutoNode | API/login origin、scope、NodeContext | Console静态制品+每节点JSON | 223行专项test | runtime URL未绑定Manifest domain F-0029 |
| Runtime Catalog | cache/capacity生成常量 | @shop/config/runtime | HTTP/Pool/cache/SDK/extensions | TS与Miniapp生成物 | 构建时生成，运行时静态 | check:generated | 正式check本环境未执行；嵌套limits可变F-0032 |
| Miniapp Environment | ext config schema与生成JS | @shop/config/miniapp + generated JS | generator、app.js | api/mall/version | Miniapp包 | TS仅1个负例 | TS/generated trim漂移F-0033 |
| Admin Segment Scope | 双段scope解析/映射 | admin-segment-scope | Console/服务消费者 | normalized segment scope | bundle内联 | 32行专项test | 本AU未发现独立问题 |

[FACT] AU-006深入审阅35个人工文件、6,151行，结构性审阅62个人工文件、8,947行，核对7个自动生成文件、1,070行；合计104文件、16,168行。

## 13. AU-007 契约模块清单

| 子模块 | 职责 | 对外入口 | 上游 | 下游/数据所有权 | 发布单元 | 测试 | 当前边界 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Operation definitions | 345条路由、权限、owner、availability与生成目标 | operations.yml / OperationCatalog | 产品/模块定义 | OpenAPI、SDK、HTTP、DB | contract package + consumers | Contract/Voucher/segment/member tests | permission F-0036；schema F-0038；writePath F-0040 |
| Event definitions | 67条type/version/owner/schema/handlers | events.yml / COMMERCE_EVENTS | 领域producer | RuntimeEventPublisher、DB runtime.event | contract + Commerce | event callgraph门禁 | checksum遗漏F-0039；handler业务留专项 |
| Error definitions | 1438条code/status | errors.yml / errorStatus | Error/DomainError call sites | ErrorMapper HTTP响应 | contract package | Contract test + check:errors | scanner旧roots F-0037 |
| Capability shadow catalog | 局部Operation audience对照 | capabilities.yml | 历史能力目录 | 仅contractgen validator | 不直接发布DB | 无专用反事实 | 1孤儿、5permission漂移、156缺项 F-0041 |
| Contract schema core | JSON/path/date归一化与named allowlist | @shop/contract/schema | generated CommerceSchemas | SDK types/直接tests；生产Controller no-op | contract package | Contract.test | 接受集合不一致 F-0038 |
| Provider contracts | Provider capability、Manifest、Ports、registrar socket | @shop/contract root | provider实现 | extensions/adapters | contract package | DomainRegistrar test | 本AU未发现独立问题 |
| contractgen | 读取目录并生成47个当前tracked目标及2个条件Miniapp目标 | workspace generate/check | 四目录、authz、SQL template | contract/OpenAPI/SDK/Commerce/DB | 工具workspace | 仅ClientArtifacts 2例 | 非原子/replace无断言 F-0042 |
| Contract public utilities | ClientPage、Password、DeepLink、Experience、FinancialAction | package root/subpaths | App/SDK/工具 | 调用者 | contract package | 对应unit | DeepLink边界F-0043；部分零仓内消费者为G1 |

[FACT] AU-007深入审阅41个人工文件、12,089行，结构性反追28个人工文件、3,976行，核对48个生成文件、103,131行；合计117文件、119,196行。

## 14. AU-008 生成契约运行模块清单

| 子模块 | 职责 | 对外入口 | 上游调用者 | 下游/数据所有权 | 运行进程/发布单元 | 测试范围 | 当前边界 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SDK generated domains | 345个Operation的typed factory与domain聚合 | `@shop/sdk/*`、CommerceClient | Console/Storefront/Auth及仓外消费者 | ApiClient；不拥有数据 | Web client bundles/各目录hash | factory/frozen集合 | 生成集合一致；公共ID数组G1 |
| SDK ApiClient | 请求构造、deadline、幂等前置、重试、decode | ApiClient/create*Commerce | generated domains | Transport → HTTP API | 浏览器/微信client bundle | 版本退出、headers、abort | proof与生产CORS冲突F-0044；retry直接测试缺口 |
| Browser Fetch transport | fetch、credentials、redirect、AbortSignal | FetchTransport | ApiClient | 浏览器网络 | Web clients | signal传递 | 依赖HttpApp CORS契约 |
| Wechat transport | `wx.request`适配Transport | createWechatCommerce | 仓内生产caller为0 | 微信native request | 潜在Miniapp/外部bundle | 仅abort | body/settle违约F-0046；G1兼容面 |
| Commerce generated HTTP shells | runtime route/handler描述与授权元数据 | OperationController/Handler | RouteRegistry/DefinedModule | AccessPipeline/ModuleOperations | Commerce OCI | RouteRegistry/契约测试 | 271 runtime齐全；领域handler留后续AU |
| Commerce event registry | event version与handler路由 | COMMERCE_EVENTS/EVENT_HANDLERS | modules/publisher | runtime inbox/job表 | Commerce API/Jobs OCI | Event结构测试 | 67项齐全；可变Map归F-0032 |
| Generated contract artifacts | OpenAPI、events JSON、current.sql | contract package/files | check/release/test | 文档、制品identity、DB测试oracle | npm/workspace、release metadata | generated/contract checks | `contractHash`覆盖有限F-0039；current.sql无运行loader |
| Miniapp generated fragment | DeepLink/Experience CommonJS投影 | 两个domain JS文件 | candidate；运行caller为0 | 外部Miniapp UNKNOWN | 9文件目录hash | generated check受依赖阻塞 | 完整工程冲突F-0006；runtimegraph漂移F-0045 |
| Runtime graph checker | 架构token/文件存在性门禁 | `check:runtimegraph` | audit/quality scripts | 源码只读扫描 | CI/本地质量入口 | 无自有反事实fixture | 仍要求退休契约并读缺文件F-0045 |

[FACT] AU-008深入审阅32个人工文件、1,835行，结构性反追31个人工文件、4,047行，核对43个自动生成文件、76,940行；合计106文件、82,822行。

## 15. AU-009 Kernel 模块清单

| 模块 | 职责 | 对外入口 | 上游调用者 | 下游依赖 | 数据所有权 | API/事件契约 | 进程/发布单元 | 测试范围 | 当前边界问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Kernel package shell | ESM workspace、barrel与编译范围 | `@shop/kernel`、`@shop/kernel/deadline` | 72源码文件、4个消费者package依赖 | 27个root barrel模块 | 无 | 54个声明导出 | 编入调用者制品，无独立target | package test/typecheck入口 | 依赖缺失未执行；公共面含G1零caller符号 |
| Domain primitives | ID/时间/金额/实体/聚合/事件/值对象 | 根入口classes/types/functions | Commerce领域、Outbox、testing | JS基础类型/Object.freeze | 无；调用方拥有表/事务 | DomainEvent envelope、value语义 | Commerce/测试制品 | Money 1例；多数无直接测试 | ValueObject F-0050；Currency补强F-0032；TestId seam F-0052 |
| Resilience primitives | deadline、rate、concurrency、circuit、retry | 根入口 + deadline subpath | Commerce Executor/HttpClient、Vendor、SDK | Timer、AbortSignal、注入operation | 无；包裹外部副作用 | Error code、RetryMode、CircuitState | 各调用者制品 | Resilience 4例及消费者tests | Circuit F-0047；幂等F-0048；Deadline F-0051 |
| Gate contract | 观察声明、上下文、decision和plugin端口 | gate barrel→root | Operation/HttpApp/GateEngine | Commerce plugin实现 | 无 | disabled/observe类型契约 | Commerce API OCI | GateEngine/HttpApp消费者tests | 不得误画为授权器；当前边界一致 |
| Module manifest/catalog | 描述模块capability/入口并潜在拓扑解析 | module barrel→root | 35 manifests；Catalog仅自身tests | Map/Set/manifest对象 | 无 | ModuleManifest/Selection/Plan | 当前manifest编入Commerce；Catalog无生产caller | Catalog 4合成例；34 manifest tests | 37 missing + mutable snapshot F-0049；Catalog G1 |

[FACT][E-AU-009-002] 本单元深入审阅40文件、983行；全部为人工代码/配置，无生成、第三方或构建产物。

## 16. AU-010 Authz 模块清单

| 子模块 | 职责 | 对外入口 | 上游 | 下游/数据 | 进程/发布 | 测试 | 当前边界问题 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Package shell | private ESM、根barrel、test/typecheck | `@shop/authz` | 4个package依赖、29源码imports | 6个源模块 | 编入消费者 | 正式命令缺deps阻塞 | contractgen绕过export F-0058 |
| Permission model | risk/code/definition类型 | PermissionRisk/Permission/PermissionDefinition | PermissionCatalog | Console/contractgen/Policy | 同上 | 间接 | 类型不负责runtime解析 |
| PermissionCatalog | 184 code、33 category、risk/stepup/scopes、lookup | PERMISSION_CATALOG/permissionDefinition | 人工目录 | 329 Operation、DB产物、Console | 构建期+各bundle | 目录局部测试 | custom role委派F-0053；浅冻结F-0032；UI标签F-0059 |
| Scope model | 11 kind、id、tenant、path、grant有效期 | Scope/ScopeGrant/SCOPE_KINDS | DB resolvers/SDK/Console | Policy、Access、Mall | 各bundle | Policy/Pg/NodeBound | tenant类型过宽与containment F-0055 |
| Policy stages | active/version/deny/grant/scope/step-up | precheck/checkScope/checkAssurance | AccessPipeline/AccessOperations | reason/evidence | 7个Commerce runtime | 4 package+2 security+Pipeline矩阵 | 二级stage误用F-0054 |
| Complete façade | 一次性完整纯判定 | decide/DecisionContext/Decision | 仅测试；仓外UNKNOWN | reason/evidence | 无生产caller | 两组测试 | DC-0012/G1，禁止删除 |
| Role projection seam | role/override/scopegrant投影为MembershipAccess | session-bound SQL resolver | Access数据库 | AccessPipeline | PostgreSQL+Commerce | Pg/Pipeline局部 | 角色归DB所有；bigint类型F-0057 |

[FACT][E-AU-010-002] 本单元深入审阅10文件、397行；7个生产TS、1个测试、2个配置/清单全部为人工维护，无生成、第三方或构建产物。第一层消费者只作边界追踪，不改变其原覆盖状态。

## 17. AU-011 Smart Wing Authz 模块清单

| 子模块 | 职责 | 对外入口 | 上游 | 下游/数据 | 进程/发布 | 测试 | 当前边界问题 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Package shell | 兼容private workspace与根export | `@smart-wing/authz` | Commerce API两个源码import、根workspace | api-contract | 无独立单元；旧admin制品禁止 | 无正式script | F-0060、DC-0013 |
| Permission risk快照 | 从86条目录派生25个critical | `HIGH_RISK_PERMISSIONS`、`requiresStepUp` | `decide` | api-contract目录 | 随caller进程 | 间接 | 公开可变Set补强F-0032 |
| Membership判定 | active/expiry、deny、allow | `isActiveMembership`、`decide` | auth wrapper/adminServer | `public.*` Membership投影 | 兼容链当前无正式target | 13个直接用例 | 正式入口失联F-0060 |
| Scope判定 | tenant、层级、self与跨tenant binding | `decide`、`can` | 13路由wrapper消费者 | server-derived ResourceScope RPC | 同上 | 主干覆盖 | challenge顺序F-0062 |
| Step-up | critical最近验证窗口 | `decide` options | 兼容caller | Date纯计算 | 同上 | 900秒边界 | 非有限窗口F-0061 |
| Compatibility role ceiling | 限制非Owner可创建/分配权限和Scope | PostgreSQL函数/trigger | 兼容角色管理 | `public.*`角色/权限/Scope表 | PostgreSQL兼容面 | 本AU只追接缝 | 值得保留；不等价canonical模型 |

[FACT][E-AU-011-002] 本单元深入审阅4文件、267行；83行实现、159行测试、25行清单/配置全部为人工维护，无生成、第三方或构建产物。第一层消费者与迁移只作边界追踪，不改变其原覆盖状态。

## 18. AU-012 Smart Wing API Contract 模块清单

| 子模块 | 职责 | 对外入口 | 上游 | 下游/数据 | 进程/发布 | 测试 | 当前边界问题 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Package shell | 聚合兼容共享契约 | package root+taxonomy subpath | 33个引用文件 | 内部TS/JSON | 随消费者制品 | Storefront聚合 | 无独立test/typecheck，F-0060 |
| Permission/Authz | 86权限和Membership/Scope/Decision | root export | Smart Authz/Commerce API | public兼容Access数据 | 兼容源码 | 2目录tests | 运行对象可变F-0032 |
| Commerce/member code | 支付状态和会员码协议 | root export | 兼容routes | order/payment/challenge RPC | 上层Worker | route tests | 未发现独立问题 |
| Taxonomy | L1/L2/L3与移动浏览 | JSON subpath | Storefront | 商品taxonomy code | Storefront | 无直接测试 | dangling L2，F-0064 |
| Platform | 五平台与adapter类型 | root export | 当前无包外源caller | 无 | 未来客户端 | 2集合tests | G1 DC-0015；运行常量可变 |
| Delivery matrix | 五项逐平台状态 | 文件路径 | 无代码消费者 | 无 | 无 | 正式checker不读 | F-0063；G2 DC-0014 |

[FACT][E-AU-012-002] 本单元深入审阅11文件、758行；494行生产TS、31行测试、210行JSON和23行package/tsconfig均为人工维护，无生成、第三方或构建产物。

## 19. AU-013 Telemetry 模块清单

| 子模块 | 职责 | 对外入口 | 上游 | 下游/数据 | 进程/发布 | 测试 | 当前边界问题 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Adapter/Telemetry | 组合logger、metrics、tracer | `createTelemetry`与三平台adapter | Commerce与未来平台 | TelemetryWriter | 随消费者制品 | 间接 | async writer拒绝F-0067 |
| Redactor/Logger | 统一脱敏与结构化日志 | `Redactor`、`SinkLogger` | Operation audit、各sink | stdout/audit sink | 多个正式Commerce进程 | 1例 | 字符串credential/PII缺口F-0065 |
| Metrics/Tracer | count/duration/span | Telemetry成员 | Commerce运行时 | writer | 同上 | 无直接测试 | Promise失败和重复end缺口 |
| Client errors | fingerprint、聚合、retention、Scope读取 | `ClientErrorBuffer` | ObservabilityModule | 进程内Map/writer | 当前正式target无注册 | 3例 | F-0055/F-0066；DC-0016 |
| Interaction timeline | 前端阶段耗时 | `createInteractionTimeline` | Auth/Console/Storefront | callback/metrics | 三个前端制品 | 2例 | callback异常状态缺口 |
| Platform adapters | Node/stdout、Beacon、miniapp writer | `nodeTelemetry/browserTelemetry/miniappTelemetry` | 各平台 | writer/sendBeacon | Node活跃，其余仓内零生产caller | 无 | DC-0017 |

[FACT][E-AU-013-002] 本单元深入审阅18文件、473行；全部为人工维护，无生成、第三方或构建产物。

## 20. AU-014 Testing 模块清单

| 子模块 | 职责 | 对外入口 | 当前消费者 | 测试 | 边界问题 |
| --- | --- | --- | --- | --- | --- |
| DatabaseHarness | apply/test/reset生命周期 | root export | Commerce Repository.test | 无自测 | 双异常掩盖F-0068 |
| Event/Provider/Clock/Container/ID | 通用fixture | root export | 固定仓库无包外caller | Container 2例 | F-0052/F-0068；G1 DC-0018 |
| HttpHarness | SDK Transport捕获与abort | root export | 固定仓库无包外caller | 3例 | snapshot/responder分裂F-0069 |
| Browser harness | axe/MSW/Query/React/Router/User组合 | browser subpath | 仅包内Browser.test | 2例 | G1 DC-0019 |

[FACT][E-AU-014-002] 本单元深入审阅20文件、403行；全部为人工维护，无生产进程、数据库所有权或发布单元。

## 21. AU-015 Interaction 模块清单

| 子模块 | 职责 | 真实消费者 | 测试 | 当前问题 |
| --- | --- | --- | --- | --- |
| FeedbackStore/React hook | channel反馈、timer、订阅 | Storefront toasts | 3例 | 可变snapshot F-0072 |
| KeyedActionCoordinator | action去重、revision、abort | Auth identity actions | 4例 | Result类型未绑定key F-0071 |
| KeyedMutationQueue | 按资源串行、跨资源并行、rollback | Storefront cart quantity | 6例+consumer 5例 | observer异常改判F-0070 |
| PreloadRegistry | import去重、失败重试、schedule | Console modules、Storefront pages | 4例 | 未发现独立问题 |
| ResourceCache | memory/storage/revalidation | Auth session、Storefront cart helpers | 4例 | dispose后read F-0073 |
| React adapter | lazyNamed、两个hooks、StrictMode延迟dispose | Auth/Storefront | 无直接测试 | 测试缺口 |

[FACT][E-AU-015-002/003] 14文件、971行全部深入审阅；所有核心运行导出都有固定仓库生产消费者，无删除候选。

## 22. AU-016 Smart Wing Design System 模块清单

| 子模块 | 职责 | 固定仓库入口 | canonical关系 | 当前问题 |
| --- | --- | --- | --- | --- |
| Package exports | tokens/mobile/brand subpaths | Storefront仅dependency边；零import | `@shop/design`有同类exports | F-0074；DC-0020/G2 |
| Tokens JSON | 1.0智慧翼/会员码视觉值 | 零运行消费者 | canonical 1.2主打团/翼码 | 漂移且无现行生成链 |
| Tokens CSS | 79个CSS变量 | 零运行消费者 | canonical 82个变量且正式check覆盖 | F-0075；历史生成物 |
| Mobile standards | iOS/Android/微信与六档size class | 零运行消费者 | canonical文件已有变化 | 结构闭合但运行脱节 |
| Brand SVG | mark/lockup/code/pattern | 零运行消费者 | 3个字节相同、code不同 | 需视觉复核，不能删除 |

[FACT][E-AU-016-002/003] 8文件均纳入：7个人工文件深审，1个CSS生成物核对来源。没有真实页面消费者，不等于已满足G3。

## 23. AU-017 Canonical Design 模块清单

| 字段 | 结论 |
| --- | --- |
| 模块 | `@shop/design` |
| 职责 | Console共享组件、资源状态、CSS/token、品牌资产、Storybook与跨端设计数据 |
| 对外入口 | 根export、`./access-denied`、5个CSS subpath、2个JSON、brand wildcard |
| 上游调用者 | Console main/页面/ScopeShell/Cockpit、Storybook、web/miniapp生成器 |
| 下游依赖 | React、React Aria、TanStack Table；token JSON与SVG资产 |
| 数据所有权 | 无业务表；拥有canonical设计token、组件契约和品牌/平台设计数据 |
| 运行进程 | 无独立进程；编入Console与miniapp静态制品 |
| 发布单元 | Console bundle、miniapp资源；Storybook仅开发入口 |
| 测试范围 | 10个test文件、4个stories；正式test/component/typecheck入口存在 |
| 当前边界问题 | 80个token缺定义、AccessDenied无样式、401语义折叠、Storybook/品牌/平台规格漂移 |

[FACT][E-AU-017-001/002] 67/67文件、4,653/4,653行已覆盖；65个人工文件深入审阅，2个生成物核对来源和消费者。公共但无生产消费者的符号与平台规则仅列G1，不推断删除。

## 24. AU-018 Miniapp 运行片段清单

| 子模块 | 职责 | 真实入口/调用者 | 当前边界 |
| --- | --- | --- | --- |
| `app.js` | 初始化ext config | 微信App入口 → Environment | 唯一人工运行代码；无页面/API |
| Environment | 校验api/mall/version | app.js | F-0033 parity差异 |
| Experience/DeepLink | 生成领域parser | 零运行caller | F-0082/F-0043；DC-0023 |
| Cache/Runtime | 生成缓存和HTTP限制 | 零运行caller | F-0032；DC-0023 |
| Theme/Assets | WXSS与品牌SVG | 零页面/WXML/app.wxss caller | F-0080/F-0081；DC-0023 |
| 发布/质量 | navigation/tests/runtimegraph/candidate | 机器脚本 | F-0006：判据互相冲突 |

[FACT][E-AU-018-001/002] 9/9文件、195/195行已复核；覆盖状态总账不增加，因为app与两个contract生成物已在前序AU审阅，其余生成物已预分类。本批完成的是文件级生成关系和片段内部调用闭合。

## 25. AU-019 Auth Web 模块清单

| 子模块 | 职责 | 真实入口/调用者 | 当前边界 |
| --- | --- | --- | --- |
| bootstrap/build env | build/runtime registry与首屏 | HTML/Vite/accounts host | F-0083/F-0084/F-0085 |
| entry resolver | host/query→audience | App | F-0086 |
| Consumer page | 登录、注册、找回 | App consumer | 无直接页面测试F-0090 |
| Operator page | 登录、邀请注册、找回 | App operator | F-0087 |
| canonical clients | challenge/session/member/ticket | 两现行页面 | F-0007/F-0088 |
| interaction/telemetry | 同key去重、取消、阶段事件 | 两现行页面 | 测试较完整 |
| legacy identity | LoginPage/compat auth | 当前App零入口 | F-0005/GX-0002 |
| styles/assets | shell、PWA/OG | main/HTML/legacy | F-0089/DC-0025 |

[FACT][E-AU-019-001] 58/58文件、6,807/6,807行覆盖；49个人工文本/代码文件深入审阅，9个品牌资源结构性审阅。

## 26. AU-020 微信支付适配器模块清单

| 子模块 | 职责 | 真实入口/调用者 | 当前边界 |
| --- | --- | --- | --- |
| Config | 商户/平台密钥、callback和scope配置 | 三个runtime、WechatGateway | F-0091 |
| Crypto/Signature | 请求签名、响应/通知验签、AES-GCM、摘要 | Transport/Notification/Gateway | 密钥导入延迟失败F-0091 |
| Transport | API origin、deadline、限长、验签、错误映射 | Client/Close | 正文流错误逃逸F-0092 |
| Client/Close | prepay/query/refund/close | WechatGateway | callback override F-0093 |
| Models | provider JSON到内部模型 | Client/Notification | authoritative时间由Gateway再校验 |
| Notification | 通知分类、验签、解密、最小证据 | Payment Webhook | 与DB本地意图核对闭合 |
| tests | 28个密码学和协议行为 | Vitest | 环境缺工具；异常流缺口 |

[FACT][E-AU-020-001] 18/18文件、1,873/1,873行均已深入审阅。模块不拥有数据库或独立进程，随Commerce OCI制品发布。

## 27. AU-021 Provider Core 模块清单

| 子模块 | 职责 | 真实入口/调用者 | 当前边界 |
| --- | --- | --- | --- |
| Factory/Provider | installation闭合、生命周期、health和port | 11个factory、Loader、Registry | 主干清晰 |
| PortFactory | 九类VendorClient port与通用Webhook verifier | 7个远程provider factory | F-0094 |
| Mapper/ErrorMap | 最小JSON shape和VendorFailure投影 | Provider-specific wrappers | 具体语义待逐provider核对 |
| Limits | 通用连接/响应/deadline/并发/重试参数 | manifests/tests | 无独立运行状态 |
| Webhook wrapper | verifier→sha256→ingress包装 | 单测和多包转发导出 | 无生产caller；F-0095/DC-0026 |

[FACT][E-AU-021-001] 11/11文件、354/354行均已深入审阅。数据由extension/channel/runtime数据库拥有，包随Commerce OCI发布。

## 28. AU-022 Vendor Core 模块清单

| 子模块 | 职责 | 真实入口/调用者 | 当前边界 |
| --- | --- | --- | --- |
| Connection | 校验base URL、endpoint、secret和health operation | Loader、所有vendor clients | F-0096 |
| Auth/Signer | Header、HMAC、RSA认证头 | JD/Tmall/Wanlian/Wenxuan | Header为G1；其余生产使用 |
| Client | URL、请求、双deadline、重试、响应JSON | 4个vendor家族、7个providers | F-0096/F-0097 |
| Rate/Circuit | connection级限流、并发、断路器 | 通用Client和Cakeuncle | 运行内存状态，不持久化 |
| VendorError | 传输错误稳定投影 | 全部vendor/provider链 | 主干清晰 |
| tests | 4个Client行为 | Vitest | F-0098；当前缺工具未执行 |

[FACT][E-AU-022-001] 11/11文件、365/365行均已深入审阅；无独立进程、数据库或发布target。

## 29. AU-023 Cakeuncle Vendor 模块清单

| 子模块 | 职责 | 真实入口/调用者 | 当前边界 |
| --- | --- | --- | --- |
| Auth/Signer | channel凭据、API/H5/Card签名与比对 | Client；部分只被测试 | 禁用协议见DC-0028；别名见DC-0029 |
| Client | Cakeuncle JSON/form请求、超时、重试、响应限长 | Cake/Flower/Foodvoucher/Meal | F-0099；继承F-0096 |
| Endpoints/Physical | 固定path、金额和整数解析 | Cake/Flower/Meal mappers | 部分零caller常量为G1 |
| Webhook | 签名、时间窗、normalize、event ID | 仅Webhook.test | 未导出/未注册；GX |
| README/public barrel | 声明启用与禁用能力、公共API | 开发/安装与4个provider包 | Foodvoucher冲突F-0100 |
| tests | 14个用例覆盖Auth/Client/Signer/Webhook | Vitest | F-0102；当前工具缺失 |

[FACT][E-AU-023-001] 16/16文件、662/662行均已深入审阅；无独立进程、数据库或发布target。

## 30. AU-024 Foodvoucher Provider 模块清单

| 子模块 | 职责 | 真实入口/调用者 | 当前边界 |
| --- | --- | --- | --- |
| manifest | required provider能力、权限、secret、limits | Registry/release signer | F-0100/F-0103 |
| Provider/operations | Cakeuncle Client与通用ports装配 | Commerce ProviderFactories | capability-port不闭合 |
| Mapper | 通用canonical records验证 | catalog port | F-0103；专用mapping已丢失 |
| ErrorMap | Provider error前缀 | 仅公共export | DC-0030/G1 |
| Webhook转发 | 旧Provider Core包装器别名 | 仅公共export | 已纳入DC-0026 |
| tests | required ID和manifest签名 | Vitest；根contract | F-0104 |

[FACT][E-AU-024-001] 9/9文件、79/79行均已深入审阅；包随Commerce OCI发布，不拥有表、进程或独立target。

## 31. AU-025 Cake Provider 模块清单

| 子模块 | 职责 | 入口 | 边界 |
| --- | --- | --- | --- |
| CakeReadClient | Catalog分页、Price/Stock快照 | Channel jobs | F-0105/F-0106 |
| Mapper | 分类树、商品/spec、金额库存 | ReadClient | 严格fail closed |
| Provider/manifest | 三只读能力装配 | Runtime loader | 闭合 |
| OrderRequest | 履约body构造 | 仅测试 | GX/DC-0031 |
| tests | mock响应与builder | Vitest | F-0107 |

[FACT][E-AU-025-001] 13文件807行深入审阅；随Commerce OCI发布。

## 32. AU-026 Flower Provider 模块清单

| 子模块 | 职责 | 上游/入口 | 当前边界 |
| --- | --- | --- | --- |
| FlowerProvider/manifest | 发布Catalog/Price/Inventory | Runtime loader/Registry | 三只读能力闭合 |
| FlowerReadClient | 分类分页、Price/Stock快照 | Channel jobs | F-0108/F-0109 |
| FlowerMapper | 分类、商品、spec、价格库存映射 | FlowerReadClient | F-0110 |
| ErrorMap/Webhook | 兼容公共导出 | 固定仓库零caller | DC-0033/DC-0026 |
| tests | provider身份和签名 | Vitest | F-0111 |

[FACT][E-AU-026-001] 10文件548行深入审阅；随Commerce OCI发布，无独立表、进程或制品。

## 33. AU-027 Meal Provider 模块清单

| 子模块 | 职责 | 上游/入口 | 当前边界 |
| --- | --- | --- | --- |
| MealProvider/manifest | 发布Catalog/Price及health | Runtime loader/Registry | F-0112 |
| BrandCatalog | 从endpoint键解析七品牌门店scope | MealProvider | F-0114/DC-0035 |
| MealMapper | 七品牌菜单、价格与record error映射 | Catalog/Price ports | F-0115 |
| OrderDraft/Webhook | 禁用写入/回调协议资产 | 仅测试或无caller | DC-0034/DC-0026 |
| package/tests | 依赖、构建与KFC样例 | npm/Vitest | F-0114/F-0115 |

[FACT][E-AU-027-001] 12文件507行深入审阅；随Commerce OCI发布，无独立表、进程或制品。

## 34. AU-028 Book Provider 模块清单

| 子模块 | 职责 | 上游/入口 | 当前边界 |
| --- | --- | --- | --- |
| BookProvider/manifest | 发布九ports与十capabilities | Runtime loader/Registry | F-0116/F-0117 |
| BookMapper | canonical Catalog关键字段 | PortFactory | 通用映射 |
| Wenxuan adapter | HMAC与VendorClient | BookProvider | 共享F-0096/F-0097 |
| Webhook/ErrorMap | 通用回调与错误兼容导出 | Channel/公共barrel | DC-0026/DC-0036 |
| tests | provider身份和签名 | Vitest | F-0118 |

[FACT][E-AU-028-001] 9文件79行深入审阅；随Commerce OCI发布，无独立表、进程或制品。

## 35. AU-029 Directcharge Provider 模块清单

| 子模块 | 职责 | 上游/入口 | 当前边界 |
| --- | --- | --- | --- |
| DirectchargeProvider/manifest | 发布万联直充相关ports/capabilities | Runtime loader/Registry | F-0119/F-0120 |
| DirectchargeMapper | canonical Catalog关键字段 | PortFactory | 通用映射 |
| Wanlian adapter | RSA与VendorClient | DirectchargeProvider | 共享F-0096/F-0097 |
| Webhook/ErrorMap | 通用回调与错误兼容导出 | Channel/公共barrel | DC-0026/DC-0037 |
| tests | provider身份和签名 | Vitest | F-0121 |

[FACT][E-AU-029-001] 9文件79行深入审阅；随Commerce OCI发布，无独立表、进程或制品。

## 36. AU-030 Jdfresh Provider 模块清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| Provider/manifest | JD生鲜Catalog/库存/订单/物流/退款/对账 | F-0122/F-0123 |
| Mapper/Vendor | canonical字段与JD共享传输 | 继承F-0096/F-0097 |
| Webhook/ErrorMap | 回调与兼容导出 | DC-0026/DC-0038 |
| tests | provider身份/签名 | F-0124 |

[FACT][E-AU-030-001] 9文件79行深入审阅；无独立表、进程或制品。

## 37. AU-031 Jdproduct Provider 模块清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| Provider/manifest | JD产品Catalog/Inventory/Order/物流/退款/对账 | F-0125/F-0126 |
| Mapper/Vendor | canonical字段与JD共享传输 | 继承F-0096/F-0097 |
| ErrorMap/Webhook | 回调与错误封装导出 | DC-0026/DC-0039 |
| tests | provider身份与签名 | F-0126 |

[FACT][E-AU-031-001] 9文件79行深入审阅；无独立表、进程或制品。

## 38. AU-032 Movie Provider 模块清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| Provider/manifest | Movie能力声明与本地化端口 | 待更新 |
| Mapper/Vendor | catalog/price/stock/订单映射 | 当前待补：需与 F-0130/F-0131一致 |
| ErrorMap/Webhook | 通用错误封装与公共导出 | DC-0026 |
| tests | provider身份与签名 | 当前待补 |

[FACT][E-AU-032-001] 9文件79行深入审阅；无独立表、进程或制品。未完成 provider 契约收敛专项。

## 39. AU-033 Private Provider 模块清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| Provider/manifest | local install与channels DB ports映射；能力声明 | F-0127/F-0128 |
| Local adapter | `createPrivateProviderInstallation` 提供 catalog/stock/order/tracking/refund/statement | F-0127/F-0128 |
| ErrorMap/Webhook | 错误前缀与公共导出 | DC-0026/DC-0040 |
| tests | provider身份与签名 | F-0129 |

[FACT][E-AU-033-001] 9文件79行深入审阅；随 Commerce OCI 发布，无独立表、进程或制品。

[FACT][E-AU-041-001] AU-041 复核`F-0127/F-0128/F-0129`与`ProviderLoader` local分支一致性；结论：本单元无新增缺陷，既有问题继续沿用 AU-033 风险定义。

## 40. AU-034 Tmallmarket Provider 模块清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| Provider/manifest | remote transport与`operations`映射到vendor端点 | F-0130/F-0131 |
| Mapper/Webhook | canonical字段映射与webhook入口 | DC-0026/DC-0041 |
| ErrorMap | 错误前缀与公共导出 | DC-0041 |
| tests | provider身份与签名 | F-0131 |

[FACT][E-AU-034-001] 9文件79行深入审阅；无独立表、进程或制品。

后续复核：AU-040补充确认 `F-0130/F-0131` 在 `ProviderLoader` 与 `directcharge/jobs/consumer` 上的当前运行一致性，无新增问题。

## 41. AU-035 Tmall Vendor Adapter 模块清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| Auth/Client | HMAC 凭据构造与 `VendorClient` 工厂 | F-0133 |
| Signer/RatePolicy/CircuitPolicy | 对 `vendorcore` 通用能力的包级转发导出 | DC-0042 |
| tests | vendor 认证工厂与签名收敛 | F-0133 |
| package/配置 | 包接口与发布边界 | [FACT][E-AU-001-007] |

[FACT][E-AU-035-001] 8文件8条人工关键文件/全部深度审阅；与 provider 实例链路已闭合映射。

## 42. AU-036 JD Vendor Adapter 模块清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| Auth/Client | RSA 凭据构造与 `VendorClient` 工厂 | F-0134 |
| Signer/RatePolicy/CircuitPolicy | 对 `vendorcore` 通用能力的包级转发导出 | DC-0043 |
| tests | vendor 认证工厂的最小覆盖 | F-0134 |
| package/配置 | 依赖、tsconfig 与脚本边界 | [FACT][E-AU-001-007] |

[FACT][E-AU-036-001] 8文件33行人工关键文件/全部深度审阅；与 JD providers 的 adapter 链路已核验映射。

## 43. AU-037 Wanlian Vendor Adapter 模块清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| Auth/Client | RSA 凭据构造与 `VendorClient` 工厂 | F-0135 |
| Signer/RatePolicy/CircuitPolicy | 对 `vendorcore` 通用能力的包级转发导出 | DC-0044 |
| tests | vendor 认证工厂与签名闭合 | F-0135 |
| package/配置 | 依赖、tsconfig 与脚本边界 | [FACT][E-AU-001-007] |

[FACT][E-AU-037-001] 9文件45行人工关键文件/全部深度审阅；与 directcharge/movie provider 实例链路已核验映射。

## 44. AU-038 Wenxuan Vendor Adapter 模块清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| Auth/Client | HMAC 凭据构造与 `VendorClient` 工厂 | F-0136 |
| Signer/RatePolicy/CircuitPolicy | 对 `vendorcore` 通用能力的包级转发导出 | DC-0045 |
| tests | vendor 认证工厂与签名闭合 | F-0136 |
| package/配置 | 依赖、tsconfig 与脚本边界 | [FACT][E-AU-001-007] |

[FACT][E-AU-038-001] 9文件45行人工关键文件/全部深度审阅；与 `book` provider 实例链路已核验映射。

## 45. AU-039 Movie Provider 模块清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| manifest | capability/permissions/eventSubscriptions 与 provider definition | F-0130/F-0131 |
| Provider/Mapper | operations 与 provider port 映射（并行自 `@shop/providercore` 能力） | F-0130/F-0132 |
| ErrorMap/Webhook | 错误码注入与 webhook 继承 | DC-0040 |
| tests | factory 与签名约束最小验证 | F-0132 |
| package/配置 | 依赖边界与脚本 | [FACT][E-AU-001-007] |

[FACT][E-AU-039-001] 9文件79行人工关键文件/全部深度审阅；与 providerLoader + directcharge/jobs/consumer 映射已核验。

## 64. AU-058 Checkout 结算报价模块清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| Quote model/policy/reader | 购物车事实、资格、价格、库存、营销与 tender 的可签名报价 | F-0139/F-0140；F-0147 |
| Checkout HTTP/persistence | quote/session/evidence/outbox 写入、地址加密与默认地址并发约束 | F-0147 |
| Signer/ports | 稳定 HMAC quote 签名、确认/过期 session 与完整 Commerce 适配器 | F-0147 |
| Purchase selected module | session-scoped quote context、benefit-only + WeChat tender、禁用 voucher | [FACT][E-AU-058-001~003] |
| 数据迁移/RLS | cart、checkout session/evidence、address default 与 purchase role 列/RLS 限制 | [FACT][E-AU-058-003~005] |
| tests | 地址/跨 Mall/manifest/全局版本不变量；缺 handler/integration 契约 | F-0147 |

[FACT][E-AU-058-007] 17 文件、955 行 checkout 人工源码完成深审；购买 runtime 与迁移/RLS 交界完成结构性追踪。

## 65. AU-059 Order 订单模块清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| PlaceOrder/ports | 报价重验、资源预留、订单/行/子单/支付计划与 outbox | [FACT][E-AU-059-001~002] |
| HTTP read/aftersale | 查询、提醒、导出、售后申请/审核 | F-0148 |
| receipt/expiry | 履约收货门槛、稳定 event、付款过期释放 | [FACT][E-AU-059-003~004] |
| Purchase selected module | Purchase API 的唯一 order create 操作 | [FACT][E-AU-059-001] |
| tests | 收货和部分售后 mock oracle；缺创建/退款完整链 | F-0148 |

[FACT][E-AU-059-007] 16 文件、1,139 行 order 人工源码完成深审。

## 66. AU-060 Payment 意图与捕获核心模块清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| intent/prepay/read | 意图计划、provider 参数、未知恢复和 member/mall 读取 | [FACT][E-AU-060-001~002,005] |
| capture/allocation | tender 消费、库存/营销提交、支付/履约/outbox 与经济分摊 | [FACT][E-AU-060-003] |
| Wechat adapter/time | scene/application hash、通知/查询协议与 provider 会计时刻 | [FACT][E-AU-060-004] |
| tests | recovery、状态机、Mall、allocation 与 accounting time | [FACT][E-AU-060-006] |

[FACT][E-AU-060-007] 27 文件、1,732 行 payment intent/capture 人工源码和测试完成深审；退款、webhook 和 job files 保留 AU-061。

## 67. AU-061 Payment webhook、退款与恢复模块清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| webhook/inbox | 验签后按 payment/refund 事实定位、核验、接收 inbox 与投递 job | [FACT][E-AU-061-001] |
| query/late-payment | provider 查询、关闭、过期、晚到付款、effect 封存与 recoverycase | [FACT][E-AU-061-002] |
| refund/settlement | tender 退款计划、provider 退款、内部资金恢复、供应售后回放与 outbox | F-0148；[FACT][E-AU-061-003] |
| deadletter/recovery | job 死信归属、管理员重放/查询/重试/结案 | [FACT][E-AU-061-004] |
| tests | provider time/effect、mall identity 与静态数据库边界 | F-0149 |

[FACT][E-AU-061-007] 9 文件、1,420 行 payment webhook/refund/recovery 人工源码和测试完成深审；Payment 模块所有人工代码已按 AU-060/061 分单元覆盖。

## 68. AU-062 Fulfillment 履约、tracking 与退货模块清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| create/submit | payment 成功按 suborder 创建 fulfillment/line，provider Order.submit | F-0150 |
| tracking/events | provider Logistics 查询、milestone 去重、shipped/received 事件 | F-0127；[FACT][E-AU-062-002] |
| shipment/returns | 人工 shipment、return 收货/质检与 inventorysync | [FACT][E-AU-062-005] |
| supplier aftersale | 已退款售后写 supplier return fact/responsibility | [FACT][E-AU-062-005] |
| tests | mall identity 与 manifest | F-0150 |

[FACT][E-AU-062-007] 13 文件、418 行 fulfillment 链完成逐文件审阅；其中 FulfillmentJobs 138 行已由 AU-041 深审并在本单元复核，新增覆盖 12 文件、280 行。

## 69. AU-063 Finance 事件记账与供应商会计模块清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| inbox/journal | 消费不可变 event、重查业务事实、生成唯一双分录 journal | [FACT][E-AU-063-001~002] |
| cancellation | 取消订单只反转外部 tender 的既有 accrual | [FACT][E-AU-063-003] |
| supplier facts | 供应商 sale/cost 与 aftersale reversal | [FACT][E-AU-063-004] |
| tests | event/reversal/供应商会计 mock oracle | [FACT][E-AU-063-005] |

[FACT][E-AU-063-006] 8 文件、880 行 Finance ledger 人工源码和测试完成深审；结算、对账、提现、发票、读写 API 与 jobs 留 AU-064。

## 70. AU-064 Finance 结算、对账、提现与发票模块清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| reconciliation | event journal 与 provider statement CSV/hash/匹配/差异 | [FACT][E-AU-064-001] |
| settlement | reconciliation frozen basis、policy split、settlement line/split | [FACT][E-AU-064-002] |
| payout | partner/referral withdrawal、provider idempotency、paid journal | [FACT][E-AU-064-003] |
| invoice/deadletter | 发票签发/存证和金融失败状态收口 | F-0151 |
| tests | settlement PGlite 与 payout mock；其余 job 缺口 | F-0151 |

[FACT][E-AU-064-006] 11 文件、988 行 Finance operations 人工源码和测试完成深审；Finance command/API/read/配置/迁移仍按独立单元继续。

## 71. AU-065 Finance 周期关闭、backfill 与 lifecycle 模块清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| lifecycle reads | reconciliation/settlement/withdrawal/hold/period/backfill 读取 | [FACT][E-AU-065-001] |
| period close | hash 固定、四眼批准、statement final 与 outbox | [FACT][E-AU-065-002] |
| backfill | 签核人与准备人分离、source/target 完整性 | [FACT][E-AU-065-003] |
| tests | manifest operation 形状 | F-0152 |

[FACT][E-AU-065-005] 3 文件、281 行 Finance lifecycle/API 人工源码和测试完成深审；Finance 专项命令/查询继续后续单元。

## 72. AU-066 Finance 提现申请、审批与恢复模块清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| create | settlement payable 余额上的 withdrawal 创建 | [FACT][E-AU-066-001] |
| decide | 四眼批准/拒绝与 stable job 入队 | [FACT][E-AU-066-002] |
| recover | deadletter uncertain/failed 的 source-aware 恢复 | [FACT][E-AU-066-003] |
| tests | referral uncertain recovery mock | F-0153 |

[FACT][E-AU-066-005] 4 文件、148 行 Finance withdrawal 人工源码和测试完成深审。

## 73. AU-067 Finance 发票申请、审批、红冲与查询模块清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| request commands | create/cancel/decide/red 与受管 invoice 过程 | [FACT][E-AU-067-001] |
| reads | member/operator profile、request/document/line 查询 | [FACT][E-AU-067-002] |
| tests | create mock 与过程拒绝 | F-0154 |

[FACT][E-AU-067-004] 3 文件、186 行 Finance invoice request 人工源码和测试完成深审。

## 74. AU-068 Finance 政策工作流模块清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| workflow/read | preview/manage、revision/current read | [FACT][E-AU-068-001~002] |
| typed policy | field/tax 输入与有效期 | [FACT][E-AU-068-002] |
| tests | 参数/领域输入 oracle | F-0155 |

[FACT][E-AU-068-004] 5 文件、524 行 Finance policy 人工源码和测试完成深审。

## 75. AU-069 Finance 结算审批、调整与快照模块清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| close settlement | settlement approve/reject、计提和平台分账结清 | [FACT][E-AU-069-001] |
| adjustment | adjustment request/approve/reject、facts 和新快照 | [FACT][E-AU-069-002] |
| authoritative snapshot | 来源/规则/行/分账/调整的版本化派生、冻结与复核 | [FACT][E-AU-069-003~004] |
| tests | PGlite 篡改拒绝、late exclusion、最终 journal | [FACT][E-AU-069-005] |

[FACT][E-AU-069-006] 3 文件、859 行 Finance settlement close 人工源码和测试完成深审；对账/账期/提现/发票等职责仍保持独立审计单元。

## 76. AU-070 Finance 对账差异处置与修复应用入口模块清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| difference manage | retry、resolve、approveitem、approve 与 job 交接 | F-0156 |
| repair commands | preview/submit/decide/reverse 的受控数据库过程接口 | [FACT][E-AU-070-002~003] |
| repair read/tests | scope receipt 与 wrapper 契约 | [FACT][E-AU-070-003~004] |

[FACT][E-AU-070-006] 5 文件、419 行 Finance reconciliation application 人工源码和测试完成深审；SECURITY DEFINER repair workflow/迁移与 PostgreSQL 集成测试保留 AU-071。

## 77. AU-071 Finance 对账修复数据库权威过程模块清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| repair facts/state | preview/submitted/executed/rejected/reversed、不可变两条 repair line/effect | [FACT][E-AU-071-001] |
| authoritative plan | payment/refund/provider/statement/ledger 事实重建与 hash | [FACT][E-AU-071-002~003] |
| execute/reverse | proof、四眼、journal/entry 核验、downstream lock 与精确冲销 | [FACT][E-AU-071-002] |
| integration test | PGlite 全迁移重放和状态机 oracle | [FACT][E-AU-071-004~005] |

[FACT][E-AU-071-006] 2 文件、1,926 行 Finance reconciliation repair 数据库权威过程和集成测试完成深审。

## 78. AU-072 Finance 财务概览读取模块清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| overview read | 闭包范围内 posted journal 的币种/会计科目聚合 | [FACT][E-AU-072-001] |
| tests | posted-only、decimal wire amount、watermark | [FACT][E-AU-072-002] |

[FACT][E-AU-072-003] 2 文件、104 行 Finance overview 人工源码和测试完成深审。

## 79. AU-073 Finance 账单与多运行模块读取模块清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| full finance read | entries/statement read、statement export | [FACT][E-AU-073-001] |
| selected operator read | operator selected module 的 finance statement/entry 读取 | [FACT][E-AU-073-002] |
| routing test | 完整 Finance operation catalog | [FACT][E-AU-073-003] |

[FACT][E-AU-073-004] 4 文件、346 行 Finance read variants 人工源码和测试完成深审；`finance.statements.read` 双实现差异记录为 F-0157。

## 80. AU-074 Finance 领域模型与策略模块清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| domain shapes | account/entry/hold/invoice/journal/payout/period/reconciliation/settlement 契约 | [FACT][E-AU-074-001] |
| policies | posting balance、settlement separation/split | [FACT][E-AU-074-002] |
| tests | 纯领域成功和拒绝边界 | [FACT][E-AU-074-003] |

[FACT][E-AU-074-004] 12 文件、207 行 Finance domain model/policy 人工源码和测试完成深审；ConfigFieldPolicy 已在 AU-068 审阅，不重复计数。

## 81. AU-075 Finance 公共能力与模块装配模块清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| public/manifest | capability、operation/event、dependency、http/job 声明 | [FACT][E-AU-075-001] |
| registrations | 完整 Commerce 与 Identity selected Finance 运行模块 | [FACT][E-AU-075-002] |
| tests | manifest 静态契约 | [FACT][E-AU-075-003] |

[FACT][E-AU-075-004] 4 文件、140 行 Finance public/manifest 人工源码和测试完成深审。

## 82. AU-076 Finance 发票适配器与签发任务模块清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| invoice gateway | 外部 invoice HTTP/PDF adapter | [FACT][E-AU-076-001] |
| invoice job | 解密、provider 调用、对象存储、签发状态/outbox | F-0158/P1 候选 |
| runtime boundary | jobs pool/shopjob 与 processor 注册 | [FACT][E-AU-076-003~004] |

[FACT][E-AU-076-006] 2 文件、124 行 Finance invoice adapter/job 人工源码完成首审；P1 候选必须在 AU-077 重新追踪实际 runtime/权限/调用链。

## 83. AU-078 Finance 发票完整性数据库模块清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| API lifecycle | frozen original/red request、approve/cancel、snapshot/action proof | [FACT][E-AU-078-001~002] |
| job lifecycle | claim、artifact、finalize/release/fail、outbox | [FACT][E-AU-078-003] |
| tests | PGlite migration/controlled boundaries；job cases skip | [FACT][E-AU-078-004~005] |

[FACT][E-AU-078-006] 2 文件、1,783 行 Finance invoice integrity migration 和集成测试完成深审；F-0158/P1 的修复必须衔接此既有协议。

## 84. AU-079 Finance 审计账与冻结资金读取模块清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| audit read | finance/invoice 审计 record scope/keyset read | [FACT][E-AU-079-001] |
| holds read | scope-authorized hold/account read | [FACT][E-AU-079-002] |
| tests | audit query route smoke | [FACT][E-AU-079-003] |

[FACT][E-AU-079-004] 2 文件、74 行 Finance audit/query 测试完成深审；FinanceLifecycleOperations 已在 AU-065 深审，本批只追加 holds read 复核。

## 85. AU-080 Finance 发票端口与运行模块装配模块清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| invoice port | job/gateway 的 typed input/receipt | [FACT][E-AU-080-001] |
| full module | Commerce FinanceRoutes 装配 | [FACT][E-AU-080-002] |
| selected module | Identity operator read subset | [FACT][E-AU-080-003] |

[FACT][E-AU-080-004] 3 文件、33 行 Finance port/module 人工源码完成深审。

## 86. AU-081 Pricing 运行入口、报价与策略模块清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| HTTP operations | offers 查询、pricing rule create/publish | [FACT][E-AU-081-001] |
| pricing port | provider/catalog pricebook、quote 持久化与过期清理 | [FACT][E-AU-081-002] |
| 运行调用链 | Catalog 导入/投影写价，Checkout/Purchase 保存 quote，Runtime cleanup | [FACT][E-AU-081-003] |
| public/manifest | capability、operation、依赖与 HTTP 入口声明 | [FACT][E-AU-081-004] |
| tests | 仅 manifest 静态声明 | F-0159/P1 候选的行为测试缺口 |

[FACT][E-AU-081-005] 10 文件、171 行 Pricing 人工源码和测试完成深审；规则已被 QuoteReader 读取，却只进入 evidence，未被定价计算消费，记录为 F-0159/P1 候选并转 AU-082 独立复核。

## 87. AU-082 Pricing Rule→报价金额独立复核清单

| 复核项 | 独立证据 | 结论 |
| --- | --- | --- |
| rule consumer 全集 | Commerce TypeScript 中的 `pricing.rule` 只有 write/publish、QuoteReader read 和声明 | 没有 `kind/condition/effect` 解释器或金额消费者 |
| quote calculation | QuoteReader subtotal/payable 仅由 `unitMinor` 与 marketing promotion 生成 | published rule 不改变任何 quote amount |
| contract/test | create request 是开放 object；Pricing 测试只锁 manifest | API 可写入任意规则结构但没有行为 oracle |
| 产品映射 | 需求将商城加价/价格规则映射到 pricing rule operation | 当前实现不能实现对应已承诺能力 |

[FACT][E-AU-082-004] F-0159 经与 AU-081 分离的消费者全集、报价演算和 contract/test 路径复查，结论一致，确认为 P1。

## 88. AU-083 WebBusiness Pricing 读取运行模块清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| selected module | WebBusiness 只暴露 `pricing.offers.read` | [FACT][E-AU-083-001] |
| scope resolver | storefront session 映射为 mall scope | [FACT][E-AU-083-002] |
| Pricing read | 有效 pricebook/price 的 sku 查询 | [FACT][E-AU-083-003] |
| entry/manifest/test | 独立 API 启动、路由白名单与 composition 说明 | [FACT][E-AU-083-004] |

[FACT][E-AU-083-005] 8 文件、332 行 WebBusiness Pricing 专项源码/测试完成深审；它是只读部署单元且只允许一个 Pricing operation。查询与完整 Pricing read 重复，当前语义一致；F-0159 的未生效规则仍覆盖此只读显示面。

## 89. AU-084 WebBusiness Catalog 与公开目录模块清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| authorized catalog read | supplier、storefront 和组织层级 listing 读取 | [FACT][E-AU-084-001] |
| public adapter | 无 session 的固定公开产品 GET 路由 | [FACT][E-AU-084-002] |
| tests | SQL page/summary、host binding 与购买锁定 | [FACT][E-AU-084-003] |

[FACT][E-AU-084-004] 4 文件、458 行 WebBusiness Catalog 读取和公开 HTTP adapter 完成深审；对外公开面不复用授权 read，只有数据库 public projection 可以提供商品，且响应始终禁止购买。

## 90. AU-085 WebBusiness 库存读取模块清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| selected availability read | scope closure 内 stock/reservation available 计算与 keyset | F-0160/P2 |
| full runtime comparison | 同 operation 的 mall-only availability read | [FACT][E-AU-085-002] |
| web database boundary | `zhudatuanwebapi` select/RLS | [FACT][E-AU-085-003] |

[FACT][E-AU-085-004] 1 文件、32 行 WebBusiness Inventory operation 完成深审；库存余额计算和 read-only role/RLS 已追踪，但与完整 API 的相同 contract scope 语义不同，记录 F-0160/P2。

## 91. AU-086 WebBusiness Reporting dashboard 模块清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| dashboard lifecycle | period/query/page/summary 与 projection-version cache key | [FACT][E-AU-086-001] |
| cache fallback | 共享 CACHE 缺失时进程内 TTL/FIFO bounded cache | [FACT][E-AU-086-002] |
| tests | hit/miss、cursor Date、fallback | [FACT][E-AU-086-003] |

[FACT][E-AU-086-004] 2 文件、215 行 WebBusiness Reporting operation 和行为测试完成深审；读路径不直接访问 projection offset，且 cache key 按 scope/projection version 隔离。

## 92. AU-087 WebBusiness Member 运行模块清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| profile/address read | session-bound member projection 与 own-address keyset | [FACT][E-AU-087-001] |
| address manage | KMS envelope、versioned save/default/delete | [FACT][E-AU-087-002] |
| mall lifecycle | node-context-bound hosted open / sovereign upgrade | [FACT][E-AU-087-003] |

[FACT][E-AU-087-004] 1 文件、83 行 WebBusiness Member selected operation 完成深审；Web role 通过 narrow SECURITY DEFINER session-context function 获得最低 member projection，而非读取 identity/access authority 表。

## 93. AU-088 WebBusiness Order 聚合读取模块清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| order main range | owner/supplier/store/organization closure 订单范围与 keyset/filter | [FACT][E-AU-088-001] |
| aggregate projection | lines、legs、stock、fulfillment、payment、finance、aftersale、operation history | F-0161/P2 |
| tests | 聚合 SQL/filter static oracle | [FACT][E-AU-088-003] |

[FACT][E-AU-088-004] 2 文件、217 行 WebBusiness Order operation 与测试完成深审；主订单/line/aftersale 的 web RLS 已存在，但 payment/finance select grant 没有对应 web RLS policy，相关 projection 记录 F-0161/P2。

## 94. AU-089 WebBusiness Benefit 账户/账本读取模块清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| account read | available/reserved/active lots 读取 | [FACT][E-AU-089-001] |
| ledger read | posted finance entry 的 benefit projection | [FACT][E-AU-089-002] |
| database boundary | session-bound security definer function 与最小 grant | [FACT][E-AU-089-003] |

[FACT][E-AU-089-004] 1 文件、36 行 WebBusiness Benefit operation 完成深审；web role 不直读 Finance，余额/账本均经按 session 重证的 narrow function 投影。

## 95. AU-090 WebBusiness 风险门禁适配器清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| risk evaluation | policy rollout/baseline、signals、block、velocity、最大风险结论 | [FACT][E-AU-090-001] |
| database boundary | read-only transaction、API context、risk RLS | [FACT][E-AU-090-002] |
| tests | deny、read failure、velocity current attempt | [FACT][E-AU-090-003] |

[FACT][E-AU-090-004] 2 文件、209 行 WebBusiness RiskGate 与测试完成深审；风险评估不具 risk mutation/outbox 权限，最终 access decision 仍由上层 decision sink 记录。

## 96. AU-091 Organization 层级读取与 WebBusiness 装配清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| layers read | 已授权 scope 内 unitclosure descendant 投影 | [FACT][E-AU-091-001] |
| module/public | capability、manifest、interface module 与兼容 export | [FACT][E-AU-091-002] |
| WebBusiness selected module | 仅公开 organization.layers.read，复用同一 operation | [FACT][E-AU-091-003] |
| tests | manifest 静态契约 | [FACT][E-AU-091-004] |

[FACT][E-AU-091-005] 8 文件、92 行 Organization 层级读取与 WebBusiness selected module 完成深审；未见重复查询实现或未经 scope 授权的层级读取。

## 97. AU-092 WebBusiness 公开目录数据库投影清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| guest catalog function | 已发布 application/release/listing 的商品、价、库存投影 | [FACT][E-AU-092-001] |
| privilege boundary | SECURITY DEFINER、固定 search path、仅 web API role 可执行 | [FACT][E-AU-092-002] |
| HTTP binding | host/default application 绑定与 query 参数转发 | [FACT][E-AU-092-003] |
| pagination | handler safe-integer 与 PostgreSQL integer 参数范围不一致 | F-0162/P2 |

[FACT][E-AU-092-004] 新增 1 个迁移文件、119 行完成深审；关联的 WebBusiness handler/test 已在 AU-084 深审。本批次确认公开读角色/发布边界，新增 F-0162/P2。

## 98. AU-093 Organization provisioning port 与商城创建链路清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| mall conflict/create | advisory lock、合法 parent/code、organization/closure/sourcebinding 写入 | [FACT][E-AU-093-001] |
| CreateMall orchestration | organization → catalog pool → experience application/binding → owner | [FACT][E-AU-093-002] |
| shared OrganizationPort | identity kind 读取；channel distributor 创建、改名和停用 | [FACT][E-AU-093-003] |
| public compatibility | 仅转发 interface port 的公开导出 | [FACT][E-AU-093-004] |

[FACT][E-AU-093-005] 新增 4 个 Organization 文件、93 行完成深审；CreateMall/ProvisioningOperations 与其测试为既有 AU-003 深审证据，本批次仅交叉核对调用链，无重复计数。

## 99. AU-094 Identity 公开端口与异步边界清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| capabilities/public contracts | identity read/manage 与跨模块端口声明 | [FACT][E-AU-094-001] |
| notification delivery | challenge 密文读取、attempt 状态迁移、deadletter | [FACT][E-AU-094-002] |
| retention/import | runtime job purge 与 member import principal 窄接口 | [FACT][E-AU-094-003] |
| Wechat token | runtime/registration 注入的第三方身份契约 | [FACT][E-AU-094-004] |
| tests | notification 状态和 worker 窄写边界静态 oracle | [FACT][E-AU-094-005] |

[FACT][E-AU-094-006] 7 文件、196 行 Identity 公开端口与关联测试完成深审；未见未声明的跨模块直写或第二套 notification 状态机。

## 100. AU-095 Identity 领域状态与密码策略清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| auth transaction | state/nonce/ticket/PKCE token 归约、hash 与 challenge | [FACT][E-AU-095-001] |
| identity subject | 手机 E.164 与 username 规范化、兼容变体 | [FACT][E-AU-095-002] |
| password policy | shared policy + scrypt KDF/verify | [FACT][E-AU-095-003] |
| tests | PKCE/auth ticket 和手机号 canonicalization 静态 oracle | [FACT][E-AU-095-004] |

[FACT][E-AU-095-005] 5 文件、151 行 Identity 领域状态与密码策略完成深审；认证交易的 PKCE challenge 在 ticket consume 时与 state/nonce/session 一并比较。

## 101. AU-096 Identity realm/account 与 SMS 登录边界清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| realm registry/account | entry host、target、application、membership/account realm 解析 | [FACT][E-AU-096-001] |
| password/mobile account lookup | containment + active client/organization membership + 歧义拒绝 | [FACT][E-AU-096-002] |
| SMS login challenge | purpose/destination/realm/expiry/lock 验证和条件消费 | [FACT][E-AU-096-003] |
| tests | registry host、realm membership、SMS SQL 状态 oracle | [FACT][E-AU-096-004] |

[FACT][E-AU-096-005] 4 文件、512 行 Identity realm/account 与 SMS 登录读取/消费链完成深审；无跨 realm 回退查询或非条件 challenge 消费。

## 102. AU-097 Identity persistence、AuthTicket 与 principal 适配器清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| WeChat binding | grant lock、冲突检测、active membership 条件绑定/消费 | [FACT][E-AU-097-001] |
| identity mutation | savepoint、outer transaction context、critical-write idempotency/outbox | [FACT][E-AU-097-002] |
| AuthTicket | state/nonce/PKCE/session/account/realm 绑定及单次交换 | [FACT][E-AU-097-003] |
| imported principal | shopjob 受控 ensure function | [FACT][E-AU-097-004] |
| tests | PGlite savepoint 与 ticket binding/consume oracle | [FACT][E-AU-097-005] |

[FACT][E-AU-097-006] 5 文件、277 行 Identity persistence 与票据适配器完成深审；未见外层 transaction 外的业务写入或可重复消费 ticket。

## 103. AU-098 Identity WeChat gateway 与 return-target 签名清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| return target | HTTPS 无凭据/fragment/query地址的短期 HMAC 证明 | [FACT][E-AU-098-001] |
| OAuth/code exchange | 场景专属 app/endpoint、state/code/response 格式 | [FACT][E-AU-098-002] |
| JSSDK | access token/ticket cache、页面 URL 规范化与 SHA-1 签名 | [FACT][E-AU-098-003] |
| configuration | 两场景完整性、固定 callback path、非私网 HTTPS | [FACT][E-AU-098-004] |
| tests | OAuth URL、场景端点、cache 和 callback 反事实 oracle | [FACT][E-AU-098-005] |

[FACT][E-AU-098-006] 3 文件、283 行 Identity 外部 WeChat 适配器与测试完成深审；未见由请求提供的 callback/return target 或跨场景 token 混用。

## 104. AU-099 Identity 模块装配与 FullIdentity operation 入口清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| full wrapper | core operations + WeChat gateway/KMS/audit/keys/ticket 装配 | [FACT][E-AU-099-001] |
| full business module | 完整 Commerce Identity module 与 principal/public ports | [FACT][E-AU-099-002] |
| registration modules | WeChat enabled selected module 与 core-only selected module | [FACT][E-AU-099-003] |
| manifest/public | capabilities、operations/events、public entry 和 HTTP declarations | [FACT][E-AU-099-004] |
| tests | stable manifest operation composition oracle | [FACT][E-AU-099-005] |

[FACT][E-AU-099-006] 6 文件、144 行 Identity 装配与模块声明完成深审；注册 API 的 runtime 分支已由入口选择，未见 core operation 通过 WeChat-disabled 运行单元暴露。

## 105. AU-100 Identity HTTP 会话票据与安全辅助链路清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| security helpers | cookie、target、challenge 条件消费 | [FACT][E-AU-100-001]；F-0163/P3 |
| session creation | password/SMS 登录、realm membership、session/assurance/ticket/outbox | [FACT][E-AU-100-002] |
| ticket/session management | current cookie exchange、session read/logout/list/revoke | [FACT][E-AU-100-003] |
| login intent | 认证 source node → database target realm/host intent | [FACT][E-AU-100-004] |
| tests | challenge realm mutation 与 cross-node intent oracle | [FACT][E-AU-100-005] |

[FACT][E-AU-100-006] 4 文件、594 行 Identity session/ticket 链完成深审；session/login intent 的主要 scope/realm 约束闭合，过期 challenge 失败计数差异见 F-0163/P3。

## 106. AU-101 Identity credential/password 与成员重置清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| member reset | exact owner、version/scope/reauth、全身份释放与历史保留 | [FACT][E-AU-101-001] |
| password change | current password、assurance、owner rotation、other session revoke | [FACT][E-AU-101-002] |
| password verify/reset | session-bound reauth；realm-bound OTP reset/transaction rollback | [FACT][E-AU-101-003] |
| tests | root reset identity release/owner protection oracle | [FACT][E-AU-101-004] |

[FACT][E-AU-101-005] 2 文件、369 行 Identity credential/reset 操作与测试完成深审；未见跨 scope reset、未锁 subject 释放或未撤销旧 session 的重置路径。

## 107. AU-102 Identity invitation 与后台成员管理清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| invitation reads | hashed invite 与 storefront terms/registration 投影 | [FACT][E-AU-102-001] |
| invitation create/revoke | scope、capability/governance、role/policy、destination/版本约束 | [FACT][E-AU-102-002] |
| member manage | employee account/create、authoritative governance update/status、session revoke | [FACT][E-AU-102-003]；F-0164/P2 |
| tests | operator invitation governance/scope/revoke static oracle | [FACT][E-AU-102-004] |

[FACT][E-AU-102-005] 2 文件、819 行 Identity invitation 与后台成员管理完成深审；operator invitation 边界由大量静态用例覆盖，后台 username canonicalization 缺口见 F-0164/P2。

## 108. AU-103 Identity 注册、挑战与邀请兑换清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| registration challenge | purpose、规范化 destination、registration hash、realm/account 绑定与通知 job | [FACT][E-AU-103-001] |
| member registration | invite/storefront 选择、advisory lock、terms、identity/account/member/membership 创建或复用 | [FACT][E-AU-103-002] |
| hosted storefront registration | hosted node idempotency boundary、consumer realm/account 与 membership 绑定 | [FACT][E-AU-103-003] |
| authenticated registration | session/assurance/cookies/ticket/login intent 与 WeChat bind 的事务闭合 | [FACT][E-AU-103-004] |
| tests | registration purpose、realm、duplicate、rollback、storefront/checkout、operator invitation 的查询行为 oracle | [FACT][E-AU-103-005] |

[FACT][E-AU-103-006] 2 文件、1,969 行 Identity 注册与挑战链完成深审；邀请和公开 storefront 注册都由 registration hash、条款、realm 和 identity mutation 共同约束，checkout 延迟电话校验为显式产品分支；未见新 P0–P3。

## 109. AU-104 Identity operation dispatch 与公开目录清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| full operation assembly | session、registration、invitation、credential、mobile/WeChat actions 合并后按 owned list 投影 | [FACT][E-AU-104-001] |
| registration operation assembly | core registration operation 集合与 WeChat wrapper 追加集合分离 | [FACT][E-AU-104-002] |
| HTTP catalog | operation ID、method、path、partition 与 registration ownership 不变量 | [FACT][E-AU-104-003] |
| integration-style tests | session realm/account、governance、proof、invitation、notification query oracle | [FACT][E-AU-104-004] |

[FACT][E-AU-104-005] 3 文件、682 行 Identity dispatch 与目录/综合测试完成深审；每个 core operation 只能由一个 action group 提供，遗漏 action 在装配时 fail-fast。

## 110. AU-105 Identity 手机、WeChat 与 step-up 操作清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| mobile challenge/change | current realm account、password/step-up proof、challenge/session/realm、credential/assurance/session rotation | [FACT][E-AU-105-001] |
| step-up challenge | 已验证手机号、session hash、五分钟 secret 与 notification job | [FACT][E-AU-105-002] |
| step-up completion | phone OTP、session level-3 assurance、可选 WeChat binding | [FACT][E-AU-105-003] |
| financial action proof | operation allowlist、canonical request hash、expected version 与 issued proof binding | [FACT][E-AU-105-004] |

[FACT][E-AU-105-005] 1 文件、293 行 Identity mobile/WeChat/step-up 操作完成深审；未见 caller-selected step-up destination、跨 realm account 修改或未绑定 canonical request 的金融 proof。

## 111. AU-106 Identity realm operation context 清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| runtime context | DI pool/audit/KMS/keys、password/step-up/ticket signer、node notification scope | [FACT][E-AU-106-001] |
| registration reference | invite/storefront mutual exclusion 与 slug 格式 | [FACT][E-AU-106-002] |
| validation/masking | invite/storefront error translation 与 mobile mask | [FACT][E-AU-106-003] |

[FACT][E-AU-106-004] 1 文件、73 行 Identity runtime context 完成深审；密钥职责与 registration context 边界明确，未见从请求注入 ticket signer 或 identity hash key 的路径。

## 112. AU-107 Identity WeChat session 与公开入口清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| public session actions | jsapi JSSDK/authorize 与 miniapp/jsapi exchange 场景限制 | [FACT][E-AU-107-001] |
| federated identity | realm/application/provider/subject unique identity、union transfer 与 revoked 拒绝 | [FACT][E-AU-107-002] |
| session/grant | active membership/target 校验、session/ticket 或短期 registration/account confirmation grant | [FACT][E-AU-107-003] |
| authenticated bind | current account、binding token、idempotency/audit 事务 | [FACT][E-AU-107-004] |
| tests | JSSDK、row lock、account confirmation、rollback 与 cross-realm return target oracle | [FACT][E-AU-107-005] |

[FACT][E-AU-107-006] 2 文件、436 行 Identity WeChat HTTP wrapper 完成深审；federated identity 不能直接跨 account 创建 session，ticket 只在 realm/target 匹配后签发。

## 113. AU-108 Audit 公开端口、读取 query 与 HTTP module 清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| AuditPort | append/read/archive/schedule 的跨模块 repository contract | [FACT][E-AU-108-001] |
| audit.records.read | authenticated scope、keyset page/cursor projection | [FACT][E-AU-108-002] |
| AuditModule | Commerce module → auditRoutes 唯一 HTTP 装配 | [FACT][E-AU-108-003] |

[FACT][E-AU-108-004] 4 文件、53 行 Audit 未覆盖接口层完成深审；append/archive/脱敏的实现证据已在 AU-051，未重复审阅。

## 114. AU-109 Benefit 发放、使用与异步任务清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| API | account/ledger/plan/budget/grant 的 scope、version、四眼与状态控制 | [FACT][E-AU-109-001] |
| checkout port | preview/reserve/consume/refund/release 与 finance journal | [FACT][E-AU-109-002] |
| Worker/deadletter | grant/revoke/expiry、outbox、预算过渡、失败释放/事件 | [FACT][E-AU-109-003] |
| tests | policy/manifest 静态 oracle；F-0165/P2 | [FACT][E-AU-109-004] |

[FACT][E-AU-109-005] 19 文件、949 行 Benefit 模块完成深审；业务状态机无行为测试见 F-0165/P2。

## 115. AU-110 Capability entitlement 目录与管理清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| HTTP operations | authenticated scope read/manage、keyset/version | [FACT][E-AU-110-001] |
| public port | Channel 配额 entitlement 写入复用 | [FACT][E-AU-110-002] |
| manifest/tests | capability operation/public entry 静态声明 | [FACT][E-AU-110-003] |

[FACT][E-AU-110-004] 7 文件、105 行 Capability 模块完成深审；未见跨 scope entitlement 更新或绕过 expected version 的更新条件。

## 116. AU-111 Channel HTTP 管理与 Capability quota 调用清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| distributor/binding | organization closure visibility、tenant binding state | [FACT][E-AU-111-001] |
| quota | Channel → CapabilityPort scope/version write | [FACT][E-AU-111-002] |
| provider replay | failed/unknown filtering 与 job type dispatch | [FACT][E-AU-111-003] |
| manifest test | HTTP/job/event static inventory | [FACT][E-AU-111-004] |

[FACT][E-AU-111-005] 3 文件、270 行 Channel 管理 HTTP entry 完成深审；Capability quota 写入没有 Channel 内部重复实现。

## 117. AU-112 Channel connection 生命周期与同步 Worker 清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| connection command | provider manifest/secret 校验、draft/update/test/enable/disable 状态转移 | [FACT][E-AU-112-001] |
| sync command/repository | enabled connection gate、sync run/hash、四类 runtime job 投递与 cancel | [FACT][E-AU-112-002] |
| domain model | connection transition 与同步输入/进度不变量 | [FACT][E-AU-112-003] |
| sync worker | Catalog/Price/Stock/Statement provider 调用、投影/finance/outbox/续页 | [FACT][E-AU-112-004]；cancel 与 finish 竞态见 F-0166/P2 |
| tests | 仅 manifest 静态 operation/job/event inventory | [FACT][E-AU-112-005]；行为测试缺口见 F-0167/P2 |

[FACT][E-AU-112-006] 8 文件、442 行 Channel connection 生命周期完成深审；创建与同步入口均绑定当前 scope，Worker 由 commerce job registry 注册。取消状态未参与最终回写条件，构成 F-0166/P2。

## 118. AU-113 Channel Webhook 接收与异步处理清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| ingress/resolver | connection scope 解析、extension Webhook port 验签与规范化 | [FACT][E-AU-113-001] |
| accept function | inbox 唯一键、KMS 原文元数据、原子 job 投递、RLS/grant | [FACT][E-AU-113-002]；既有 F-0094/P1 候选 |
| worker | row claim、provider operation 状态、tracking job、outbox、applied/ignored | [FACT][E-AU-113-003] |
| tests | Channel 目录仅有 manifest 静态目录 | [FACT][E-AU-113-004]；F-0167/P2 |

[FACT][E-AU-113-005] 7 文件、254 行 Channel Webhook 完成深审；验签、inbox/job 原子入库和 Worker 处理入口已由真实路由/数据库函数/job registry 交叉验证。F-0094 保持既有 P1 候选，未见新 P0。

## 119. AU-114 Channel operator read 模型清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| main Channel read | connection scope/id keyset、extension summary、sync run scope/time keyset | [FACT][E-AU-114-001] |
| identity selected read | sovereign identity runtime 的三项 Channel operator read operation | [FACT][E-AU-114-002] |
| runtime boundary | selected module 只注册白名单 operation，避免与同一 runtime 的完整 ChannelModule 冲突 | [FACT][E-AU-114-003] |

[FACT][E-AU-114-004] 3 文件、94 行 Channel read 链完成深审；两个运行单元的 connection/sync query 目前等价，但实现重复见 F-0168/P3。

## 120. AU-115 Channel provider-operation 端口清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| public operation port | provider/kind/idempotency/request hash 的 record、replay reference 与状态更新 | [FACT][E-AU-115-001]；F-0169/P2 |
| fulfillment caller | provider order submit 后的 operation/tracking 事务记录；operation replay 取内部 fulfillment reference | [FACT][E-AU-115-002] |
| payment caller | refund attempt/observation/authority 链更新 operation 状态 | [FACT][E-AU-115-003] |

[FACT][E-AU-115-004] 1 文件、42 行 Channel public operation port 完成深审；跨模块写入使用相同 idempotency key，但 hash conflict 未被调用端观测，见 F-0169/P2。

## 121. AU-116 Extension health 与 Channel 降级回写清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| health worker | scan、stage probe、metrics、version-bound health evidence、schedule | [FACT][E-AU-116-001] |
| state boundary | ExtensionStateSink 将 enabled connection 降级；同一 transaction 与 extension transition 一致 | [FACT][E-AU-116-002] |
| recovery | degraded 保持到显式 test/enable 替换，不自动 re-enable | [FACT][E-AU-116-003] |
| tests | 仅 manifest 声明测试 | [FACT][E-AU-116-004]；F-0170/P2 |

[FACT][E-AU-116-005] 4 文件、97 行 extension-health/Channel state boundary 完成深审；故障降级和人工恢复意图由运行手册与实际状态机一致证明。

## 122. AU-117 Channel 公共源类型契约清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| Catalog/Price/Stock/Statement type exports | 将 `@shop/contract` 的 provider source 类型稳定再导出 | [FACT][E-AU-117-001] |
| runtime consumer | ChannelSyncJob 直接调用 catalog/pricing/inventory/finance ports，而非 type aliases | [FACT][E-AU-117-002] |
| 删除候选 | 无仓内 import 不等于可删；这些是 Channel public API/潜在 SDK 编译契约 | G0 |

[FACT][E-AU-117-003] 4 文件、4 行 Channel 公共类型契约完成深审；无运行副作用，但保留公共接口责任。

## 123. AU-118 Channel 远程订单/退款类型契约清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| RemoteOrderSubmitter/RemoteRefundProvider | 对 contract port 的 public/application type-only re-export | [FACT][E-AU-118-001] |
| provider implementation | provider core PortFactory 实现 order/refund，运行时由 extension registry 给 fulfillment/payment | [FACT][E-AU-118-002] |
| 删除候选 | 仅仓内零 import；存在 module public API 与外部编译契约责任 | G0 |

[FACT][E-AU-118-003] 4 文件、4 行远程订单/退款类型入口完成深审；无运行副作用，不以零引用认定垃圾。

## 124. AU-119 Channel 外部对象映射模型清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| ExternalMapping | provider/object/external/internal/version 非空验证与外部 identity 组合 | [FACT][E-AU-119-001] |
| sync callers | price/stock 仅用它验证；实际 SKU 持久化映射由 CatalogSourcePort 负责 | [FACT][E-AU-119-002] |
| 删除候选 | identity getter 未见仓内直接消费者，但 constructor 是生产同步输入验证 | G0 |

[FACT][E-AU-119-003] 2 文件、11 行 ExternalMapping 及兼容入口完成深审；没有独立持久化职责。

## 125. AU-120 Channel 模块装配与兼容入口清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| root compatibility paths | 稳定导向实际 interface/application/public 文件 | [FACT][E-AU-120-001] |
| ChannelModule | 全量 API module、跨模块依赖和 extension state sink composition | [FACT][E-AU-120-002] |
| IdentityOperatorChannelModule | sovereign identity API 的三项 Channel read selected module | [FACT][E-AU-120-003] |
| public index | capability/port/type/manifest 公共导出与 interface export 分层 | [FACT][E-AU-120-004] |

[FACT][E-AU-120-005] 7 文件、37 行 Channel compatibility/module boundary 完成深审；完整 runtime 与 selected runtime 没有在同一 container 重复注册。

## 126. AU-121 Channel 兼容路径覆盖收口

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| legacy application/domain/infrastructure/interface paths | 23 个无逻辑转发，保持旧 import 到中文分层实现的兼容 | [FACT][E-AU-121-001]；G0 |
| ChannelCapabilities | read/manage 公共 capability 常量与类型 | [FACT][E-AU-121-002] |
| coverage | Channel 64/64 文件均有明确覆盖状态 | [FACT][E-AU-121-003] |

[FACT][E-AU-121-004] 24 文件、29 行 Channel 兼容层及 capability 完成深审；不以零逻辑转发认定可删除。

## 127. AU-122 Extension 安装与启停生命周期清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| manifest/contract | signed manifest parse/hash、identity/version、host exact contract | [FACT][E-AU-122-001] |
| install/reconfigure | registered manifest、secret/configuration、disabled/versioned repository write | [FACT][E-AU-122-002] |
| test/enable/disable | health candidate、atomic replacement、commit 后 loader activate/disable | [FACT][E-AU-122-003] |
| repository | installation lock/activation/history/outbox/health/scheduling persistence | [FACT][E-AU-122-004] |
| tests | policy/manifest only；F-0171/P2 | [FACT][E-AU-122-005] |

[FACT][E-AU-122-006] 8 文件、340 行 Extension lifecycle 完成深审；安装状态和运行 loader 的 commit/finalize 分界清晰。

## 128. AU-123 Extension read 与模块边界清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| installations read | repository list/keyset，RLS scope visibility | [FACT][E-AU-123-001] |
| HTTP/module | 单一 read operation 的 ModuleOperations/defineModule 装配 | [FACT][E-AU-123-002] |
| public/manifest/compat | public export、entrypoint/event 清单与旧路径转发 | [FACT][E-AU-123-003] |

[FACT][E-AU-123-004] 9 文件、99 行 Extension read/module boundary 完成深审；未见无 scope 的 installations list 路径。

## 129. AU-124 Extension 公共 repository 契约与领域测试清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| ExtensionLoader | loader/candidate/repository/health/state-sink 的唯一跨模块 type contract | [FACT][E-AU-124-001] |
| ExtensionRepositoryFactory | 注入 database 后构造既审 PgExtensionRepository | [FACT][E-AU-124-002] |
| Installation/Manifest tests | 状态机、签名 hash 与 manifest policy 的模型级规格 | [FACT][E-AU-124-003] |

[FACT][E-AU-124-004] 4 文件、88 行 Extension 公共契约和领域模型测试完成深审；测试未覆盖 command/transaction/loader finalize 行为，沿用 F-0171/P2。

## 130. AU-125 Extension 兼容入口与覆盖收口

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| legacy application/domain/infrastructure/interface paths | 11 个无逻辑转发，保持旧 import 到中文分层实现的兼容 | [FACT][E-AU-125-001]；G0 |
| coverage | Extension 35/35 文件均有明确覆盖状态 | [FACT][E-AU-125-002] |

[FACT][E-AU-125-003] 11 文件、11 行 Extension 兼容层完成深审；无独立运行逻辑，不以零引用认定可删除。

## 131. AU-126 Notification 入口与身份队列运行单元清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| Notification/Identity selected modules | 全量八项 HTTP operation 与 sovereign identity 两项 read 的独立装配 | [FACT][E-AU-126-001] |
| identity notification runtime | manifest/secret/database boundary 验证后创建仅 identitynotification 的 QueueJob 和 SMS delivery registry | [FACT][E-AU-126-002] |
| job/backlog tests | challenge payload whitelist、backlog 告警/恢复与 manifest inventory | [FACT][E-AU-126-003] |

[FACT][E-AU-126-004] 8 文件、386 行 Notification 入口、identity 专用运行单元和测试完成深审；generic processor/monitor 已由 AU-049/AU-050 深审并作为本链既有证据。

## 132. AU-127 Notification 投递渠道与配置链清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| delivery contract/registry | 以固定 channel id 选择投递 adapter，并拒绝重复或缺失注册 | [FACT][E-AU-127-001] |
| provider adapters | SMS、email、WeChat 和 in-app 各自处理 provider 请求、超时与回执 | [FACT][E-AU-127-002] |
| configuration | Commerce 读取全渠道配置；identity runtime 仅接受严格 SMS 配置 | [FACT][E-AU-127-003] |
| tests | provider idempotency/secret isolation、token cache 和 identity config rejection | [FACT][E-AU-127-004] |

[FACT][E-AU-127-005] 10 文件、359 行 Notification delivery/configuration chain 完成深审；未发现渠道注册与实际 runtime composition 不一致。

## 133. AU-128 Notification 偏好、模板、公告与读取链清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| capability/repository contract | 定义 read/manage capability 及全部 notification persistence/action contract | [FACT][E-AU-128-001] |
| preference/endpoint | membership-derived member、WeChat authorization、KMS envelope 与重新验证 owner | [FACT][E-AU-128-002] |
| template/announcement | domain validation 加 repository version/immutable transition 结果判定 | [FACT][E-AU-128-003] |
| reads | scope/member keyset read，storefront 与 operator 有不同 notification visibility | [FACT][E-AU-128-004] |
| tests | 仅 manifest/selected entrypoint 静态声明；F-0172/P2 | [FACT][E-AU-128-005] |

[FACT][E-AU-128-006] 11 文件、306 行 Notification management/read chain 完成深审；未见未绑定 access scope 的该链写入或读取入口。

## 134. AU-129 Notification 兼容入口与覆盖收口

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| legacy root/application/domain/infrastructure/interface paths | 27 个无逻辑转发，保持旧 import 到中文分层实现的兼容 | [FACT][E-AU-129-001]；G0 |
| public index | 仅输出 public/domain contract 与 module manifest，不暴露 command/adapter | [FACT][E-AU-129-002] |
| coverage | Notification 63/63 文件均有明确覆盖状态 | [FACT][E-AU-129-003] |

[FACT][E-AU-129-004] 28 文件、51 行 Notification compatibility/public entry 完成深审；不以仓内零引用作为删除依据。

## 135. AU-130 Catalog 入口、公共端口与导入 Worker 清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| Catalog modules/manifest | 完整 catalog 与 selected operator API 的 operation/dependency 边界 | [FACT][E-AU-130-001] |
| source/provisioning ports | source listing upsert、SKU keyset 与 mall private pool/binding 写入 | [FACT][E-AU-130-002] |
| catalog import Worker | import 状态推进、package reject/fault 和 jobs catalog registration | [FACT][E-AU-130-003] |

[FACT][E-AU-130-004] 7 文件、160 行 Catalog entry/public port/import worker 完成深审；未见 job manifest 与 jobs catalog 不一致。

## 136. AU-131 Catalog 商品池、listing 与发布任务链清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| catalog actions | pool/product/listing 读取与写入，以 actor/scope 分流 storefront/operator | [FACT][E-AU-131-001] |
| listing classification | 以 product/SKU/media/price/stock 条件形成 published/needs-attention/review 状态 | [FACT][E-AU-131-002] |
| publication lifecycle | expected-version single write、durable batch job、retryable failure 与 counter validation | [FACT][E-AU-131-003] |
| selected operator | 只组合 import read/create 与 listing publication actions | [FACT][E-AU-131-004] |

[FACT][E-AU-131-005] 5 文件、548 行 Catalog listing/publication chain 完成深审；已见操作级行为测试引用，但该测试文件仍待专项深审。

## 137. AU-132 Catalog 导入包、持久化与来源投影清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| upload/confirm | scope-hash lock、对象一致性、ready→running transition 与 runtime job 投递 | [FACT][E-AU-132-001] |
| package parser | bytes/hash/schema/source/validation/row normalization 上限 | [FACT][E-AU-132-002] |
| Pg import | 500 行 staging/validation、savepoint import、continuation/report lifecycle | [FACT][E-AU-132-003] |
| Cake source projection | provider source 至 catalog/pricing/inventory/media-job 的受限投影 | [FACT][E-AU-132-004] |

[FACT][E-AU-132-005] 5 文件、823 行 Catalog import/source projection chain 完成深审；对象扫描和 SHA 验证位于进入数据库分片前。

## 138. AU-133 Catalog 媒体复制、OSS 与 Worker 清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| replication/registration/persistence | 多 target 上传/head 验证后才 bind；否则解绑并持久化 replica 证据 | [FACT][E-AU-133-001] |
| target/OSS adapter | environment target→缓存 OSS client，上传 SHA metadata 并以 head 验证 | [FACT][E-AU-133-002] |
| media Worker | source URL 下载、registration、primary verified replica→coverUrl | [FACT][E-AU-133-003]；F-0173/P1 |

[FACT][E-AU-133-004] 9 文件、539 行 Catalog media replication chain 完成深审；媒体 target 可选/required 语义明确，但 source download 输入边界待独立复核。

## 139. AU-134 Catalog 媒体 URL 边界独立复核

| 复核范围 | 独立证据 | 结论 |
| --- | --- | --- |
| provider source → projection | ChannelSyncJob 直接接受 extension payload，projection 仅要求 imagePaths 为非空 strings | untrusted URL 语义未在此链收窄 |
| job runtime → fetch | dedicated CatalogJobsRuntime 默认构造 raw-fetch processor | 无代码级 egress/redirect/response-size boundary |
| tests | media worker/source projection tests 只断言 HTTPS 示例与基本失败 | hostile URL/size 反事实缺失 |

[FACT][E-AU-134-001] F-0173 双轮复核结论一致：保持 P1、高置信度；无 P0 事故运行证据。

## 140. AU-135 Catalog publication Worker 清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| publication Worker | 一项一事务地检查/发布 listing，并维护 scope-bound durable job payload | [FACT][E-AU-135-001] |
| checkpoint guard | processed/succeeded/failed/skipped 单调性和 failure count 守卫 | [FACT][E-AU-135-002] |
| tests | 完成、恢复与 progress conflict rollback | [FACT][E-AU-135-003] |

[FACT][E-AU-135-004] 2 文件、361 行 Catalog publication Worker 和行为测试完成深审；Worker 不将 listing 更新提交在未同步 durable progress 的 transaction 之外。

## 141. AU-136 Catalog 媒体复制测试清单

| 测试层 | 覆盖行为 | 当前边界 |
| --- | --- | --- |
| OSS adapter | put/head、missing 归一化、认证/网络错误、target credential | [FACT][E-AU-136-001] |
| replication coordinator | content addressing、target complete/incomplete、hash/optional/retry/public URL | [FACT][E-AU-136-002] |
| PGlite persistence | replication evidence、binding lifecycle、recovery、多 target、fixture/migration ledger | [FACT][E-AU-136-003] |

[FACT][E-AU-136-004] 3 文件、668 行媒体测试完成深审；媒体存储/持久化行为测试充足，source URL trust boundary 不在这些 fixture 覆盖内，沿用 F-0173/P1。

## 142. AU-137 Catalog 导入与操作测试清单

| 测试层 | 覆盖行为 | 当前边界 |
| --- | --- | --- |
| mall commands | import de-dup/confirm、listing/read/publish、publication progress/retry | [FACT][E-AU-137-001] |
| package | parse、scope-bound facts、stable validation error | [FACT][E-AU-137-002] |
| Pg import | stage-before-write、running facts、invalid-row isolation | [FACT][E-AU-137-003] |

[FACT][E-AU-137-004] 3 文件、438 行 Catalog import/operation tests 完成深审；测试直接验证关键 write boundary，而非只检查 manifest string。

## 143. AU-138 Catalog 风险、SKU 与迁移清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| risk decision action | 将 deny decision 转为 published listing 撤销和 outbox 事实 | [FACT][E-AU-138-001][E-AU-138-002] |
| SKU read port | 在 owner/source-listing scope 证明下解析 SKU id/code | [FACT][E-AU-138-003][E-AU-138-004] |
| migration/manifest tests | 验证 reverse lookup indexes、供应网络业务事实和 Catalog 声明清单 | [FACT][E-AU-138-005][E-AU-138-006][E-AU-138-007] |

[FACT][E-AU-138-008] 6 文件、239 行 Catalog 风险、SKU 与迁移测试完成深审；定向 Vitest 因审计 worktree 缺失依赖未验证，未将失败误写为代码缺陷。

## 144. AU-139 Catalog fixture 与兼容入口清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| test fixtures | 提供明确模拟的 package/media 输入给已审 fixture tests | [FACT][E-AU-139-001][E-AU-139-002] |
| root/legacy exports | 保持 public contract、旧路径 import 与 import worker startup path | [FACT][E-AU-139-003][E-AU-139-004]；G0 |

[FACT][E-AU-139-005] 10 文件、220 行完成深审；Catalog 70/70 文件已完成文件级覆盖，不将 compatibility export 的零本地逻辑误判为删除候选。

## 145. AU-140 Purchase composition 与支付边界清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| Purchase API composition | storefront-only session 后选择 checkout/order/payment operation | [FACT][E-AU-140-001] |
| purchase database functions | session-bound checkout/order/payment context 与 payment query enqueue | [FACT][E-AU-140-002] |
| tender/settlement | benefit session+intent、voucher/provider fail-closed、risk-gated internal capture | [FACT][E-AU-140-003][E-AU-140-004] |
| local tests | payment/policy/gateway local behavior；quote/order composition gap | [FACT][E-AU-140-005][E-AU-140-006]；F-0174/P2 |

[FACT][E-AU-140-007] 15 文件、645 行完成深审；Purchase 的真实部署入口和数据边界明确，但 quote/order composition 尚缺行为级规格。

## 146. AU-141 Runtime 专用健康与 API 装配清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| shared runtime health | API compatibility、queue/cache/metrics snapshot 与 audit access | [FACT][E-AU-141-001] |
| specialized profile health | Purchase/Web Business/Identity Registration/Mall Provisioning readiness compatibility | [FACT][E-AU-141-002] |
| registration | profile selected module、public exports、platform manifest/cleanup job | [FACT][E-AU-141-003][E-AU-141-005] |
| tests | shared SQL syntax 与 module identity；profile behavior gap | [FACT][E-AU-141-004]；F-0175/P2 |

[FACT][E-AU-141-006] 14 文件、432 行完成深审；profile health 为部署可观测边界，但缺少独立行为规格。

## 147. AU-142 Voucher HTTP 与状态策略清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| public/policy | voucher checkout/order/payment contract 和合法 state transition | [FACT][E-AU-142-001][E-AU-142-002] |
| full HTTP module | cardpool/program/reserve/batch/status/binding/redemption 写入和投影读取 | [FACT][E-AU-142-003][E-AU-142-004] |
| selected/operator registration | identity read-only subset 与 19-operation/four-job event manifest | [FACT][E-AU-142-005] |
| tests | policy/manifest only；HTTP behavior gap | [FACT][E-AU-142-006]；F-0176/P2 |

[FACT][E-AU-142-007] 12 文件、669 行完成深审；Voucher HTTP/data ownership 边界明确，但关键 write/read action 尚缺行为级规格。

## 148. AU-143 Voucher 导入与异步生命周期清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| public adapter | reserve/release/consume/refund/redeem verification 与 finance/state event | [FACT][E-AU-143-001] |
| import pipeline | encrypted staging、per-row savepoint、cursor continuation、report completion | [FACT][E-AU-143-002][E-AU-143-003] |
| lifecycle workers | issue/expiry/status 的 locking/chunk/policy/finance/outbox | [FACT][E-AU-143-004][E-AU-143-006] |
| deadletter/tests | failed terminal recovery；direct behavior test gap | [FACT][E-AU-143-005][E-AU-143-007]；F-0177/P2 |

[FACT][E-AU-143-008] 5 文件、534 行完成深审；Voucher 生产 job链清晰，测试缺口保持独立记录。

## 149. AU-144 Voucher 兼容入口与覆盖闭合清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| legacy wrapper | 保持 FinancePort 默认注入的老路径 VoucherPort caller | [FACT][E-AU-144-001][E-AU-144-003]；G0 |
| compatibility exports | old root/application/domain/infrastructure/interface imports 指向已审 canonical target | [FACT][E-AU-144-002]；G0 |
| public entry | 导出稳定 contract/policy/manifest，不泄露实现/worker | [FACT][E-AU-144-004]；G0 |

[FACT][E-AU-144-005] 14 文件、50 行完成深审；Voucher 47/47 文件已获得审阅状态，兼容路径保留不删。

## 150. AU-145 Mall Provisioning、模板克隆与域名购买清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| public DB ports | hosted-node 与 mall owner 的 canonical provisioning function boundary | [FACT][E-AU-145-001] |
| mall application | plan/preflight/organization→catalog→experience→owner write chain | [FACT][E-AU-145-002] |
| clone/domain policy | idempotent template clone 与 registrar-only domain purchase state/approval policy | [FACT][E-AU-145-003][E-AU-145-004] |
| registration/tests | full/dedicated API modules；HTTP action test gap | [FACT][E-AU-145-005][E-AU-145-006]；F-0178/P2 |

[FACT][E-AU-145-007] 18 文件、1,036 行完成深审；Provisioning transaction/data ownership 已可定位，HTTP composition 缺少行为规格。

## 151. AU-146 Provisioning compatibility 与覆盖闭合清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| legacy/root exports | 保留旧分层 import 到已审 canonical implementation | [FACT][E-AU-146-001]；G0 |
| public entry | stable port/domain/manifest surface，不导出 HTTP implementation | [FACT][E-AU-146-002]；G0 |
| consumers | 主应用和独立 Mall Provisioning API 使用 canonical registration | [FACT][E-AU-146-003]；G0 |

[FACT][E-AU-146-004] 9 文件、29 行完成深审；Provisioning 27/27 文件均已取得审阅状态，兼容路径保留不删。

## 152. AU-147 Member 运营读取、自定义资料与双入口清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| operator/storefront read | 治理树成员目录、商城消费者/详情/邀请关系/订单、邀请与导入状态读取 | [FACT][E-AU-147-001]；scope 与 keyset 在 action 层确定 |
| storefront custom profile | 商城自定义字段/标签定义、成员值与系统标签聚合 | [FACT][E-AU-147-002]；仅 mall scope，字段/值均按 organization_id 隔离 |
| full member composition | profile、地址写入、导入/open/upgrade/read/custom 的完整 Commerce module 组装 | [FACT][E-AU-147-003]；地址明文先经 KMS envelope |
| identity API selected module | 仅 operator read 与 storefront profile action 进入身份注册 API | [FACT][E-AU-147-004]；不暴露 hosted/open/upgrade/address/import 写入 |
| tests | PGlite 资料/读取事实与 entrypoint 路由装配 | [FACT][E-AU-147-005]；本 worktree 未能执行 Vitest |

[FACT][E-AU-147-006] 9 文件、1,056 行完成深审；Member 读写边界和双 API 运行入口可定位，尚余 public port、开通/主权升级和导入异步链待后续 AU。

## 153. AU-148 Member public port、开通/升级与导入异步链清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| public port/invite | storefront registration、profile、invitation、member-node registration、hosted/sovereign database-function port | [FACT][E-AU-148-001]；邀请条件与 host authority 由 SQL/parsed contract 共同限制 |
| open/upgrade HTTP | 从 access node context 注入 authority，再调用 public port | [FACT][E-AU-148-002]；body 仅携带业务资源 intent |
| member import | upload job 创建、staging、500 行 worker/savepoint、continuation/report/failed state | [FACT][E-AU-148-003][E-AU-148-004]；主 jobs catalog 实际注册 consumer |
| import read composition | 同名 action 在 spread 后被 MemberReadOperations 覆盖 | [FACT][E-AU-148-005]；F-0179/P2，report download 投影未执行 |
| public/tests | stable capabilities/public index 与 MemberPort fake-db tests | [FACT][E-AU-148-006]；导入 worker 没有直接行为 fixture |

[FACT][E-AU-148-007] 10 文件、723 行完成深审；Member 19/19 基线文件均已取得审阅状态，导入读取投影缺陷单独留档。

## 154. AU-149 Risk 策略、评估与异步处置清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| evaluation | scoped policy/signal/velocity/block-list 评估并持久化 decision | [FACT][E-AU-149-001]；最高 severity 决定 outcome |
| policy/case | candidate→replay→activate、独立 reviewer case transition | [FACT][E-AU-149-002]；activate 要求 replay passed |
| persistence/worker | decision/case/outbox；`riskscan` 回放或 catalog deny 处置 | [FACT][E-AU-149-003]；主 jobs catalog 实际注册 |
| API/public/tests | 3 项 HTTP operation 与 public risk gate | [FACT][E-AU-149-004]；F-0180/P2 组合测试缺口 |

[FACT][E-AU-149-005] 22 文件、810 行完成深审；Risk 主运行链可定位，legacy compatibility re-export 留待覆盖闭合单元。

## 155. AU-150 Risk compatibility 与覆盖闭合清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| legacy exports | English-layer application/domain/infrastructure/interface paths转发 canonical Risk实现 | [FACT][E-AU-150-001]；G0 |
| live consumer | legacy `interface/job/RiskReplayJob.ts` 被主 jobs catalog 实际导入 | [FACT][E-AU-150-002]；G0 |

[FACT][E-AU-150-003] 14 文件、14 行完成深审；Risk 36/36 文件均取得审阅状态，兼容路径保留不删。

## 156. AU-151 Inventory 库存、导入与异步链清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| stock/reservation | observe、catalog package stock、reserve/commit/release、aftersale restock | [FACT][E-AU-151-001]；stock lock 与 mall-scoped movement |
| HTTP/import | availability keyset 读取、upload/read report、stock row validation/import | [FACT][E-AU-151-002]；read report 通过 projectImport 授权投影 |
| workers | inventoryimport staging/savepoint/continuation 与 inventorysync return restock | [FACT][E-AU-151-003]；主 jobs catalog 实际注册 |
| tests | port reservation/return 与 manifest | [FACT][E-AU-151-004]；F-0181/P2 导入/HTTP直接覆盖缺口 |

[FACT][E-AU-151-005] 13 文件、643 行完成深审；Inventory 核心运行链可定位，余下 legacy/root export 待覆盖闭合。

## 157. AU-152 Inventory compatibility 与覆盖闭合清单

| 子模块 | 职责 | 当前边界 |
| --- | --- | --- |
| root/legacy exports | root module/operation/port、domain and job old paths 转发 canonical layer | [FACT][E-AU-152-001]；G0 |
| live consumers | main app uses root module；jobs catalog uses legacy job exports | [FACT][E-AU-152-002]；G0 |

[FACT][E-AU-152-003] 7 文件、18 行完成深审；Inventory 20/20 文件均取得审阅状态，兼容入口保留不删。
