# AU-008｜生成契约运行链

## 1. 唯一目的与边界

本单元只审固定基线中生成契约从 tracked 产物到真实消费者的运行边界：OpenAPI/Event JSON、35 个 SDK operation clients、Commerce Controller/Handler/Event registry、Miniapp 两个生成模块、数据库 `current.sql`，以及这些产物进入浏览器 HTTP、Commerce 路由/事件、候选制品和检查器的路径。SDK 人工实现作为生成 client 的唯一传输底座一并完成微观深审；各业务 handler 的领域正确性不在本单元展开。

- 固定基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`。
- 审计分支：`codex/full-codebase-audit-20260913`；开工 HEAD/CP-07 为 `97d149d808a149fc08a1b226acce0c76d4558aef`。
- 基线后主线：本单元期间先后只读观测 `origin/zdt-next` 为 `fc3ceca6`、`8ea165fe`、`6648ddd1`；均未合并、未变基，且不改变本次固定基线。
- 纳入：SDK 62 个文件、8 类主要生成输出、HTTP/CORS 接缝、路由和事件注册、Miniapp 生成检查、数据库快照消费者、release candidate 的制品身份传播。
- 排除：生成写模式、业务 handler 领域语义、数据库执行、线上浏览器/微信环境、依赖安装、全量构建、任何修复、推送、合并和部署。

## 2. 覆盖

- 深入审阅 32 个人工文件、1,835 个物理行：SDK 全部 27 个人工文件（1,350 行）、`HttpApp` 及测试、`runtimegraph`、Miniapp contract generator 和 release candidate builder。
- 核对 43 个自动生成文件、76,940 个物理行：35 个 SDK operation 文件、OpenAPI/Event JSON、Commerce 三个运行壳、数据库 current.sql 和 Miniapp 两个 CommonJS 模块；只评价来源、结构、消费者和运行责任，不评价生成风格。
- 结构性反追 31 个人工文件、4,047 个物理行：contractgen/OperationCatalog、Commerce composition/event publisher、四个 release 传播脚本、两个 OpenAPI 检查器、Console/Storefront 真实调用、浏览器 mock、SFL origin 声明和 SQL template。
- 本 AU 合计触达 106 个文件、82,822 个物理行；逐文件 29 项记录在 `files.csv`，全仓唯一状态总账仍为 `10-coverage-manifest.csv`。
- 对 SDK 27 个人工文件按 `SHA-256("AU-008-sample:" + path)` 排序抽取 5 个重新从消费者追踪，占 18.5%；结论一致。该抽检是同一主审的逆向自检，不冒充第二位独立审阅者。
- 本单元新增 P2 两项、P3 一项；没有 P0、新 P1、G3 或 GX。

## 3. 真实运行关系

~~~mermaid
flowchart LR
  Defs[operations/events definitions] --> Gen[ContractGenerator]
  Gen --> OA[openapi.json]
  Gen --> EJ[events.json]
  Gen --> SDK[35 SDK operation clients]
  Gen --> OC[Commerce Controller/Handler]
  Gen --> ER[Commerce EVENT_HANDLERS]
  Gen --> DB[current.sql snapshot]
  MiniGen[build-miniapp-contract] --> Mini[deeplink/experience.js]

  SDK --> AC[ApiClient]
  AC --> FT[FetchTransport]
  FT --> CORS[HttpApp preflight]
  CORS --> RR[RouteRegistry]
  OC --> RR
  RR --> OH[OperationHandler/usecase]

  ER --> REP[RuntimeEventPublisher]
  REP --> IQ[runtime.inbox/job]

  OA --> CH[release contractHash]
  EJ --> CH
  SDK --> WEB[Web client bundles + per-client hash]
  OC --> OCI[Commerce OCI hash]
  Mini --> MH[Miniapp directory hash]
  DB --> TEST[Voucher contract test only]
~~~

[FACT][E-AU-008-003/010/012/013] 345 个 Operation 全部存在于所属 SDK domain 和 SDK aggregate；只有 271 个 runtime Operation 进入 Controller、Handler 和 current.sql，74 个 frozen Operation 仍可见于 SDK，但 `ApiClient.execute` 在发出网络请求前拒绝。67 个 Event 全部进入运行 registry；publisher 在开事务前校验事件存在性和版本，再在单一事务内接受 inbox 并排队 handler jobs。

[FACT][E-AU-008-012] `database/contracts/current.sql` 的仓内精确消费者只有 contractgen 写入端和 `VoucherTargetContract.test.ts` 读入端；release candidate、migration runner 和运行入口均未加载它。它是生成快照/测试 oracle，不是已证明的迁移或部署入口。

[FACT][E-AU-008-013] release 的 `contractHash` 只对 `openapi.json + events.json` 原始字节求哈希；Web SDK 代码由各客户端目录哈希覆盖，Commerce 运行壳由 OCI 哈希覆盖，Miniapp 两个生成模块随全部 9 文件由 miniapp 目录哈希覆盖。`current.sql` 不进入候选制品。不能把 `contractHash` 单独解释为全部生成输出的统一身份。

## 4. SDK 运行契约

- [FACT] Console 有 42 个非测试源码文件直接导入 SDK，Storefront 有 13 个、Auth 有 6 个；Miniapp 为 0。Storefront 通过 aggregate CommerceClient 使用 identity/member/cart/benefit/checkout/order/payment 等 domain，Console 主要使用 named subpath factory。
- [FACT] `ApiClient` 负责 frozen、expected-version、idempotency 前置拒绝，构造 path/query/header/body，统一总 deadline，并只在 operation 可重试或调用者持幂等键时重试；`FetchTransport` 把同一 AbortSignal 传入浏览器 `fetch`。
- [FACT] 2026-09-13 的明确提交 `57c1177d` 已退出 SDK/HTTP 的旧 contract-version 阻断和成功响应 schema 解析；当前 SDK 测试也明确断言不发送版本头、不解析 request/response schema。旧行为不能再被文档或检查器写成当前事实。
- [FACT] `createRequestContext` 仍携带 `contractVersion`，但 `ApiClient` 不再读取；`ApiError.contractResponse` 和 `defineStructuralOperation` 也没有仓内运行消费者。它们是 G1 兼容候选，不是删除结论。

## 5. 已确认问题

| 编号 | 等级 | 结论 |
| --- | --- | --- |
| F-0044 | P2 | SDK 会为 Finance policy 和 Owner transfer 真实请求发送 `x-action-proof`，生产 `HttpApp` CORS 预检白名单却没有该头；浏览器 mock 反而允许它，导致测试掩盖生产跨域阻断 |
| F-0045 | P2 | 正式 `check:runtimegraph` 仍要求已退出的 `x-contract-version`/426 行为，并同步读取不存在的 Miniapp API client；依赖完整时也会因固定基线的正确现状失败或在 report 前 ENOENT |
| F-0046 | P3 | `WechatTransport` 把 `JSON.stringify(unknown)` 直接声明为必需字符串；`undefined` 会破坏 Transport 契约，循环值/BigInt 会在已标记 settled 且移除 abort listener 后抛出并留下悬空 Promise；当前仓内无运行 caller |

同时补强但不重复计数：

- F-0006：Miniapp contract generator 的两个输出存在，但没有 Miniapp 运行消费者；contractgen 预留的 `miniprogram/api` 产物不存在，candidate 仍无条件复制 9 文件片段。
- F-0032：生成的 `EVENT_HANDLERS` 是可变 `Map` singleton；固定仓库未发现 `.set/.delete/.clear`，所以只补入现有共享可变状态问题，不升级事故等级。
- F-0039：release `contractHash` 复用只含 type/version/module 的 `events.json`，因此 event schema/handler 变化同样不会旋转该字段；commit 与 Commerce artifact hash 仍提供其它溯源，故不夸大为不可追溯发布。

## 6. 测试可信度

- SDK 有 10 个测试文件、27 个用例；覆盖生成 factory 形态、74 个 frozen Operation 的传输前拒绝、旧版本/schema 退出决策、header 透传、取消、Secure ID、PKCE、Identity node registry 和 Fetch signal。
- [CONFLICT][E-AU-008-005/006] SDK 自身测试断言 `x-action-proof` 会发送；浏览器 OperationMock 的预检也允许该头；生产 `HttpApp` 白名单没有它，而自己的 preflight 测试只检查 access/device 头。这三层测试不能证明真实浏览器链可达。
- `WechatTransport.test.ts` 只有 abort 一例；success/fail、string/object/undefined、序列化异常、重复 callback 和 callback-after-abort 均未覆盖。
- RetryPolicy 没有直接或端到端重试次数/408/429/5xx/deadline 测试；当前结论来自完整控制流阅读，不把未执行测试写成通过。
- 正式 SDK test/typecheck、Miniapp generated check、runtimegraph 都在业务逻辑前因本地依赖缺失而阻塞。只读静态复算确认 345/271/74 数量和生成壳零缺项，并精确复现 runtimegraph 的四个旧期望不成立。

## 7. 值得保留的设计

- runtime/frozen 同源但发布边界不同：服务端只注册 runtime，SDK 保留 frozen 可见性并在传输前统一拒绝；74 条全量测试对这一反事实有直接 oracle。
- named domain factory 最终都收敛到同一个 `ApiClient`，避免每个前端重复实现 path/query/idempotency/deadline；自定义 Transport 端口让浏览器与微信适配器保持边界。
- `FetchTransport` 使用浏览器原生 credentials、redirect 和 AbortSignal；`ApiClient` 的 deadline 在 `finally` 释放，取消可下传到底层请求。
- release 不只依赖一个模糊的 contract 字段：每个客户端目录、Commerce OCI、SBOM 和整份 candidate/stage 证据都有独立哈希关系。应保留这种分层制品身份。
- Event publisher 在开启数据库事务前拒绝未知 schema/version，并在同一事务内完成 inbox 去重与 job 入队，失败会 rollback 且释放连接。

## 8. UNKNOWN 与候选

- [UNKNOWN] 线上当前 API/Console 制品是否仍为固定基线，真实浏览器是否已遇到 F-0044，以及哪些 proof-bearing Operation 在生产被调用；本 AU 未访问线上状态。
- [UNKNOWN] `@shop/sdk` 是否存在仓外消费者；因此 `createWechatCommerce`、retired compatibility exports 和 generated ID arrays 只能列 G1，不能列 G2/G3。
- [UNKNOWN] 是否存在仓外 Miniapp 完整工程或微信发布流水线；当前 9 文件片段和零 SDK caller 不能证明产品已下线。
- [UNKNOWN] 是否有历史人工流程直接应用 `current.sql`；仓内没有入口，文件仍保存生成/测试责任，不能删除。
- [UNKNOWN] 依赖完整环境中 SDK typecheck 除已识别 `WechatTransport` 风险外是否还有错误；本次不安装依赖。

## 9. 检查点纪律

CP-08 只允许包含本审计目录中的报告、记录和覆盖清单。提交前必须核对 staged path、`git diff --cached --check`、固定基线和工作树状态；不推送、不合并、不部署。AU-009 如获 Ethan 授权，应独立审 `@shop/kernel`，不得在本检查点顺手修复 F-0044–F-0046。
