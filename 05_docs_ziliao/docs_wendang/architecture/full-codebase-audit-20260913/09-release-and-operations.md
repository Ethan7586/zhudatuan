# 全代码库系统审计｜09 发布与运行

## 1. 固定基线上的权威发布入口

[FACT][E-AU-004-002][E-AU-004-004] 固定基线有三个可操作 GitHub 发布入口：`Deploy Direct`、`Quality and Candidate` 和 `Deploy Console via Wuhan OSS`，三者都只由 `workflow_dispatch` 触发。正式 release manifest 定义 15 个 target、2 个逻辑节点；两个逻辑节点当前都通过同一 SSH 主机 `root@123.57.232.253` 承载，但 `hbbtzn-l1` 的 8 个 target 明确由 `zhudatuan-l0` 托管。

~~~mermaid
flowchart LR
  User[人工 workflow_dispatch] --> Direct[Deploy Direct]
  User --> Quality[Quality and Candidate]
  User --> OSS[Wuhan OSS Console]
  Direct --> Plan[HEAD^ 或显式 target 规划]
  Quality --> PlanQ[affected 规划后清空验证动作]
  Plan --> Build[build + package]
  PlanQ --> Build
  Build --> Agent[ECS remote agent]
  Agent --> L0[zhudatuan-l0 target pointers]
  Agent --> L1[hbbtzn-l1 target pointers]
  OSS --> Bucket[OSS immutable tar + manifest]
  Bucket --> Script[activate-console-static.sh]
  Script --> L1Console[hbbtzn-l1 Console current]
  L0 --> Units[systemd / static roots]
  L1 --> Units
  Units --> Edge[Caddy 及 Cloudflared]
~~~

## 2. Direct 与受保护激活不是同一安全语义

[CONFLICT][E-AU-004-003][E-AU-004-004][E-AU-004-006] `Deploy Direct` 在规划和部署两处固定传入 `--direct`。Direct 仍验证 source SHA、归档哈希、树结构、关键文件并传播 systemd restart 错误；但它明确跳过 preflight、测试、类型检查、production approval、candidate checks、容量检查、Caddy 语义、目标进程变化、readiness、外部域名基线与失败后的自动健康回滚。仓库同时保留了执行上述检查的 guarded activation，所以不能把 Direct 的成功回执解释为完整生产验收。见 F-0015。

`Quality and Candidate` 也不是 Direct 的前置门禁：固定基线仅手工触发，部分验证 `continue-on-error`，并在 build 前清空 `requiredValidations`、tests 和 typecheck；candidate 只在显式输入时 staging，且只安装 agent。历史证明这是有意从旧 guarded 流程切换到 Direct，不是偶然遗漏。

## 3. 制品、指针与运行单元

| 制品类型 | target | 激活终点 | 运行方式 |
| --- | --- | --- | --- |
| 静态前端 | auth-web、console | target `current/static` | Caddy file root；无 systemd restart |
| Storefront | storefront | target `current/app` 与 content-addressed node_modules layer | `sfl-storefront@<node>` |
| Canonical 服务 | 10 个 service target | target `current` | 10 类 API/Jobs unit；HBBTZN 部分 hostedBy L0 |
| 数据迁移 | database-migration | source-SHA execution root | release 内一次性 executor；非常驻 unit |
| Catalog 媒体 | catalog-media | content pointer | 无 restart |

[FACT][E-AU-004-002][E-AU-004-011] 正式 unit 大多以 `User/Group=zhudatuan` 运行并启用 `NoNewPrivileges`、`ProtectSystem`、空 capability 等隔离。Storefront 使用 `DynamicUser=yes`，并非 root。API 主要用 ExecStartPost Ready，Jobs 用 ExecStartPre runtime preflight；Storefront 没有 systemd Ready，受保护发布依赖 remote health，而 Direct 不执行该 health。

## 4. Edge 与配置事实源

