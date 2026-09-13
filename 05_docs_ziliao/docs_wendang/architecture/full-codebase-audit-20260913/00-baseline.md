# 全代码库系统审计｜00 基线

## 1. 基线身份

| 项目 | 记录 |
| --- | --- |
| 审计日期 | 2026-09-13（Asia/Shanghai） |
| 基线远程分支 | origin/zdt-next |
| 基线完整 SHA | 5a1ce71eebbefaa826368a9e1dc17730f9363bc4 |
| 基线提交时间 | 2026-09-13T09:17:55+08:00 |
| 基线提交标题 | feat(release): 武汉 OSS Console 原子发布通道完成 |
| 本地审计分支 | codex/full-codebase-audit-20260913 |
| 审计 worktree | /Users/Ethan/.codex/worktrees/full-codebase-audit-20260913/zdt-next |
| 合并目标 | 无；该分支不是生产候选，禁止直接合并或部署 |
| 检查点 | CP-00 审计基线建立 |

本次基线在执行 git fetch origin --prune 后解析。审计分支直接建立在上述远程 SHA 上；后续 origin/zdt-next 的变化不会改变本次审计基线，审计期间禁止变基。

## 2. 建分支前状态与隔离

- 共享目录 /Users/Ethan/Desktop/zdt-next 当时位于 rescue/zdt-internal-salvage-2026-09-10，存在未跟踪文档、infrastructure、pnpm-lock.yaml 和 pnpm-workspace.yaml。该目录未被用于建分支，未暂存、未修改、未清理其中任何内容。
- 已有主线 worktree /Users/Ethan/.codex/worktrees/6ec2/zdt-next 无未提交文件；其本地 zdt-next 相对 origin/zdt-next 为 ahead 1、behind 217，因此没有移动或重置本地主线。
- 审计分支从明确的 refs/remotes/origin/zdt-next 新建到独立 worktree；建成后状态干净。
- 建分支前共有 107 条本地分支；建成后为 108 条。
- origin 下共有 40 条远程引用，其中 1 条是指向 origin/zdt-next 的符号引用，实际远程分支为 39 条。此次只创建本地分支，未增加远程分支。
- 审计分支固定后，共享仓库的 origin/zdt-next 引用又前进 2 个提交至 a1080036ef0dcd667416dfe758b5ff2320c78392；merge-base 仍是本次基线 5a1ce71eebbefaa826368a9e1dc17730f9363bc4。本审计按规则不吸收这两个后续提交。

## 3. 统计口径

所有统计都只针对基线 SHAs 5a1ce71eebbefaa826368a9e1dc17730f9363bc4 中由 git ls-files 返回的 4,238 个受控文件，不包含审计分支新写入的报告。

“人工源码”采用物理行口径，包含 TypeScript、JavaScript、SQL、CSS、HTML、Shell、systemd、Caddy、微信小程序样式及 Dockerfile 等可执行源码或运行配置；包含生产代码和测试代码，排除已确认生成文件、归档、编译产物、文档、二进制资源和结构化数据配置。文件末尾即使没有换行，也计为一行。

“人工结构化配置”包含 JSON、JSONC、YAML 和 TOML，排除已确认生成文件与归档。该数值单独报告，避免把大体量契约数据和锁文件混入源码行数。

| 分类 | 文件数 | 物理行数 | 基线处理 |
| --- | ---: | ---: | --- |
| 全部受控文件 | 4,238 | 不适用 | 全部进入覆盖清单 |
| 人工源码 | 3,073 | 322,808 | 后续逐文件或逐关键逻辑审阅 |
| 人工结构化配置 | 165 | 78,079 | 按运行、契约和部署关系审阅 |
| 已确认自动生成 | 69 | 172,512 | 不逐行评风格；核对生成器、输入、漂移闸门和消费者 |
| 视觉历史归档 | 507 | 310,037 | 不作为当前运行代码逐行审阅；保留来源与恢复价值核对 |
| 已跟踪编译产物 | 3 | 373 | 核对生成来源、暴露面和实际调用，不审压缩实现 |
| 其他文档、图片、字体及数据文件 | 421 | 未作为代码计数 | 按架构证据、资源引用或文档漂移审阅 |

