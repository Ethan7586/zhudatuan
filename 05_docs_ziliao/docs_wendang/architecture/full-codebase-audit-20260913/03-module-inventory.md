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
| access | `settings/members` | feature/access/manifest.ts | 仅结构性审阅 |
| qualification | `settings/qualification` | feature/qualification/manifest.ts | 仅结构性审阅 |
| reports | `reports` | feature/report/manifest.ts | 仅结构性审阅 |
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