[CONFLICT][E-AU-004-007][E-AU-004-009][E-AU-004-010] 仓库 Caddy/Cloudflared/systemd 定义没有统一进入正式 Deploy：Caddy 变更被分类为全部 14 个非迁移业务 target，却不把 Caddyfile 打入制品或安装；普通 systemd 变更为零 target；Cloudflared unit 因规则叠加会选中全部 14 个 target，但仍不交付 unit。线上 active `/etc/caddy/Caddyfile` 又不等于固定基线或仓库历史中的任一 Caddy blob。正式 workflow 因而可能成功，却没有应用触发这次发布的控制面配置。见 F-0017。

[FACT][E-AU-004-010] 只读核验的实例 ID 为 `i-2zeewhay0farxq8lucrd`。观察时 HBBTZN Auth、Console 和根均为 200；fufu 根为 200，而 Auth 与 Console 均为 404。线上 L0 Caddy 读取 `/opt/sfl/nodes/zhudatuan-l0/current/.../dist`，对应 index 缺失；正式 release 更新的 `/opt/zhudatuan/targets/{auth-web,console}/current/static/index.html` 存在。F-0001 因此扩展为 Auth 与 Console 两个入口，但仍等待第二位审计者复核。

## 5. 第二条 Console 发布路径

[CONFLICT][E-AU-004-008] OSS workflow 与 release agent 都能改写 HBBTZN Console 的同一 `current` 指针。OSS 脚本验证下载哈希、release version、公网页面并能恢复旧指针，但没有使用 release agent 的项目/节点/target 锁；两个 workflow 的 GitHub concurrency group 也不同。没有观察到真实重叠执行，因此按 P2 记录“可并发双写、最后写入者获胜”的边界风险（F-0016），不写成已发生事故。

## 6. 节点控制面与 AutoNode

[FACT][E-AU-004-012] `install-ai-delivery-agent.sh` 是独立控制面安装器：agent 模式只安装 agent/policy，runtime 模式可安装选定 unit；当前 workflow 只调用 agent 模式。它没有一般 Caddy 安装流程。AutoNode 是另一条显式、手工、带 plan digest 的主权节点升级通道，使用 FILES→RELEASE→RUNTIME→IDENTITY→TLS→TUNNEL→DNS→SYSTEMD→PROCESSES→HEALTH→ACTIVE 的持久 ledger 和反向 compensation；固定基线上未发现 GitHub workflow 或正式 package command 调用它。

该 AutoNode ownership ledger、精确计划摘要、冲突拒绝和只回滚自己创建资源的设计值得保留；它同时证明“控制面另有实现”不等于“正式 Deploy 已应用控制面变更”。

## 7. 当前问题与验证状态

AU-004 新增 F-0015 至 F-0020：P1 候选 1、P2 5；并扩展既有 P1 候选 F-0001。累计为 P0 0、P1 候选 2、P2 16、P3 1、NIT 1。没有新增 G1、G2、G3 或 GX。

- release-engine 正式定向套件：79/80；唯一失败是 worktree 未安装 `esbuild`，属于环境阻塞。
- AutoNode 相关组合：4 个用例通过，4 个文件因本地缺 `tsx`/完整 TS loader 或 `pglite` 阻塞；不能写成实现失败或全量通过。
- 两份仓库 Caddy 配置使用生产 Caddy binary 经 stdin validate，均通过。
- `check:deployment` 在固定基线真实失败，报 `DEPLOYMENT_CONTRACT_MISSING:SmokeMain.js`，形成 F-0018。
- release-policy Shell 语法通过；行为测试需要 Bash 4，而本机 Bash 3.2，未执行。
- 未运行全量 build、全量测试、数据库重放、故障注入；未改变生产文件、unit、指针、网络、数据库或云资源。

完整 target、node、unit、edge、锁、失败传播和测试证据见 `records/AU-004-release-node-runtime-map/`。

## 8. AU-005 共享状态运行与恢复

### 8.1 运行单元

- `zhudatuan-registration-database.service`管理Docker PostgreSQL；数据不在release目录，而在host bind volume。
- `zhudatuan-internal-runtime.service`并联启动global Secret Store/KMS；`sfl-secret-store@.service`提供L0 node secret；`sfl-catalog-object-store@.service`分别提供L0/L1对象目录。
- full staging使用独立Internal Runtime DynamicUser和PostgreSQL TLS proxy；它与production registration Docker不是同一拓扑。
- Redis没有当前production daemon或正式dedicated target声明；连接由aggregate runtime从Secret Store解析外部URL。