人工源码与人工结构化配置合计 3,238 个文件、400,887 物理行。这是本次代码健康审计的主要人工审阅池，不代表当前已完成审阅。

### 3.1 主要文件类型

| 扩展名或类型 | 文件数 |
| --- | ---: |
| TypeScript .ts | 2,087 |
| SQL .sql | 434 |
| React TypeScript .tsx | 331 |
| Markdown .md | 234 |
| SVG | 209 |
| JavaScript module .mjs | 191 |
| PNG | 165 |
| JSON | 148 |
| CSS | 128 |
| JavaScript .js | 51 |
| systemd service | 42 |
| YAML .yml | 37 |
| HTML | 26 |
| WOFF2 | 23 |
| Shell .sh | 14 |
| CommonJS .cjs | 6 |

其余类型包括 JSONC、TOML、Caddy、systemd timer、微信小程序资源、PDF、XLSX、Mermaid 和 Canvas 文档。

## 4. 语言、框架、运行时与包管理

| 层 | 基线事实 |
| --- | --- |
| 主语言 | TypeScript、TSX、SQL、JavaScript/MJS、CSS、YAML、Shell |
| Node.js | 根 engines 声明 >=22.22.0；GitHub 工作流固定 22.22.0 |
| 包管理 | npm workspaces；package-lock.json lockfileVersion 3；根 package.json 未 packageManager 字段 |
| 类型与构建 | TypeScript 5.9.x；服务端由 esbuild 0.28.1 生成 ESM bundle |
| Console | React 19.2.8、React Router 8.3.0、Vite 8.1.5、TanStack Query/Table、Vitest |
| Auth Web | React 19、Vite 8、Vitest |
| Storefront | Next 16.3.4 的 App Router 目录形态，由 vinext 0.0.50 和 Vite 8 构建；同一入口兼容 Node host 与 Cloudflare Worker fetch |
| Canonical 服务 | Node ESM、pg 8.16.3、redis 6.2.1、Vitest；HTTP 层为仓库自有 NodeServer/OperationController 体系 |
| Compatibility API | Express 4.21.2；其 public router 被 Storefront worker 同源导入 |
| 数据库 | PostgreSQL；本地正式声明 postgres:17-alpine；仓库保留 Canonical 与 Storefront Compatibility 两套迁移树 |
| 本地缓存 | redis:7.4-alpine；生产连接由运行环境提供，线上版本尚未只读核验 |
| 浏览器测试 | Playwright 1.62.1 |

根工作区声明 43 个实际 workspace package：3 个 Web 应用、2 个服务、12 个共享包、19 个供应商/支付扩展包和 7 个内部工具包。miniapp 目录没有 package.json，不属于 npm workspace。

## 5. 顶层代码与制品布局

| 路径 | 受控文件数 | 当前基线角色 |
| --- | ---: | --- |
| 01_core_hexin | 2,437 | 应用、服务、共享包、供应商和支付扩展 |
| 02_platform_pingtai | 625 | 数据库、节点配置、发布与云/本地基础设施 |
| 03_quality_ceshi | 65 | 跨工作区浏览器、契约、集成、旅程、安全、性能和恢复验证 |
| 04_tools | 275 | 发布引擎、生成器、审计/检查脚本和本地设施工具 |
| 05_docs_ziliao | 810 | 产品、架构、运维、证据、视觉标准与历史版本归档 |
| .github | 4 | CODEOWNERS 和 3 个 GitHub Actions 工作流 |
| scripts | 1 | deploy-now.sh 手工发布入口 |
| 根文件 | 21 | 工作区、依赖、质量配置和项目治理文档 |

01_core_hexin 的真实一级边界为 apps、services、packages、extensions。02_platform_pingtai 的真实一级边界为 config、database、infrastructure。

## 6. 应用与前端入口

### 6.1 Console

