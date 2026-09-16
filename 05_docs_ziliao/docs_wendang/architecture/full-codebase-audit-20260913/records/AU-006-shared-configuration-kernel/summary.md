# AU-006｜共享配置内核与环境契约

## 1. 唯一目的与边界

本单元只审固定基线中的 @shop/config：环境键如何进入解析器、节点 Manifest 与 Console 运行配置如何形成权威关系、生成配置如何传播到消费者，以及正式测试和质量门禁能否验证这些边界。它不深审 Commerce 业务 handler、身份业务授权、线上环境值，也不实施任何修复。

- 固定基线：5a1ce71eebbefaa826368a9e1dc17730f9363bc4。
- 审计分支：codex/full-codebase-audit-20260913；AU 开工 HEAD/CP-05 为 e3ca3a04e5faaf160db2a3d8e38a875fd8a69112。
- 纳入：config 包全部 39 个文件；环境解析器、SFL 节点内核、节点注册表、Console 运行配置、生成目录；关键入口、Bootstrap、发布/AutoNode、systemd/env example 和 SDK 仅作结构性反向追踪。
- 排除：任何凭据值、线上 env/runtime JSON、云控制台配置、业务 handler 内部正确性、全量构建、数据库或服务状态变更。

## 2. 覆盖

- 深入审阅 35 个人工 TypeScript 文件、6,151 个物理行：config 全部人工源码与测试。
- 结构性审阅 62 个人工文件、8,947 个物理行：包元数据、生成器、质量检查器、关键消费者、发布入口、systemd 与 env example。
- 核对 7 个自动生成文件、1,070 个物理行：RuntimeCatalog、Miniapp 三份配置及三份节点 Manifest 输出；核对生成来源和消费者，不作人工风格评价。
- 本 AU 合计触达 104 个文件、16,168 个物理行；逐文件状态在 files.csv，全仓唯一总账是 10-coverage-manifest.csv。
- 对 6 个深审入口执行反向重追，占 35 个深审文件的 17.1%；这是同一主审的逆向自检，不冒充第二位独立审计者。
- F-0029 为 P1 候选，已进入 RV-0007；没有 P0、G3 或新 GX。

## 3. 真实配置架构

~~~mermaid
flowchart LR
  Unit[systemd EnvironmentFile / process env] --> Entry[Main / Ready Main]
  Entry --> Parser[@shop/config server parsers]
  Parser --> Bootstrap[专用 Runtime Bootstrap]
  Manifest[节点 registry declaration] --> Registry[SflNodeRegistry]
  Registry --> Identity[Identity projection]
  Registry --> ConsoleBuild[Console release declaration]
  AutoNode[AutoNode request] --> NodeManifest[per-node signed Manifest]
  AutoNode --> ConsoleJson[console-runtime.json]
  ConsoleJson --> BrowserParser[SflNodeKernelConsole]
  BrowserParser --> SDK[Console SDK / login redirect]
  CacheYml[cache.yml] --> Generator[build-runtime-config --check]
  CapacityYml[capacity.yml] --> Generator
  Generator --> RuntimeCatalog[TS + Miniapp generated catalogs]
  RuntimeCatalog --> HTTP[HTTP / Pool / Cache / external clients]
~~~

配置权威实际分成四层：

1. Environment.ts 提供进程/浏览器读取、trim、整数、枚举、Bearer 和集合校验原语。
2. 各专用 Environment 文件拥有服务 profile 的键白名单、默认值与启动前校验；Main 读取后交给专用 Bootstrap，Bootstrap 再把 NODE_* 与 Manifest 交叉核验。
3. SflNodeKernel 与 SflNodeRegistry 拥有节点、Host、疆域、资源/secret/release ref 和 Manifest digest；Console 另有 artifact/runtime binding 投影。
4. cache.yml/capacity.yml 和 registry declaration 是生成输入，生成物进入运行时；生成检查使用 --check，不应手改输出。

[CONFLICT] Catalog Jobs 在 bootstrap/CatalogJobsRuntime.ts 内独立拥有一套 source=process.env 的解析器，而环境所有权检查只识别直接属性/下标读取，因此共享配置权威并未完全收口到 config 包。

## 4. 模块职责与边界

| 子模块 | 对外入口 | 主要消费者 | 数据/配置所有权 | 当前评价 |
| --- | --- | --- | --- | --- |
| 基础 Environment | @shop/config/server | 所有服务 parser | 环境读取和基础值校验 | 小而明确；部分低层 helper 暂无消费者 |
| API/Jobs/Migration parsers | @shop/config/server | Main、ReadyMain、Bootstrap、部署检查 | 服务启动键、profile 和默认值 | 专用 parser 总体清楚；Catalog Jobs 形成旁路 |
| SFL Node Kernel | @shop/config/sfl-node-kernel | Commerce、生成器、Console | Manifest、Topology、Host、digest、ref | exact-key、canonical digest 与 exact-host 设计质量高；运行对象未深冻结 |
| SFL Registry | @shop/config/sfl-node-registry | Identity、Console、发布检查 | L0/L1 declaration 与资源绑定 | 注册时交叉校验较完整；导出仍暴露原始可变引用 |
| Console Runtime | @shop/config/sfl-console-runtime | Console 浏览器、构建/验收、AutoNode | artifact/runtime JSON 到 AppConfig | 制品与 Manifest digest 校验强；API/Identity URL 未与 Manifest domain 绑定 |
| Runtime Catalog | @shop/config/runtime | HTTP、Pool、cache、SDK、扩展 | cache/capacity 生成投影 | 单一生成器与 --check 值得保留；嵌套运行参数可变F-0032 |
| Miniapp Environment | 生成的 Environment.js | miniapp app.js | ext config schema | 生成链明确；TS 与生成实现存在 trim 语义差异 |