### 8.2 发布图缺口

[CONFLICT][E-AU-005-003] release target/remote policy只有identity-notification、catalog、payment三类Jobs，没有OutboxRelay、RuntimeScheduler和cleanup owner。部署单个dedicated worker不能恢复通用outbox发布链，见F-0022。

### 8.3 恢复路径

- existing PostgreSQL volume可由Docker/systemd重启；fresh PG17 volume会进入与init版本guard冲突的路径，见F-0023。
- completed Local Objects随StateDirectory保留；未完成upload在进程重启时丢失。仓库未见current对象备份/restore入口。
- KMS仅有`local-v1`单master；没有仓库内keyring/rotation/rewrap。恢复依赖外部保留原master，负责人UNKNOWN。
- outbox/job状态随PostgreSQL持久；恢复是否发生取决于对应worker正式存在和claim语义，不由systemd active单独证明。

### 8.4 运维未知项

`delivery.yml`只表明采集器不得删除`database-backups`，不表明备份由谁创建、是否可restore。云快照、主机外timer、OSS版本控制与演练记录均未核验，统一保留UNKNOWN。完整责任表见AU-005 `recovery-ownership.csv`。

## 9. AU-006 配置、生成物与节点运行文件

### 9.1 发布前静态配置

- cache.yml与capacity.yml是RuntimeCatalog、Miniapp RuntimeLimits和CachePolicy的权威输入；build-runtime-config支持--check，check:generated会调用它。
- sfl-node-registry.declaration.json是L0/L1静态声明源；generate-node-manifests --check核对registry输出与每节点Manifest文件。
- Miniapp Environment.js由MiniappEnvironment schema生成并支持--check；不得手改生成文件。

### 9.2 启动时环境

正式systemd以EnvironmentFile把每节点键交给专用Main parser，parser失败直接阻止服务启动。专用Bootstrap再读取NODE_MANIFEST_PATH并核对digest、node/runtime/resource/secret/domain/feature。env example只证明预期键，不证明主机实际文件。

[CONFLICT] Catalog Jobs环境parser位于Commerce Bootstrap，不在@shop/config；环境所有权门禁又未识别该source alias，见F-0030。

### 9.3 Console节点运行文件

AutoNode从同一provisioning request生成Manifest和console-runtime.json，production provider激活时用active Manifest重解析runtime并记录console_runtime_digest，健康检查只请求JSON URL。浏览器会重新解析Manifest/artifact引用，但不核对runtime API/Identity URL属于Manifest domain，形成F-0029。

当前未读取生产console-runtime.json、env或Manifest，也未运行生成写模式、发布、激活或部署。

## 10. AU-007 契约制品与发布边界

- [FACT][E-AU-007-002/003/013] 四份 YAML 与权限目录经 contractgen 生成 tracked Contract/OpenAPI/SDK/Commerce 壳、事件 registry 和 `database/contracts/current.sql`；当前固定基线的源—产物集合只读复算一致。
- [FACT] OpenAPI/SDK 保留 345 个 Operation 及 runtime/frozen availability；Commerce Controller/Handler 与数据库发布面只包含 271 个 runtime Operation。Miniapp 两个条件目标因固定基线中目标目录不存在而未生成，不据此判为漂移。
- [CONFLICT][E-AU-007-010] generator 写模式对多个 tracked 文件顺序直接覆盖，后段失败没有统一回滚；Controller/Handler 加固还依赖未断言命中的文本替换，形成 F-0042。
- [STALE][E-AU-007-016] 当前 checksum 与旧配置/迁移中的值不同，但历史提交已移除 `database.contract` 的 runtime readiness authority；静态差异不能代替线上发布状态。
- [UNKNOWN] GitHub 生成检查是否在当前依赖完整环境通过、外部 OpenAPI/SDK 消费者、数据库实际发布行和活跃事件 backlog 均未核验。

本 AU 未运行生成写模式、未构建或发布制品、未推送、未部署。