- 路径：01_core_hexin/apps/console。
- 浏览器入口：src/main.tsx。
- 启动顺序：加载 Console runtime config，启动文档预取，再动态加载 app/providers。
- 路由入口：src/route/ConsoleRouter.tsx；React Router createBrowserRouter。
- 模块注册：src/route/ConsoleModuleRegistry.ts 当前显式注册 cockpit、control、applications、products、supply-chain、orders、referral、channels、vouchers、finance、storefront-members、access、qualification、reports、support 共 15 个 Console 模块。
- 构建入口：npm run build:console → @shop/console 的 vite build。
- 发布目标：console 静态制品。

### 6.2 Auth Web

- 路径：01_core_hexin/apps/auth-web。
- 浏览器入口：src/main.tsx；先解析内建身份节点或加载同源运行时节点配置，再渲染 App。
- 当前 App 为单入口身份界面，基线检索未发现独立 Browser Router。
- 构建入口：npm run build:auth → @smart-wing/auth-web 的 vite build。
- 发布目标：auth-web 静态制品。

### 6.3 Storefront

- 路径：01_core_hexin/apps/storefront-web。
- 页面入口：app/layout.tsx、app/page.tsx、app/[device]/page.tsx、app/h5/page.tsx 以及 desktop-1920 页面。
- Worker/Node fetch 入口：worker/index.ts。
- worker/index.ts 先调用 commerce-api 的 routePublicRequest，命中 API 时直接返回；否则交给 vinext/server/app-router-entry。
- 同一 fetch 入口通过 resolveEnv 同时适配 Cloudflare 注入环境和 Node process.env。
- 构建入口：npm run build:storefront → vinext build，随后运行 legacy CSS 与 H5 性能检查。
- 当前 release 配置把 Storefront 发布为阿里云 systemd 上的 vinext Node 服务；Cloudflare Worker 的独立部署配置未在受控文件中发现，Cloudflare 运行状态待专项核验。

### 6.4 Miniapp

- 路径：01_core_hexin/apps/miniapp/miniprogram。
- 当前只有 app.js、生成配置/领域文件、样式和品牌资源共 9 个文件。
- 基线中未发现 app.json、页面目录或微信开发者工具项目配置；不能据此认定已废弃，运行职责标记为“未验证”。

## 7. API、服务与后台任务入口

### 7.1 Canonical Commerce

- 路径：01_core_hexin/services/commerce。
- 共有 1,107 个文件，其中 1,096 个源码类文件，源码物理行约 65,026 行（包含生成文件和测试）。
- src/entry 下存在 API、Jobs、Migration、Ready 和 Smoke 入口。
- 全工作区构建脚本 build-commerce.mjs 会收集所有以 Main.ts 结尾的 entry，并额外构建 Owner/Registration bootstrap、Internal Runtime、Local KMS、Local Objects、Local Secrets 和 Postgres TLS Proxy。
- release engine 的 service-targets.mjs 把 10 个独立发布服务映射到精确 Main/Ready Main。
- 当前契约定义 operations.yml 声明 345 个 operation id；events.yml 声明 67 个 event id。是否全部真实注册、是否仍对外承诺，留给架构与契约阶段核验。

commerce/src/modules 下有 34 个业务或平台模块目录：

access、audit、benefit、capability、cart、catalog、channel、checkout_jiesuan、experience、extension、finance、fulfillment、identity、inventory、mall、marketing、member、notification、observability、order_dingdan、organization、partner、payment_zhifu、pricing、provisioning、purchase、qualification、referral、reporting、risk、runtime、support、verification、voucher、webbusiness。

其中模块根还包含 DomainPolicy.test.ts、ModuleCatalog.test.ts 和 RuntimeModule.ts，不属于上述任一目录。

### 7.2 Compatibility Commerce API

- 路径：01_core_hexin/services/commerce-api。
- publicRouter、storefrontRouter、authenticatedRouter、adminRouter 和 simulationRouter 由 src/api/router.ts 组织。
- publicRouter 被 Storefront worker 直接导入。
- adminServer.ts 是 Express 入口，监听默认 127.0.0.1:3001，含 health、AI 与静态 Console 处理；根 package 只提供 build:compat-admin-reference 构建它。
- 它未出现在 zdt-next.release.json 的独立发布目标中；实际生产责任待运行图阶段复核。

