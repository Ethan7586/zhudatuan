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