## 11. AU-008 生成制品身份与候选传播

- [FACT][E-AU-008-013] candidate的`contractHash`是`SHA-256(openapi.json原始字节 + events.json原始字节)`，固定基线值为`9bc19d393714c7e9b70e89e0d18c263ca8d6c4097665ab7086a5b366fb70b4d4`。
- `events.json`只含type/version/module，event schema/handlers变化不会旋转该字段，补强F-0039；但Commerce OCI、commit、SBOM和candidate/stage证据仍提供其它溯源，不能夸大为全部制品不可追踪。
- SDK operation代码由Console/Auth/Storefront各自目录hash进入候选，Commerce generated shells由OCI hash覆盖；Miniapp两个domain模块随全部9文件进入Miniapp目录hash。`current.sql`不进入candidate。
- stage、promote、validate和validatebundle继续传播并核对这些分层hash。本AU只读源码并本地复算，未构建候选、未读取线上release、未推送、未部署。

## 12. AU-009 Kernel 制品与运维边界

- `@shop/kernel`为private workspace package且无独立build artifact、OCI、systemd unit、release target或线上配置。其代码随Commerce/Vendor/SDK/testing消费者编译，发布身份由这些上层制品hash承担。
- package声明 `sideEffects:false`；人工审阅确认barrel和大多数模块顶层只声明类型/常量。Deadline timer、Circuit/Rate/Semaphore状态都在显式构造后产生，不在module import时启动。
- Kernel变更会横跨多个上层制品，未来修复F-0047–F-0052必须从修复时最新 `zdt-next` 建立独立小分支，按单一原语定向测试后再做受影响typecheck/build；审计分支不是候选制品。

## 13. AU-010 Authz 制品与运维边界

- `@shop/authz`没有独立进程、镜像、systemd unit、端口或release target。它被编进Console、Commerce各API runtime、SDK/工具和测试制品；变更permission元数据还会经contractgen改变OpenAPI/checksum和数据库contract产物。
- 7个生产AccessPipeline构造者分别位于Commerce、Purchase、Console Support、Catalog Operator、Identity Registration、Web Business和Mall Provisioning runtime；Authz修复的验证面不能只跑包单测。
- Permission目录与Operation绑定当前源集合闭合，但线上数据库是否已应用同版本migration未核验；仓库产物一致不等于线上权限表一致。
- F-0053属于角色治理与可能的数据纠偏，F-0054属于二级授权调用，F-0055属于Scope闭表，三者必须拆成独立、可回滚批次。任何批次从当时最新`zdt-next`建立，不在审计分支开发。
- 本AU未生成候选制品、未运行production build、未推送、未合并、未部署，也未修改线上角色或授权数据。
- 本AU未运行全量build、未生成制品、未推送、未合并、未部署，也未改变任何线上资源。

## 14. AU-011 Smart Wing Authz 发布状态

- 包没有独立镜像、systemd unit、端口或release target；只可能随兼容Commerce API源码编译。
- 当前Storefront Worker只加载public router；delivery把`commerce-api/dist/admin-server.cjs`列为forbidden input，deployment checker把Commerce API列为retired。根仍保留`build:compat-admin-reference`手工构建入口。
- 因此“当前仓库正式图无受保护兼容运行单元”与“源码/测试/数据库契约仍存在”同时成立。删除或恢复前必须核验仓外/历史制品和线上主机，不能仅靠零正式target。
- 本AU未build、未生成兼容制品、未读取线上服务、未推送、未合并、未部署。

## 15. AU-012 兼容契约与交付事实

- `@smart-wing/api-contract`没有独立镜像、服务、端口或release target；其代码随Storefront与兼容Commerce源码编译。
- [CONFLICT][E-AU-012-005/006/007] 包内delivery matrix没有构建/发布消费者，四条微信证据路径不存在。根`check:delivery`实际验证`mvp.yml`与阿里云`delivery.yml`，不会检测矩阵漂移，形成F-0063。
- 因为矩阵保存唯一的五项逐平台状态且仓外流程UNKNOWN，列DC-0014/G2而不是G3；本AU没有修改、移动或删除它。
- 本AU未build候选、生成制品、读取线上发布、推送、合并或部署。