### 7.3 发布目标

02_platform_pingtai/infrastructure/release/zdt-next.release.json 声明 15 个发布目标：

1. catalog-media
2. storefront
3. auth-web
4. console
5. identity-api
6. identity-notification-jobs
7. mall-provisioning-api
8. support-api
9. purchase-api
10. web-api
11. catalog-api
12. catalog-jobs
13. payment-webhook-api
14. payment-jobs
15. database-migration

除静态/内容目标外，10 个服务目标均由 @shop/commerce 构建；数据库迁移目标打包专用 DatabaseMigrationExecutor、Canonical migrations 和 contracts/history.json。

### 7.4 Jobs、队列和定时入口

- app/jobs.ts 当前有 33 个 registerJob 声明，覆盖 channel、experience、transaction、payment、fulfillment、benefit、finance、notification、projection、export、risk、maintenance 和 import 等队列。
- JobsMain.ts 启动 RuntimeScheduler；JobRunner 使用数据库行锁、租约、心跳、重试和 runtime.deadletter。
- RuntimeEventPublisher 把事件投递到 PostgreSQL runtime.job；仓库还存在 InboxStore/Outbox 机制。
- 当前依赖中没有识别出独立消息代理客户端；已发现的异步任务主干是 PostgreSQL 队列表。Redis 主要作为 Cache 接口实现，语义仍待模块审阅。
- 独立发布 worker 为 identity-notification-jobs、catalog-jobs 和 payment-jobs；仓库还保留 FullJobsMain、JobsMain、PaymentJobsMain、IdentityNotificationJobsMain 等聚合或兼容入口，是否在线需通过 systemd 与发布记录二次核对。
- 两个 timer 文件分别为 zhudatuan-release-policy.timer 和 smart-wing-postgres-backup.timer。前者位于当前 zhudatuan production systemd 目录，后者位于 storefront-compatibility。

### 7.5 脚本与工具入口

- 04_tools/scripts：133 个文件；以审计、检查、生成、发布、provisioning 和证据脚本为主。
- 04_tools/release-engine：36 个文件；提供 plan、build、package、install、deploy 与远端 agent。
- 04_tools/tools：105 个文件；包含 contractgen、requirementgen、localinfra、localkms、localobjects、localsecrets、seed。
- scripts/deploy-now.sh：调用 GitHub CLI 触发 deploy.yml，并等待 workflow 结果。
- 上述区域合计包含 161 个 .mjs、87 个 .ts、3 个 .sh 和 1 个 .mts 文件；“存在脚本文件”不等于“已确认被生产调用”。

## 8. 数据、迁移、缓存、队列和对象存储

| 能力 | 代码事实 | 当前验证状态 |
| --- | --- | --- |
| Canonical 数据库 | 02_platform_pingtai/database/supabase；300 个迁移，60 个 SQL 测试；迁移 SQL 共 60,848 物理行 | 已建档，未重放 |
| Compatibility 数据库 | database/storefront-compatibility/supabase；57 个迁移，4 个 SQL 测试；迁移 SQL 共 10,681 物理行 | 已建档，未重放 |
| 本地 PostgreSQL | docker-compose 声明 postgres:17-alpine，绑定 127.0.0.1:5432 | 配置已核对，未启动 |
| 本地 Redis | docker-compose 声明 redis:7.4-alpine，绑定 127.0.0.1:6379 | 配置已核对，未启动 |
| 迁移执行 | GitHub/release engine 构建 database-migration-executor.mjs；执行前后读取 supabase_migrations.schema_migrations ledger | 入口已核对，行为未运行 |
| 异步队列 | PostgreSQL runtime.job、租约、重试、dead letter；事件经 RuntimeEventPublisher 入队 | 结构已识别，完整生产/消费配对待审 |
| 缓存 | redis 包与 RedisCache；Cache 接口还可能有其他实现 | 待专项审阅 |
| 业务对象存储 | HttpObjectStore、LocalObjectsMain、Catalog media 的 Aliyun OSS 适配器 | 边界待专项审阅 |
| 发布对象存储 | deploy-oss.yml 使用武汉 OSS 保存不可变 Console tar.gz 与 JSON manifest | 工作流入口已核对，未触发 |