## 5. 已确认问题

| 编号 | 等级 | 结论 |
| --- | --- | --- |
| F-0029 | P1 候选 | Console 节点运行配置允许任意 HTTPS API/Identity 地址，未核对 Manifest domain；这些地址直接承载带 CSRF/action proof 的请求或登录跳转 |
| F-0030 | P2 | 正式环境所有权门禁在固定基线上按同算法静态复算有 85 条唯一违规，同时其声明集合和 alias 识别模型会漏报 |
| F-0031 | P2 | @shop/config 正式 test 脚本遗漏四个专用 Environment 测试文件，根 test:unit 也不会执行它们 |
| F-0032 | P2 | SFL registry与生成Runtime Catalog都只冻结外壳；隔离进程内修改已改变后续Host解析和HTTP deadline配置 |
| F-0033 | P3 | Miniapp TS parser 会 trim，生成的生产 Environment.js 不 trim，同一输入的接受结果不同 |
| F-0034 | P3 | 通用 origin helper 先去重，令 WebBusiness 的重复来源拒绝分支不可达 |
| F-0035 | P3 | LocalEnvironment 的 HTTPS endpoint 只检查字符串前缀，允许 https:// 等非 URL 值通过配置阶段 |

P1 候选不等于已发生线上事故。当前 AutoNode 生成器从同一 request.domains 同时生成 Manifest 与 Console URL，这是现有正向路径的缓解证据；但 parser、激活重绑和浏览器使用链没有执行该不变量。固定基线未读取线上 console-runtime.json，故实际是否错误统一标为 UNKNOWN。

## 6. 值得保留的设计

- SFL Manifest 使用 exact keys、canonical timestamp/text、稳定排序、SHA-256 digest、唯一确 Host 与唯一注册约束；测试覆盖篡改、Host 后缀误匹配、关系重叠和 L11 上限。
- 各专用生产 parser 多数拒绝 unknown key、限制 loopback bind、校验 endpoint/secret ref/Bearer 分离；Bootstrap 继续核对 Manifest、feature、domain 与 secret prefix，而不是只信 env。
- Runtime Catalog 有单一 YAML 输入、生成器验证和 --check 漂移检测；HTTP、Pool、cache 与外部调用共享同一容量模型。
- Console artifact 对 source SHA、build id/count、immutable artifact digest、Manifest digest、resource ref 和 scope 做交叉核对。

## 7. 验证结果

- npm test --workspace @shop/config 在加载测试前因 vitest 未安装退出 127；不能判定实现通过或失败。
- npm run check:environment 在加载检查逻辑前因 typescript 包未安装退出；不能作为正式门禁结果。
- 使用与 environment.mjs 相同的目录选择、排除、正则和 report 去重规则做只读静态复算：1,743 个生产源码、336 个大写字符串、98 条原始命中、85 条唯一违规、23 个文件；其中 undeclared 35、outside owner 49、dynamic 1。
- 使用 Node 22 strip-types 在隔离进程读取 registry与Runtime Catalog：两者外壳 frozen、嵌套未冻结；domain host修改使nodeDomainBinding从accounts.fufu.wang变为audit.invalid，HTTP deadline也可从15000改为1。进程退出后状态消失，仓库文件未写入。
- 未安装依赖；未运行全量测试、全量构建、生成写模式、数据库、服务或线上检查。

## 8. 垃圾代码候选与未知项

- G1：clientEnvironment、providerEnvironment、minimumLength/base64ByteLength、purchaseBrowserOrigins 在固定基线没有生产消费者，但均处于公共 export 或唯一契约位置，证据不足以删除。
- [UNKNOWN] 节点关系历史是否必须无间隙、最后一段是否必须 current，代码与已定位标准未给出可执行连续性契约；不据此报缺陷。
- [UNKNOWN] 线上 env 文件、console-runtime.json、Manifest digest、Cloud/host 注入值是否与仓库 example 一致，未读。
- [UNKNOWN] 四个遗漏测试在依赖完整环境下当前是否通过；本 AU 只证明正式入口不执行它们。

## 9. 检查点纪律

CP-06 只允许包含本审计目录内的报告、证据索引和覆盖清单。提交前必须核对 staged diff，确认没有源码、测试、配置、工作流、迁移、依赖、锁文件或生成输出；提交后停止，等待下一审计单元授权。