## 16. AU-013 Telemetry 发布与运维边界

- `@shop/telemetry`没有独立镜像、systemd unit、端口或release target；Node遥测随多个Commerce专用进程编译并写stdout，前端timeline随各自bundle发布。
- 两个client-error Operation虽有runtime契约、SDK和模块实现，但只由被禁止的完整ApiMain装载；专用生产入口没有分配该模块，形成F-0066。
- browser/miniapp adapters没有固定仓库生产caller，列G1而非删除候选；仓外平台消费者尚未排除。
- 本AU未build、未读取线上日志/服务、未推送、未合并、未部署。

## 17. AU-014 Testing 发布边界

- `@shop/testing`是private开发/测试依赖，无生产target、端口、进程或制品；正式测试检查还会拒绝生产源码import该包。
- Commerce package把它列为依赖，但固定源码只在Repository contract测试中import DatabaseHarness；其余root/browser工具无包外源码caller。
- 本AU未连接测试数据库、build、生成制品、推送、合并或部署。

## 18. AU-015 Interaction 发布边界

- `@shop/interaction`无独立制品、进程、端口或数据表；随Auth、Console和Storefront前端bundle发布。
- 所有核心导出均有生产消费者，变更影响至少三个前端，后续修复必须按Queue、Action、Feedback、Cache分成单一小批次。
- 本AU未build、打开页面、推送、合并或部署。

## 19. AU-016 旧设计包发布边界

- 旧包无进程/target；Storefront依赖边可能进入workspace影响计算，但没有export进入源码或bundle的固定证据。
- 正式token构建与check只处理canonical `packages/design`，不会更新或验证旧包生成CSS。
- 本AU未build Storefront、打开页面、生成token、修改资产、推送、合并或部署。

## 20. AU-017 Canonical Design 发布边界

- `@shop/design`没有独立镜像、服务或部署步骤；Console静态入口直接打包4个CSS subpath和生产消费组件，因此其样式/组件变化随Console制品发布。
- `build-web-tokens.mjs`生成canonical `tokens.css`/`Token.ts`；当前check通过但不检查消费者变量闭合，80个未定义token可随合法生成物进入Console（F-0076）。
- `build-miniapp-theme.mjs`从canonical token复制部分样式和两个SVG进入miniapp；check通过，但不读取`mobile-platforms.json`，不能证明六档/平板规则已发布（F-0081）。
- Storybook不是正式发布或质量链单元；其样式入口与生产不同，不能作为发布验收证据（F-0079）。
- 本AU未构建制品、修改生成物、推送、合并、部署或改变任何线上资源。

## 21. AU-018 Miniapp 片段发布边界

- release candidate映射会把`apps/miniapp/miniprogram`当前9文件整体复制为客户端候选，但仓库内没有可启动manifest/pages/API/actions；复制成功不等于微信应用可发布（F-0006）。
- 8个生成物分别由clients/runtime/design生成链维护；只有Environment进入app运行链，另7个仅有生成、检查和candidate职责（DC-0023）。
- 路径历史显示片段随MVP/支付候选收口进入当前轴，不证明其已部署或已下线。外部完整工程、线上微信版本和交付同步方式均UNKNOWN。
- 本AU未运行candidate、构建微信包、访问外部工程、推送、合并、部署或改变线上资源。

## 22. AU-019 Auth Web发布边界

- `auth-web`是无进程重启的静态target；同一dist分别seed到L0 `/opt/zhudatuan/.../auth-web`与L1 `/opt/sfl/nodes/hbbtzn-l1/.../auth-web`。
- L1 gateway先服务`/identity-runtime.json`再fallback静态文件；L0版本库Caddy没有专门runtime route，静态fallback返回HTML，客户端按content-type退回build registry。
- 共享制品canonical/OG固定L0（F-0089）；runtime同时决定敏感API目的地（F-0083），后续治理须分别验证制品和runtime回滚。
- 本AU未build、读取live runtime、切换指针、推送、合并、部署或改变线上资源。