两套数据库树在本次基线中均保留。任何“旧表、旧字段、兼容迁移无引用”的判断都必须在数据专项中通过读写调用、ledger 和回滚责任验证，不能据目录名判定。

## 9. GitHub、阿里云、制品与运行单元

### 9.1 GitHub 入口

| 工作流 | 触发 | 主要作用 |
| --- | --- | --- |
| .github/workflows/deploy.yml | workflow_dispatch | checkout 精确 SHA 或 zdt-next；release engine plan → build → package → 通过 SSH 直传阿里云 → production deploy |
| .github/workflows/deploy-oss.yml | workflow_dispatch | build Console 一次；生成 release-version.json；tar.gz 上传武汉 OSS；SSH 到 ECS 原子切换 console-static |
| .github/workflows/quality.yml | workflow_dispatch | 计算受影响范围、候选构建/制品、可选 staging 和验证；当前触发声明未包含 push 或 pull_request |

deploy.yml 明确使用 root@123.57.232.253，默认节点 hbbtzn-l1，可选 zhudatuan-l0。未执行任何 workflow，也未连接或修改线上资源。

### 9.2 制品关系

- release engine 的顺序为 plan → build → package → deploy。
- frontend 目标打包构建目录；service 目标只打包目标 Main/Ready Main bundle；database-migration 打包执行器、Canonical migrations 和 contract history。
- release config 声明两个逻辑节点：zhudatuan-l0 与 hbbtzn-l1。
- hbbtzn-l1 的 identity、storefront 和 identity notification 为节点独立运行；purchase、web、support、catalog、payment 与 database migration 多数通过 hostedBy 指向 zhudatuan-l0 物理运行单元。
- Console 另有武汉 OSS 不可变 tar.gz 通道；其 ECS 切换脚本为 04_tools/scripts/release/activate-console-static.sh。

### 9.3 systemd 声明库存

- zhudatuan production systemd 目录：33 个 unit/timer 文件。
- zhudatuan staging 目录：9 个 service 文件。
- storefront compatibility：1 个 PostgreSQL backup service 和 1 个 timer。
- 全仓合计 42 个 .service 与 2 个 .timer。

已确认的生产模板/服务族包括 SFL Storefront、Identity API、Identity Notification Jobs、API Gateway、Cloudflared、Catalog API/Jobs/Object Store、Web API、Purchase API、Payment Webhook/Jobs、Mall Provisioning、Secret Store，以及共享 Internal Runtime、Object Store、Migration、Registration DB、Owner/Registration Bootstrap、Console Support 和 Release Policy。

“仓库中存在 unit”与“线上当前启用 unit”严格区分。基线阶段没有读取生产 systemctl 状态、日志、current 指针或制品哈希。

## 10. 自动生成、第三方、构建产物与归档

### 10.1 自动生成文件

覆盖清单当前标记 69 个自动生成文件，主要来源如下：

| 生成器 | 输出范围 |
| --- | --- |
| 04_tools/tools/contractgen/src/ContractGenerator.ts | contract openapi/events、Operation/Schemas/Event serializer、SDK operation clients、Commerce 服务 OperationHandler/Controller/events、数据库 current.sql；miniapp api 目录存在时还会生成 identity/operations |
| 04_tools/tools/requirementgen/src/RequirementGenerator.ts 与 OrderRequirementProfile | requirements 下 mapping/requirements/mvp/providers/frontend/order，以及 RequirementCatalog.generated.ts |
| build-web-tokens.mjs | packages/design/src/tokens.css、Token.ts |
| build-miniapp-theme.mjs | miniapp tokens.wxss 与两个品牌 SVG 副本 |
| build-runtime-config.mjs | RuntimeCatalog.generated.ts、miniapp RuntimeLimits.js、CachePolicy.js |
| build-miniapp-environment.mjs | miniapp Environment.js |
| build-miniapp-contract.mjs | miniapp experience.js、deeplink.js |
| generate-node-manifests.mjs | config/node-manifests 下两个节点 manifest |
| check/sfl-node-kernel.mjs | sfl-node-manifests.generated.json |
| evidence/frontendmanifest.mjs | evidence/frontend/files.json |

