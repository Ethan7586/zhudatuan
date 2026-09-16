# AU-009｜`@shop/kernel` 共享内核

## 1. 唯一目的与边界

本单元只审固定基线中 `@shop/kernel` 的全部人工文件，以及这些基础语义进入 Commerce、Vendor、SDK 和 testing 的第一层真实接缝。审计顺序为包入口与消费者 → 逐文件/逐导出/逐关键函数 → 状态机与失败传播 → 定向反事实 → 测试可信度。身份授权、业务模块正确性、数据库实现和线上状态留给后续独立审计单元。

- 固定基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`。
- 审计分支：`codex/full-codebase-audit-20260913`；开工 HEAD/CP-08 为 `587ee0d4c4fd9f8dfd96f95ac342142b28b02260`。
- 本单元开工时只读观测 `origin/zdt-next` 为 `6648ddd15f3ea8dfda6eba1238c4c93d77a406c3`；主动 fetch 时为 `68068c77d307522dff78499ade4820567a2344fc`，随后同仓 push 将本地远端跟踪指针更新到提交闸门前的 `0c641866eb863c7507bda7c94ea6746e43d7904b`。这些基线后变化均未合并、未变基，不改变固定基线。
- 纳入：Kernel 40 个 tracked 文件、54 个声明导出、9 个测试用例、72 个源码 import/re-export 消费者、5 个相关 package manifest（含自身，4 个消费者声明依赖）、35 份 Commerce `module.manifest.ts` 的 capability 对账及关键运行接缝。
- 排除：依赖安装、全量构建、业务 handler 领域语义、真实外部供应商调用、数据库/线上状态、任何修复、删除、推送、合并和部署。

## 2. 覆盖

- [FACT][E-AU-009-002] 40/40 个 Kernel 文件、983 个物理行均完成逐文件和逐关键分支深入审阅；其中 37 个生产/类型文件、3 个测试文件，均为人工代码或人工结构化配置，无生成/第三方/构建产物。
- [FACT][E-AU-009-003] 登记 54 个声明导出；根入口公开全部领域/可靠性/门禁/模块契约，`./deadline` 另有稳定 subpath。全仓 72 个源码文件直接 import/re-export `@shop/kernel`；5 个 package.json 命中中，1 个是 Kernel 自身，4 个是消费者依赖声明。
- [FACT][E-AU-009-006] 35 份 Commerce module manifest 共有 51 个唯一 `provides`、92 个 `requires`；按 `ModuleCatalog` 的 capability 语义复算，有 37 个 required 值没有 provider。
- [FACT][E-AU-009-012] 按 `SHA-256("AU-009-sample:" + path)` 对 40 文件确定性抽取 5 个，从消费者反向重追，占 12.5%；结论一致。该抽检是同一主审自检，不冒充第二位独立审阅者。
- 本单元新增 P2 两项、P3 四项；没有 P0、新 P1、G2、G3 或 GX。新增两个 G1 对象，均明确禁止直接删除。

逐文件 29 项记录见 `files.csv`；导出、函数、状态、通信、FMEA、测试和反事实分别见同目录对应表。全仓唯一覆盖状态仍以 `10-coverage-manifest.csv` 为准。

## 3. 真实运行关系

~~~mermaid
flowchart LR
  Apps[Commerce / Vendor / SDK / testing] --> Root[@shop/kernel root]
  SDK[SDK ApiClient] --> DeadlineSub[@shop/kernel/deadline]
  Root --> Domain[Entity / Aggregate / ValueObject / Money / Event]
  Root --> Resilience[Deadline / Rate / Bulkhead / Circuit / Retry]
  Root --> Gate[Gate types]
  Root --> Manifest[ModuleManifest helper]

  Http[Commerce HttpClient] --> Exec[Executor]
  Exec --> Rate[RateLimiter]
  Exec --> Bulk[Bulkhead]
  Exec --> CB[CircuitBreaker]
  Exec --> Retry[retry]
  Exec --> DL[Deadline]
  Http --> Providers[SMS / Email / WeChat / payment / invoice]

  Manifest --> Manifests[35 Commerce manifests]
  Manifests -. no runtime composition caller .-> Catalog[ModuleCatalog]
  Gate --> GateEngine[Commerce GateEngine observe-only]
  Domain --> CommerceDomain[Order / Reservation / PaymentReference / events]
~~~

[FACT][E-AU-009-003/005] Kernel 不是独立进程、数据库 owner 或发布单元；它由 Commerce/Vendor/SDK/testing 编译进各自制品。最重要的运行链是 `HttpClient → Executor → RateLimiter → Bulkhead → CircuitBreaker → retry → Deadline → 外部 HTTP`。

[FACT][E-AU-009-006/007] `defineModuleManifest` 被 35 个模块使用，但 `ModuleCatalog` 在固定仓库没有生产构造者，只有自身测试。当前 Commerce 启动组合使用另一套 module/composition 入口；因此 37 个 capability 缺口是潜在架构契约失配，不写成当前启动故障。

[FACT][E-AU-009-015] Gate 类型只允许 `disabled | observe`；Commerce `GateEngine` 是真实消费者并保持 observe-only。它记录观察结果，不是身份验证或业务授权替代品。

## 4. 已确认问题

| 编号 | 等级 | 结论 |
| --- | --- | --- |
| F-0047 | P2 | CircuitBreaker 的并发旧成功可关闭刚被失败打开的 circuit；half-open 的 failure classifier 抛错还会永久占住 probe |
| F-0048 | P2 | `businesskeywrite` 只是字符串标签，Executor/HttpClient 不要求幂等键；WeChat 通知丢弃已有 dispatch key，却会在 transport failure 后重发 POST |
| F-0049 | P3 | ModuleCatalog 声称 immutable 但保留可变 manifest 引用，且 35 份现行 manifest 有 37 个 `requires` 无 capability provider；当前无生产构造者 |
| F-0050 | P3 | ValueObject canonical equality 把不同 Date 与 NaN/Infinity 判为相等，并对 BigInt/循环对象抛错；当前唯一生产子类仅含字符串 |
| F-0051 | P3 | Deadline 对超过 2,147,483,647ms 的期限提前触发，且同步抛错 callback 留下 abort listener；当前消费者期限均较短 |
| F-0052 | P3 | TestIdGenerator 使用普通 base32，第 18 个 ID 含 Crockford 禁止字符 `I`，与 Kernel `Id.parse` 契约冲突；当前无仓内调用者 |

同时补强但不重复计数：

- [FACT][E-AU-009-016] `Retry.ts` 的 fallback `RETRY_FAILED` 不在 `errors.yml`；这属于既有 F-0037“错误目录检查器没有扫描现行源码根”的新增 Kernel 实例。
- [FACT][E-AU-009-018] `CURRENCIES` 的 `as const` 只提供类型层只读性，运行数组和 `Currency.code` 都可变；反事实可追加 USD 并令 `Currency.of('USD')` 接受，再改写实例 code。这补强既有 F-0032，不另计新 finding。
- [FACT][E-AU-009-014] `ModuleCatalog` 以及 Email/Hash/Mobile/Page/Result/Version/Specification 一组公共符号没有仓内生产调用，但仍有包导出、测试/兼容或唯一语义责任，只能进入 G1，不能升级 G3。

## 5. 状态、并发与失败传播

- [FACT][E-AU-009-004] threshold=1 时让两个 closed 请求并行，先失败的请求把状态置为 open，后完成的旧成功又无条件置回 closed；输出为 `open → closed`。当前 `Executor` 和 Vendor `CircuitPolicy` 都可共享同一 breaker 实例。
- [FACT][E-AU-009-004] half-open probe 中 `countsAsFailure` 抛错时既不执行 `fail` 也不执行 `succeed`，`probing=true` 残留；之后请求得到 `CIRCUIT_OPEN`。
- [INFERENCE][E-AU-009-005][E-AU-009-011] WeChat dispatch 已经拥有 `request.idempotency`，但 adapter 不发送/绑定该值；`HttpClient` 对任何 `businesskeywrite` transport error 使用统一 retryable classifier。若第一次外部调用已生效但响应丢失，同一消息可被再次发送。外部 WeChat 是否自行去重为 UNKNOWN。
- [FACT][E-AU-009-009] Deadline 只创建一次被上限截断的 timer，没有到点后重新计算剩余时间；长于约 24.85 天的公开合法期限会提前 abort。同步抛错的 operation 发生在 `.finally` 安装前，listener 不会被移除。

完整状态表见 `state-machines.csv`；每个问题的首个可观察影响与恢复边界见 `fmea.csv`。

## 6. 测试可信度

- Kernel 有 3 个测试文件、9 个用例：Money 1、resilience 4、ModuleCatalog 4。
- Money 的安全整数、加法溢出是高价值反事实；Circuit 测试只覆盖串行失败/恢复和 classifier 返回 false，不覆盖并发完成顺序或 classifier 自身抛错。
- Retry 测试只证明 read mode 在两次 attempt 和一个 deadline 内可恢复；没有断言 `businesskeywrite` 必须携带幂等键，也没有 abort-listener、deadline 边界或 error catalog 测试。
- ModuleCatalog 测试覆盖正常排序、显式绑定、missing 与 cycle；不把 35 个真实 manifests 喂给 resolver，也不测重复 provides、调用者 mutation 或返回 Map mutation。
- ValueObject、Id、Deadline 长期限、Email/Mobile/Hash/Cursor、Page/Result/Version、RateLimiter/Semaphore 公共边界均无直接 Kernel 测试。
- 正式 `npm test --workspace @shop/kernel` 与 `npm run typecheck --workspace @shop/kernel` 都以 127 在加载源码前退出，分别缺 `vitest`、`tsc`。未安装依赖，结果既不是测试通过，也不是实现失败。

## 7. 值得保留的设计

- Money 只允许 safe-integer minor unit，并在加减时二次检查溢出和 currency，一处集中维护金额精度边界。
- Id 使用明确的 Crockford 风格 26 字符负载和稳定 prefix 规则；当前缺陷位于 testing generator，不在 parser。
- Executor 把 deadline、rate、bulkhead、circuit 和 retry 组合在一个外部调用边界，并在 `finally` 释放 deadline timer；HttpClient 继续把 AbortSignal 传到底层 fetch。
- DomainEvent 在创建时校验事件/聚合/租户/trace/version/date并冻结 envelope；OutboxStore 在同一调用栈立即 JSON 序列化，当前没有观察到 envelope 在持久化前被异步修改。
- Gate 公共契约与 Engine 明确只实现 observe，不把观察插件偷偷变成授权裁决。

## 8. UNKNOWN 与后续边界

- [UNKNOWN] `@shop/kernel` 是否存在仓外 workspace/npm 消费者；package 标为 private，但公开 exports 仍可能被同仓外置工程或历史制品使用。
- [UNKNOWN] 外部供应商是否对 WeChat subscribe message 提供隐式去重，以及生产是否发生过 lost-response 重发；本 AU 未访问日志或供应商控制台。
- [UNKNOWN] 35 份 module manifest 是计划中的未来 startup catalog，还是只作静态模块说明；当前代码和历史没有生产构造者，需由架构所有者定稿。
- [UNKNOWN] 超过 24.85 天的 Deadline 是否有仓外消费者；仓内现行期限未达到该边界。
- [UNKNOWN][E-AU-009-017] 正式 test/typecheck 的实现结果未知：两者因依赖缺失未加载；应在有锁文件依赖的独立验证环境重跑，不能在审计分支安装或修复。

## 9. 本检查点结论

AU-009 完成的是固定基线 Kernel 架构与代码健康档案，不是修复。所有新增问题都保留了调用链、反事实、验证和回滚方向；没有生产代码、测试、配置、依赖、锁文件、生成物或线上状态变化。CP-09 后停止，下一单元仅在 Ethan 明确授权后从 `@shop/authz` 开始。
