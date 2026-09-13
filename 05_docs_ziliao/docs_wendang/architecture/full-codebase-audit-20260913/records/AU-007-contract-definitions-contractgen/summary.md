# AU-007｜契约定义与 contractgen

## 1. 唯一目的与边界

本单元只审固定基线中的 `@shop/contract` 人工契约、四份 YAML 权威输入、`@shop/contractgen`、正式生成/Operation/Event/Error 门禁，以及生成结果到授权、HTTP、SDK、事件和数据库发布壳的结构性关系。它不深审 SDK 传输实现、Commerce 各业务模块、事件处理器、迁移业务语义或 Miniapp 生成实现，也不实施任何修复。

- 固定基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`。
- 审计分支：`codex/full-codebase-audit-20260913`；AU 开工 HEAD/CP-06 为 `fa3ccf7865dd0cad7ccb1436791a2b0a26c58193`。
- 纳入：contract 与 contractgen 共 50 个文件；OpenAPI、SDK domain、Commerce controller/handler/event registry 和 database current.sql 只核对生成来源与数量；授权、错误映射、执行内核、Console 调用和历史迁移只作反向结构证据。
- 排除：生成写模式、依赖安装、全量测试/构建、数据库执行、线上契约/事件状态、业务 handler 全面正确性以及任何代码修改。

## 2. 覆盖

- 深入审阅 41 个人工文件、12,089 个物理行：四份 YAML 的全部 2,040 条记录（345 Operations、67 Events、190 Capabilities、1,438 Errors），contract 全部人工源码/测试，以及 contractgen 全部源码/测试/包配置。
- 核对 48 个自动生成文件、103,131 个物理行：contract 内 9 个生成物、SDK 35 个 operation 文件、Commerce 三个生成壳和 database current.sql；只评价生成一致性、来源和消费者，不作生成代码风格评价。`RequirementCatalog.generated.ts` 来源为 requirementgen，留后续专项。
- 结构性反追 28 个人工文件、3,976 个物理行：正式检查器、授权/执行/错误映射、事件发布、Console 真实调用、数据库发布模板/相关迁移和历史文档。
- 本 AU 合计触达 117 个文件、119,196 个物理行；逐文件状态在 `files.csv`，全仓唯一总账是 `10-coverage-manifest.csv`。
- 对 8 个深审入口重新从消费者/失败点逆向追踪，占 41 个深审文件的 19.5%；这是同一主审的逆向自检，不冒充第二位独立审计者。
- 新增 F-0036 为 P1 候选并进入 RV-0008；没有 P0、G3 或新 GX。

## 3. 真实契约架构

~~~mermaid
flowchart LR
  Ops[definitions/operations.yml] --> Gen[ContractGenerator]
  Events[definitions/events.yml] --> Gen
  Caps[definitions/capabilities.yml] --> Gen
  Errors[definitions/errors.yml] --> Gen
  Permission[@shop/authz PermissionCatalog] --> Gen
  Gen --> Contract[Operation/Event/Error TS]
  Gen --> OpenAPI[openapi.json]
  Gen --> SDK[SDK domain clients]
  Gen --> HTTP[Commerce Controller/Handler shells]
  Gen --> EventRegistry[Commerce event registry]
  Gen --> DB[database/contracts/current.sql]
  HTTP --> Authorizer[AccessPipeline]
  HTTP --> Modules[ModuleOperations]
  EventRegistry --> Publisher[RuntimeEventPublisher]
  Errors --> ErrorMap[ErrorMapper]
~~~

代码事实显示，`operations.yml` 是路由、owner、audience、permission、SDK 目标及默认执行策略的主要来源；`events.yml` 同时影响事件版本、运行 handler registry 和数据库 schema URI；`errors.yml` 影响 HTTP status 映射。`capabilities.yml` 只被 generator 用于局部 audience 对照，数据库 capability 行实际从 Operations 全量生成。

## 4. 规模与生成一致性

- 345 Operations：runtime 271、frozen 74；GET 141、POST 135、PUT 49、DELETE 12、PATCH 8；public 14、operator 277、member 52、provider 2。
- 67 Events 全为 version 1；10 条无 handler；handler 绑定为 projection 38、notification 33、referral 5、reconciliation 4、experiencepublish 1。
- 190 Capability 记录全部标为 operation，但只匹配 189 个 Operation；156 个 Operation 无对应记录，其中 runtime 82、frozen 74。
- 1,438 Error 定义无重复、status 范围有效且按 `localeCompare` 排序。
- 只读一致性复算：OpenAPI 345/345 且 method/path/availability/execution/idempotency/expectedVersion/schema 零差异；events.json 67/67；271 个 runtime id 均存在于 Controller、Handler 和 current.sql；345 个 Operation 均存在于 SDK 聚合/所属 domain 生成面。
- 正式 contract/contractgen 测试及 generator/Operation/Event/Error 门禁均在实现加载前因缺少 `vitest`、`tsx` 或 `typescript` 阻塞；未安装依赖，不能写成通过或实现失败。

## 5. 已确认问题

| 编号 | 等级 | 结论 |
| --- | --- | --- |
| F-0036 | P1 候选 | 两条真实写库的 Storefront member `*.manage` Operation 使用 `member.read`；统一授权器、数据库 capability 解算和 Console 测试均按该绑定放行 |
| F-0037 | P2 | 正式 Error contract 门禁扫描已不存在的根目录；修正目录后的保守词法复算发现 899 个未声明错误码，其中至少 294 个在 Commerce service |
| F-0038 | P2 | “named” Operation schema 与 OpenAPI/SDK/HTTP 实际契约不一致：79 个 body 在 OpenAPI required、运行 schema 仍 optional，字段仅为 JsonValue allowlist，生产 Controller 又明确绕过该 schema |
| F-0039 | P2 | `CONTRACT_CHECKSUM` 的 Event 投影遗漏 schema 与 handlers；两者改变 database/event registry 输出时 checksum 可保持不变 |
| F-0040 | P2 | 345 个 Operation 无一显式声明 writePath；生成器按名称/domain 推断，81 个 runtime 非 GET 落在 none，现有测试只检查已被选中的 enforced writes |
| F-0041 | P3 | capabilities.yml 是残留的部分影子目录：1 个孤儿、5 个 permission 漂移、156 个 Operation 缺口，validator 只检查已匹配项的 audience |
| F-0042 | P3 | generator 跨多文件直接顺序覆盖，并用无命中断言的字符串 replace 加固运行壳；后段失败可留下半生成工作树，测试只覆盖 SDK 两个性质 |
| F-0043 | P3 | DeepLink 允许任意 `%`，`miniappDeepLink` 随后直接 decode；`%ZZ` 先通过正则再抛原生 URIError，未归一为契约错误 |

F-0036 不是根据名称推断：定义、生成 Controller、AccessPipeline、`capability.membership_operations`、Console 仅持 `member.read` 的测试上下文、真实 SDK 调用与 Member handler 的 INSERT/DELETE 均已连通。线上 entitlement、实际角色与调用记录未读取，所以暂为 P1 候选而不是 P0 或已确认事故。

## 6. 值得保留的设计

- 生成器对 Operation ID、route、permission existence、frozen policy、schema target、requirement、GET/async/idempotency组合和 Error 排序有集中拒绝逻辑。
- 271 runtime 与 74 frozen 同源，Controller/Handler/DB 只发布 runtime，而 OpenAPI/SDK 保留 frozen 并携带 availability；当前数量一致。
- Financial Action Policy 对受控 Operation 使用精确 allowlist，并把 operation/path/query/body 做稳定规范化。
- Provider capability、Manifest、Ports 与 Domain Registrar 的接口边界清楚，DNS/TLS/发布不混入注册 socket。
- Storefront member 专用 Zod schema 对真实业务对象的字段、枚举和 masked mobile 契约明显强于通用 Operation JsonValue 壳，应作为后续契约收口的可复用事实源。

## 7. 验证结果

- `npm test --workspace @shop/contract`：exit 127，`vitest` 未安装，测试未加载。
- `npm test --workspace @shop/contractgen`：exit 127，`vitest` 未安装，测试未加载。
- `npm run check --workspace @shop/contractgen`：exit 1，`tsx` 未安装，generator 未加载。
- `npm run check:operations`、`npm run check:events`、`npm run check:errors`：均在 `typescript` 依赖加载前退出，规则循环未执行。
- 只读复算完成生成一致性、catalog 完整性、Error corrected-root 下界、Event checksum 反事实、OpenAPI schema 形态及 malformed-percent DeepLink 控制流；详见 `tests.csv` 和 `evidence.csv`。
- 未运行生成写模式、全量 build、数据库、服务或线上检查。

## 8. 垃圾候选与已知未知项

- G0：`capabilities.yml` 虽与“已删除”的历史文档冲突且内容部分漂移，但 generator 仍同步加载并执行 audience 校验；它不是可直接删除文件。
- G1：生成的 `EventSerializer`、手写 `Contract`/`VerificationContract` 等部分公共符号在固定仓库无生产消费者，但仍经 package root export，外部消费者与兼容责任未排除。
- [STALE] `voucher/Operations.md` 声称 capabilities.yml 已删除；当前文件与 generator 均存在，以代码为准。
- [STALE] 当前生成 checksum `056713…` 与 config/migration 的旧 `d7e499…` 不同；历史提交明确移除了 database.contract 作为 runtime readiness 阻断项，因此本 AU 不把差异误报为线上不兼容。
- [UNKNOWN] 81 个 runtime 非 GET/`writePath=none` 中哪些业务动作应升级到统一执行内核，需要逐业务不变量复核；本 AU 只确认分类机制没有完整性 oracle。
- [UNKNOWN] 线上数据库是否应用 current.sql、实际 published operation/event/checksum、活跃 SDK/OpenAPI 外部消费者和 event backlog 均未读取。
- [UNKNOWN] `build-miniapp-contract.mjs` 另行复制 Experience/DeepLink 语义；只登记为 AU-008 生成运行链输入，不在本单元扩展结论。

## 9. 检查点纪律

CP-07 只允许包含本审计目录内的报告、证据索引和覆盖清单。提交前必须核对 staged diff，确认没有源码、测试、配置、workflow、迁移、依赖、锁文件或生成输出；提交后停止，等待下一审计单元授权。