生成代码不逐行做风格评审，但必须核对生成源是否权威、输出是否可重复、check 命令是否真正检测漂移、消费者是否仍使用输出，以及生成文件是否错误地承载人工逻辑。

### 10.2 第三方代码

- node_modules 未被跟踪，第三方 npm 代码不在逐文件清单中；依赖版本由 46 个 package.json（含根和 2 个视觉归档 package）及 package-lock.json 管理。
- 当前未识别出独立受控的 vendor/third_party 源码目录。extensions/vendors 是本项目业务供应商适配器，不按第三方代码排除。
- THIRD_PARTY_NOTICES.md 当前至少列出 qrcode-generator 和 Lucide；完整许可证与锁文件一致性留给供应链专项。
- 历史 Storybook preview 中含打包后的第三方代码，但整棵 version-upgrades 已按归档处理。

### 10.3 构建产物

当前运行树中受控的明确 dist 产物只有 Console 设计参考 kaidian 的 3 个文件：

- public/design-references/admin/kaidian/dist/index.html
- public/design-references/admin/kaidian/dist/assets/index-D8hfjiOE.css
- public/design-references/admin/kaidian/dist/assets/index-Dq9Y9kxY.js

它们仍位于 public 下，后续必须核对生产暴露策略和视觉参考入口，不能仅因是 dist 就删除。

### 10.4 归档

05_docs_ziliao/VI_shijue/version-upgrades 下 507 个文件统一标记为“归档文件”，包括历史源代码、Storybook preview、截图和说明。它们不作为当前 ZHU-VI-1.5 运行实现逐行审阅，但仍需在删除候选评审中证明历史恢复、视觉对照和许可责任。

## 11. 测试类型与正式入口

排除视觉历史归档后，共识别 640 个测试文件：

| 形态 | 文件数 |
| --- | ---: |
| .test.ts/.test.tsx/.test.js/.test.mjs | 536 |
| .spec.ts/.spec.tsx/.spec.js/.spec.mjs | 40 |
| tests 目录 SQL | 64 |

根 package.json 已声明以下正式入口：

- test / test:unit：各 workspace 的 test。
- test:contract：Commerce contract Vitest + 03_quality contracts Node tests。
- test:integration：Commerce integration Vitest + integration/recovery Node tests。
- test:component：workspace component tests。
- test:e2e：Playwright。
- test:journey、test:security、test:performance。
- test:sql、test:mvp 与多个 PostgreSQL 17 fixture。
- test:release-engine。
- typecheck、lint、build。
- quality:baseline 与 quality:canonical-hard-cut 为组合入口。

本阶段没有运行测试、typecheck、build、数据库重放或 npm install。原因是当前检查点只建立基线，且用户要求先识别正式入口、每阶段只运行与结论相关的定向验证、最终最多一次全量验证。

## 12. 已知文档/配置漂移区域

以下仅是已经有直接文本或注册证据的“漂移区域”，不是本阶段定级后的缺陷：

1. README.md 仍称当前契约为 217 个 operations；实际 definitions/operations.yml 在本基线声明 345 个 operation id。
2. README.md 引用 06_history_lishi/main_jiuzhuxian；该路径不在本基线受控树中。
3. DEPLOYMENT.md 仍以“正式 main 工程”和 releaseEligible=false 为前提；当前 GitHub deploy.yml 与 zdt-next.release.json 已定义 zdt-next 到阿里云 production 的直接发布链。
4. SOURCE-MANIFEST.md 和 artifacts.json 保留 Canonical/Compatibility 双轨与 releaseEligible=false 描述；当前 release manifest 已把 Storefront、Auth、Console、十个 Commerce 服务和数据库迁移纳入可部署 target。两者的权威关系待发布专项判断。
5. playwright.config.ts 注册 @shop/auth、@shop/store、@shop/supplier、@shop/storefront 五个 Web server 名称中的四个；它们都不在当前 package.json workspace name 集合中。仅 @shop/console 存在。测试尚未执行，不能先写成运行失败事实。
6. hbbtzn deployment YAML 同时写有 deploymentState: shared-kernel-candidate-not-cut-over 和 compatibility.status: shared-business-runtimes-production-active；release manifest 又给出 hbbtzn-l1 production deployment。需要线上只读证据区分“目标态、兼容态与当前态”。
7. Storefront 存在 Cloudflare Worker 兼容入口，但仓库未发现 wrangler 配置；当前 release target 与 systemd 明确走阿里云 vinext Node。Cloudflare Worker 是否只作为构建抽象、历史入口或另库部署，尚未确认。
8. miniapp 目录缺少常见页面与项目注册文件，但生成器仍写入其中。其产品状态和运行入口未知。
9. quality.yml 的 on 声明当前只有 workflow_dispatch，但内部条件仍处理 push 和 pull_request 上下文。是否有外部复用或有意手动化，待 GitHub Actions 专项复核。

这些区域会分别进入架构、测试、发布和文档漂移专项；在复核前不进入垃圾代码 G3 清单。

## 13. 本次纳入与排除范围

### 纳入

- 基线 SHA 下全部 4,238 个受控文件的文件级建档。
- 全部人工源码与测试源码。
- 全部数据库迁移、数据库测试、契约定义与 ledger 相关实现。
- 全部应用、服务、Worker、Jobs、systemd、timer、GitHub Actions、发布引擎和脚本。
- 当前 VI、静态资源、CSS 与生产 public 目录的引用关系。
- 根治理文档、架构/运行/运维文档与真实代码之间的漂移。
- 自动生成文件的生成源、可重复性、消费关系和漂移闸门。

### 排除逐行实现审阅，但保留结构与责任核对

- 69 个自动生成文件：审生成链，不评生成文本风格。
- 507 个视觉历史归档文件：审来源、当前引用、恢复与删除责任，不作为现行实现逐行审。
- 3 个已跟踪 dist 文件：审生成来源与暴露面，不反向审压缩 bundle。
- PNG、PDF、XLSX、字体等二进制内容：审来源、引用与敏感信息风险；需要视觉判断时才打开。
- 未跟踪的 node_modules、临时目录、本地缓存和构建输出：不属于基线 SHA。
- 线上实时状态：本阶段未连接生产，仅在后续发布/运行专项中按只读规则核验。

## 14. 审计方法与续接规则

1. CP-00 只建立事实基线与文件清单，不产生 P0–NIT 或 G0–GX 最终定级。
2. 下一阶段先建立 01-architecture.md、02-runtime-map.md 和 03-module-inventory.md，以注册、构建、启动和调用证据为准。
3. 架构图完成前，不开始“找垃圾代码”。
4. 之后一次只审一个模块或一条完整业务链路；每次更新覆盖清单并提交一个仅报告检查点。
5. P0、P1、G3、GX 必须在第二轮重新检查调用链与运行入口。
6. 测试失败只记证据，不在审计分支修复。
7. 所有生产代码、测试代码、配置、工作流、迁移、依赖和锁文件在本分支禁止修改。
8. 后续修复必须从当时最新 origin/zdt-next 新建独立小分支，不能基于本审计分支。

## 15. 本检查点结论

- 未发现已经由本阶段证据证明的 P0 线上事故；本阶段没有对问题作正式严重度定级。
- 已建立不可变基线、明确人工审阅池、识别真实构建/发布入口，并把所有受控文件纳入初始覆盖清单。
- 当前最大未知项是“声明态与线上运行态”的差异，尤其是双数据库、hbbtzn 托管关系、Cloudflare/阿里云边界、兼容 API 和聚合 Jobs 入口。
- 下一检查点应只完成真实架构与运行关系图，不进入具体模块缺陷修复或删除判断。
