# 全代码库系统审计｜08 测试可信度与缺口

## 1. 当前状态

AU-005识别并人工深审了共享状态设施的定向测试。正式workspace测试在代码加载前因审计worktree未安装`tsx`而阻塞；直接Node strip-types也因extensionless TypeScript import解析失败。未安装依赖，未把环境阻塞写成实现失败或通过。

## 2. 测试可信度

| 测试族 | 能证明 | 不能证明 |
| --- | --- | --- |
| Secret/KMS Handler + policy | 401/403、token比较、exact ref/keyRef逻辑有反事实 | production Main调用了这些Handler；实际bundle鉴权 |
| LocalKms | AES-GCM roundtrip、keyRef/context篡改拒绝 | master key轮换/恢复；HTTP入口授权 |
| LocalObjects | 分片顺序、hash、签名读等局部行为 | public URL可达、真实scanner、digest metadata collision、重启恢复 |
| JobRunner | mock query下的claim/process/retry/deadletter/timeout | 正式worker存在、PG函数真实SQL、业务processor幂等 |
| RuntimeEventPublisher/Event | generated事件版本和inbox/job事务结构 | OutboxRelay被部署、producer在线、live backlog |
| Pool/PgUnitOfWork/Context | 配置、锁序、重试与释放控制流 | 生产role/RLS、真实负载死锁、数据库版本恢复 |
| PG16 init fixture | RDS-like PG16地址/target/sentinel及零变更分支 | production Compose PG17、空卷完整前置、恢复成功 |

## 3. 假阳性风险

[FACT][E-AU-005-006] 最重要的假阳性是授权测试测了未挂载的Handler：测试即使全部通过，production Secret/KMS仍可无Bearer处理。类似地，publisher/job runner测试证明实现语义，不证明进程在正式target图中存在。

因此后续每项验证都必须同时包含：被测实现、真实构建entry、正式release target/systemd和至少一条反事实请求或崩溃状态。

## 4. 当前缺口

1. Secret/KMS production Main的health/401/403/success完整入口测试。
2. 正式target必须恰好拥有一个outbox relay、scheduler和cleanup owner的结构+进程测试。
3. PG17当前Compose空卷恢复测试，且检查器交叉验证image major与init允许major。
4. generic/scoped/identity三种claim对expired running的一致性测试。
5. 远端浏览器对象下载E2E、scanner provenance和same-digest metadata反事实。
6. Redis startup失败与运行中断线后的恢复状态机测试。
7. current PostgreSQL/Object/KMS backup restore演练证据；若存在仓库外流程，需只读接入证据而不是复制描述。

## AU-049 通知模块测试缺口

- 身份 challenge 用例覆盖其独立的 ambiguous/fail 状态机，未覆盖普通 `notification.dispatch` 在 claim 后、外部 send 前发生 KMS/template 异常的恢复。
- 本次定向 `@shop/commerce` Vitest 命令在加载源码前以 127 退出（`vitest: command not found`）；未安装依赖，结果不当作通过或实现失败。

详细执行结果和不证明项见 `records/AU-005-shared-state-infrastructure-map/tests.csv`。

## 5. AU-006 配置内核测试可信度

### 5.1 已有高质量覆盖

- SflNodeKernel.test.ts用720行覆盖Manifest digest/tamper、exact Host、registry唯一性、Topology关系重叠、层级上限、请求/结果等反事实。
- SflNodeKernelConsole.test.ts覆盖source/build/artifact digest、Host/surface、resource ref、scope和L0/L1解析。
- index.test.ts覆盖通用API、Jobs、Local、Migration、Client、Miniapp和节点投影的主要正常/拒绝路径。

这些测试证明被调用函数的局部行为，不证明正式package入口执行了全部测试，也不证明线上JSON/env正确。

### 5.2 正式入口缺口

[FACT][E-AU-006-004] config目录有8个测试文件，package scripts.test只列4个。MallProvisioning、Purchase、PaymentWebhook和WebBusiness四个专用Environment测试不由根test:unit执行，形成F-0031。

[FACT][E-AU-006-011] 正式package测试因vitest未安装在加载前阻塞；check:environment因typescript未安装在加载前阻塞。均记录为环境阻塞，不当作实现失败或通过，也未安装依赖。

### 5.3 门禁可信度

[FACT][E-AU-006-003] 对environment.mjs做同算法静态复算得到85条唯一违规；同时该脚本把任意大写字符串当声明、会把Vite内建DEV/BASE_URL报未声明，并漏掉source=process.env alias parser。它目前不能提供稳定的“环境读取已收口”证明，见F-0030。

### 5.4 新增反事实缺口

1. Console runtime的API/Identity URL必须属于同一Manifest domain。
2. Registry/Manifest/Topology递归不可变，resolver前后值不随调用者mutation变化。
3. TS Miniapp parser与生成JS逐输入parity。
4. Origin重复究竟拒绝还是归一化的定稿测试。
5. Local endpoint在任何资源初始化前拒绝不可解析URL。

完整执行边界见 records/AU-006-shared-configuration-kernel/tests.csv。

## 6. AU-007 契约与生成器测试可信度

### 6.1 已有覆盖

- contract 源码测试对部分 Schema、Operation/Event 目录、DeepLink、版本和权限契约提供局部反事实；AU 记录了 42 个源码测试用例。
- generator 的拒绝逻辑集中检查 Operation ID、路由、permission existence、frozen policy、schema target、requirement、方法与执行 metadata 组合。
- 只读复算确认 345 个 Operation、67 个 Event、271 个 runtime 发布项及生成目标集合在固定基线一致。

### 6.2 正式执行边界

- `@shop/contract` 与 `@shop/contractgen` 测试在加载前因缺少 `vitest` 阻塞。
- generator check 在加载前因缺少 `tsx` 阻塞；Operation/Event/Error 检查在加载前因缺少 `typescript` 阻塞。
- 未安装依赖，以上结果既不是测试通过，也不是实现测试失败。

### 6.3 可信度缺口

- [CONFLICT][E-AU-007-006] Error checker 扫描旧根目录，无法覆盖当前业务源码，形成 F-0037。
- [CONFLICT][E-AU-007-008] writePath 测试只检查已被 heuristic 选中的写入，不能发现漏选，形成 F-0040。
- [CONFLICT][E-AU-007-010] generator 测试只有两个 SDK 文本性质，不加载主生成器，也不验证多文件写入失败后的原子性，形成 F-0042。
- malformed-percent DeepLink 只读反事实确认 `%ZZ` 通过字符规则后抛原生 `URIError`，见 F-0043。

完整 53 条测试/静态验证记录及“不证明项”见 `records/AU-007-contract-definitions-contractgen/tests.csv`。

## 7. AU-008 SDK 与运行链测试可信度

- SDK共有10个测试文件、27个用例，覆盖factory形态、74个frozen Operation传输前拒绝、旧版本/schema退出、header透传、取消、Secure ID、PKCE、Identity registry与Fetch signal。
- [CONFLICT][E-AU-008-005/006] SDK测试断言发送`x-action-proof`，browser OperationMock允许该头；生产HttpApp预检测试只断言access/device头，因而无法发现生产白名单遗漏（F-0044）。
- WechatTransport只有abort一例；success/fail、string/object/undefined、序列化异常、重复callback和callback-after-abort均未覆盖（F-0046）。RetryPolicy也没有直接或端到端的重试次数、408/429/5xx与deadline矩阵。
- 正式`npm test --workspace @shop/sdk`因vitest缺失退出127，typecheck因tsc缺失退出127，`build-miniapp-contract --check`因zod缺失退出1，`check:runtimegraph`因typescript缺失退出1。均在业务逻辑前阻塞，未记为通过或实现失败，也未安装依赖。
- 只读集合复算确认345/271/74 Operation分层、67 Event registry以及SDK/运行壳缺项均为0；runtimegraph静态复算确认1个缺文件和3个旧token期望。完整38条记录见`records/AU-008-generated-contract-runtime-chain/tests.csv`。

## 8. AU-009 Kernel 测试可信度

- Kernel有3个测试文件、9个用例：Money 1、Resilience 4、ModuleCatalog 4。Money对浮点minor和加法溢出的反事实直接；其余公共值对象没有Kernel直接测试。
- Circuit测试只走串行open/recover和classifier=false，无法发现旧成功覆盖新open或classifier抛错锁死probe（F-0047）。
- Retry测试只走read模式的一次失败后成功；标题中的“safe mode”没有比较businesskeywrite/none，也没有要求业务key，消费者HttpClient/Wechat测试同样漏掉lost-response（F-0048）。
- ModuleCatalog四例使用合成manifest，不加载35份真实manifest，不测重复provides、输入mutation或返回Map mutation（F-0049）。
- ValueObject、Deadline长timer/sync throw、TestId第18项都无测试；只读实际源码反事实分别命中F-0050/F-0051/F-0052中的可执行部分。
- 正式test/typecheck均退出127，分别缺vitest/tsc并在源码加载前阻塞。没有安装依赖或把环境阻塞写成实现失败。完整13条测试/命令记录见 `records/AU-009-kernel/tests.csv`。

## 9. AU-010 Authz 测试可信度

- Authz包有4个vitest用例，quality security另有2个Node test；AccessPipeline表驱动展开45个实例，覆盖5维32组合、首失败顺序、audience、Membership ID与授权scope传递。
- 主干默认拒绝、显式deny、跨tenant、expiry、critical step-up均有直接oracle；PermissionCatalog 184 code与329个受保护Operation的闭合由本AU静态复算确认。
- 缺口包括异常/缺tenant Scope、错误platform、跨kind同ID、catalog mutation、二级permission explicit deny、custom role permission subset、critical Pipeline level和真实pg bigint类型。F-0053–F-0055在现有套件中不会可靠失败。
- [FACT][E-AU-010-011] `WebBusinessScopeResolver.test.ts`第三例仍期待旧4参数接口，现实现会在query前抛`AUTH_MEMBERSHIP_CONTEXT_MISSING`；这是F-0056，不是生产实现失败。
- 正式Authz test/typecheck均退出127，分别缺vitest/tsc且未加载源码；未安装依赖。完整用例、命令、探针及“不证明项”见 `records/AU-010-authz/tests.csv` 和 `validation-results.md`。

## 10. AU-011 Smart Wing Authz 测试可信度

- 包内159行、13个用例直接覆盖self、deny、store/department、tenant mismatch、enterprise ancestor、platform跨tenant、全局grant选择、非层级path、critical与过期step-up；实现oracle不是mock副本。
- 缺口包括inactive/expiry边界、permission missing、future/exact step-up、公开Set mutation、异常最大窗口与challenge-before-scope。
- 源码只读探针确认expiry等于now拒绝、900秒整允许、未来拒绝、explicit deny优先、Set mutation改变结果、Infinity接受旧验证、错误critical Scope先challenge。
- 正式`npm run test --workspace @smart-wing/authz`和`npm run typecheck --workspace @smart-wing/authz`均因Missing script失败。根`test:unit`会经Storefront的Vitest include间接收录13个用例，但根`typecheck`会因`--if-present`跳过本包独立tsconfig，形成F-0060；没有安装依赖或另造正式入口。

## 11. AU-012 Smart Wing API Contract 测试可信度

- 4个直接测试验证86个permission code与目录一一对应、元数据非空、四个critical样本，以及required/reserved平台集合；全部导入真实实现，不复制生产算法。
- 根`test:unit`会经Storefront Vitest配置间接收录两个测试文件；本包没有test script。根`typecheck`不执行本包独立tsconfig，继续补强F-0060。
- 测试没有覆盖taxonomy父链闭包、delivery evidence路径/正式闸门、运行时不可变性和支付状态全矩阵。源码探针分别发现F-0063、F-0064并补强F-0032。
- 审计worktree未安装依赖，本包直接test/typecheck均Missing script；`check:delivery`因缺`yaml`在加载阶段退出。失败只记录，未安装依赖或修复。

## 12. AU-013 Telemetry 测试可信度

- 3个测试文件、6个直接用例全部加载真实实现：ClientErrorBuffer 3例、InteractionTimeline 2例、Redactor 1例。
- 已覆盖错误聚合/retention/tenant拒绝、交互主干/取消、敏感键/Bearer/手机号/email；未覆盖异常Scope、Cookie/Basic/password label/card/ID、循环对象、async writer拒绝、callback异常和重复span end。
- 合成反事实命中F-0065、F-0067并补强F-0055，说明现有测试会对主干回归失败，但不会发现这些边界。
- 正式test/typecheck各执行一次，均因缺vitest/tsc退出127且未加载源码；未安装依赖，不记为通过或实现失败。

## 13. AU-014 Testing 包自身可信度

- 3个测试文件、7个用例：HttpHarness 3、TestContainer 2、Browser组合 2，均调用真实实现。
- Database/Event/Provider/Clock/TestIdGenerator没有包内直接测试；F-0052的第18个非法ID因此不会由本包正式测试发现。
- 双异常探针和异步request mutation分别命中F-0068/F-0069，现有测试只覆盖主干，不覆盖失败组合和captured/responder一致性。
- 唯一包外源码消费者是条件运行的真实PostgreSQL Repository test；其reset逐项吞掉cleanup错误，降低F-0068当前可达性但不修正公共Harness语义。
- 正式test/typecheck因缺vitest/tsc退出127；未连接测试数据库、未安装依赖。

## 14. AU-015 Interaction 测试可信度

- 5个测试文件、21个用例全部调用真实实现：Feedback 3、Action 4、Mutation 6、Preload 4、Resource 4。
- 对快速连击、跨key并发、late response、cancel、失败重试、storage malformed、timer dispose的覆盖质量较高，值得保留。
- 缺口集中在观察callback抛错、同key不同Result类型、输入message外部mutation、dispose后read和React StrictMode/lazy失败；合成探针形成F-0070–F-0073。
- 正式test/typecheck因缺vitest/tsc退出127且未加载源码；未安装依赖。

## 15. AU-016 旧设计包验证边界

- package没有test、typecheck或build script；两个workspace命令均Missing script。
- 2个JSON可解析，4个SVG通过XML结构校验，size class区间闭合；这些不证明真实视觉或页面使用。
- 正式canonical web-token check通过，但只读写`packages/design`，不会发现旧包tokens.css漂移，形成F-0075。
- 未执行页面截图/视觉对照；DC-0020不能升级G3。

## 16. AU-017 Canonical Design 测试可信度

- 包内10个test文件覆盖Bootstrap、Brand、QueryState、AccessDenied、Dialog、primitives、ResourceState、RouteFallback和Workspace foundation/shell；多数直接调用真实组件/函数。
- [CONFLICT][E-AU-017-006] AccessDenied测试标题宣称dark surface，却只检查class和DOM内容；全仓零对应CSS，因此对真实视觉形成假阳性（F-0077）。
- [CONFLICT][E-AU-017-008] Storybook preview未导入`components.css`；4个story文件虽含Dialog play和a11y error配置，根正式质量链没有story interaction/a11y runner（F-0079）。
- 当前web-token check只证明生成物等于生成器输出，不检查80个consumer变量是否定义；生成闸门无法发现F-0076。
- 正式`test`、`test:component`、`typecheck`各执行一次，均因缺`vitest`/`tsc`在源码加载前退出127；未安装依赖，不记为实现失败或通过。
- JSON/XML结构和miniapp theme drift check通过；未执行Storybook build、浏览器computed-style或页面截图。完整8条验证记录见`records/AU-017-design/tests.csv`。

## 17. AU-018 Miniapp 片段验证可信度

- Miniapp无package.json和直接test/typecheck入口；根workspace测试不会执行这9个文件的行为测试。
- `check/tests`只要求`app.js`存在并返回通过；`audit/navigation`读取缺失app.json立即ENOENT，直接复现F-0006的假阳性/失败判据冲突。
- 生成漂移入口覆盖8个输出，但Environment/contract/runtime checks在当前审计worktree分别缺tsx/yaml；theme check通过。没有安装依赖。
- [CONFLICT][E-AU-018-005] 现有生成check只比字节，不比较canonical与生成Experience parser行为，无法发现F-0082。
- 隔离VM探针执行真实生成JS，确认app正常配置、Experience接纳差异、CachePolicy mutation和Environment null错误；这不等于微信真机测试。
- 完整10条验证结果见`records/AU-018-miniapp-runtime-fragment/tests.csv`。

## 18. AU-019 Auth Web质量

- package `test`运行Vitest，`lint`实际为`tsc --noEmit`；审计环境缺vitest/tsc，两项均127且源码未加载。build因会写dist且最终全量限制未执行。
- 15个测试文件覆盖registry、entry、canonical helper、action协调和部分Operator行为；fetch均为mock，不能证明真实CORS、cookie、事务或redirect。
- `main.test.ts`只比较源码字符串；Consumer页无直接测试，Operator仅2例；runtime状态机、intent保留、reset主体绑定和畸形2xx缺行为测试，见F-0090。
- 九处`safeParse`结果丢弃继续构成F-0007；现有mock成功payload合法，因此破坏Schema不会让测试失败。

## 19. AU-020 微信支付质量

- 包有28个Vitest用例，覆盖请求签名、provider响应验签、无签名拒绝、支付/退款模型、通知验签解密、重放、KeyID轮换、金额/身份匹配和UTF-8截断。
- 正式test/typecheck在固定工作树分别因缺`vitest`/`tsc`以127退出；没有安装依赖或执行build。
- 现有测试没有畸形PEM DER、响应头后body超时/断流、64KiB响应、fatal UTF-8、caller callback override和畸形provider时间反事实。合成WebCrypto与本地流探针已复现F-0091/F-0092，但不替代正式套件。
- 详见`records/AU-020-wechat-payment/tests.csv`与`validation-results.md`。

## 20. AU-021 Provider Core质量

- 包仅有3个Vitest用例：Provider start/health/require、旧Webhook accepted/replayed和invalid signature；正式test/typecheck因缺vitest/tsc在源码加载前127退出。
- 唯一Webhook测试命中无生产caller的`src/Webhook.ts`，未覆盖生产`createPorts` HMAC、5分钟窗口、event ID绑定、normalize、2MiB HTTP边界或数据库去重，形成F-0095。
- 合成HMAC和静态DB链已证明F-0094；仍需独立复核真实provider协议和下游幂等，不能用当前单测通过替代。
- 详见`records/AU-021-provider-core/tests.csv`、`validation-results.md`和`independent-review-queue.csv`。

## 21. AU-022 Vendor Core质量

- 4个Vitest用例只覆盖operation声明、503读取重试、无幂等键写入不重试和circuit open；目的地、签名、双阶段超时、容量边界、取消和带幂等键写入均无测试，见F-0098。
- 正式`test`与`typecheck`各执行一次，均因审计工作树缺`vitest`/`tsc`在源码加载前退出127；未安装依赖、未执行build，不记为实现失败或通过。
- 静态调用链和受控探针支持F-0096/F-0097，但线上配置、出口和资源限制仍需RV-0014/RV-0015独立复核。
- 详见`records/AU-022-vendor-core/tests.csv`、`validation-results.md`和`independent-review-queue.csv`。

## 22. AU-023 Cakeuncle Vendor质量

- 14个Vitest用例覆盖secret缺失、签名向量、基础Client、2MiB声明限额、非幂等不重试、business error/circuit和被禁用Webhook。
- 正式test/typecheck因缺vitest/tsc在源码加载前127退出；没有安装依赖或执行build。
- 合成深层JSON探针在30,004字节/5,000层起复现RangeError，证明字节限额不能替代结构预算（F-0099）。
- 套件不命中Foodvoucher生产factory/ports与公共export，也不覆盖深度、chunked限额、超时/取消矩阵，见F-0102。详见`records/AU-023-cakeuncle-vendor/`。

## 23. AU-024 Foodvoucher Provider质量

- 包内唯一Vitest只检查required ID、签名注入和空签名拒绝，不实例化Provider或调用任何port。
- 根provider contract在遇到未映射capability时回退手写port清单，只做`has()`；不执行Catalog/Statement/Webhook，不拒绝额外port，也不校验capability-port配对（F-0104）。
- 正式test/typecheck因缺vitest/tsc在源码加载前127退出；未安装依赖或build。
- 历史行为测试曾覆盖专用Catalog/Price与畸形供应商字段，但已不在固定基线。详见`records/AU-024-foodvoucher-provider/`。

## 24. AU-025 Cake Provider质量

- 7个read-client用例与2个Order builder用例覆盖正常映射和部分字段反事实；Provider测试只核ID/签名。
- 无非末页短页、跨页重复、deadline/10k上限、供应商调用数或Channel job集成，见F-0107。
- test/typecheck因缺vitest/tsc退出127；未build。详见`records/AU-025-cake-provider/`。

## 25. AU-026 Flower Provider质量

- 包内唯一13行测试只检查required provider ID、definition ID和manifest签名；没有实例化FlowerReadClient或FlowerMapper。
- 非末页短页、全扫调用量、分类/字段反事实、价格不变量、deadline和Channel job集成都无测试，见F-0111。
- test/typecheck因缺vitest/tsc退出127；未build。详见`records/AU-026-flower-provider/`。

## 26. AU-027 Meal Provider质量

- Ports测试覆盖KFC单scope Catalog/Price、只读port和一个禁用OrderDraft；Provider测试核required ID、签名与品牌枚举。
- Starbucks、McDonald's、Luckin、Cotti、Pizza Hut、Molly Tea六分支，多scope health、错误聚合、ID编码和500-key边界未覆盖，见F-0115。
- test/typecheck因缺vitest/tsc退出127；未build。详见`records/AU-027-meal-provider/`。

## 27. AU-028 Book Provider质量

- 包内唯一13行测试只检查required provider ID、definition ID和manifest签名；不调用factory或任何业务port。
- 没有capability-port矩阵、Order→tracking、Catalog canonical字段、非幂等写入、Wenxuan认证/响应或Webhook集成测试，见F-0118。
- test/typecheck因缺vitest/tsc退出127；未build。详见`records/AU-028-book-provider/`。

## 28. AU-029 Directcharge Provider质量

- 包内唯一13行测试只检查required provider ID、definition ID和manifest签名；不调用factory或任何业务port。
- 没有Order/Logistics可达性、capability-port矩阵、直充/查询/退款/验券、Wanlian RSA协议或Webhook集成测试，见F-0121。
- test/typecheck因缺vitest/tsc退出127；未build。详见`records/AU-029-directcharge-provider/`。

## 29. AU-030 Jdfresh Provider质量

- 唯一13行测试只核ID/签名；库存、Order→tracking、TimeSlot和能力矩阵无测试（F-0124）。
- test/typecheck因缺vitest/tsc退出127；详见`records/AU-030-jdfresh-provider/`。

## 30. AU-031 Jdproduct Provider质量

- 测试与其他provider一致：唯一13行测试仅核required provider ID与签名；未实例化factory，不覆盖`catalog/price/stock/order/tracking/refund/statement`或Return语义矩阵（F-0126）。
- 生产入口与映射层仅在手工探针与provider反查中确认；`manifest`与`operations`口径不一致不在测试里验证（F-0125）。
- test/typecheck因缺vitest/tsc退出127；未执行build。详见`records/AU-031-jdproduct-provider/`。

## 128. AU-128 Notification 管理与读取质量

- Notification 测试目录的 manifest、identity job/backlog、delivery adapter 测试均不实例化八项 preference、endpoint、template、announcement 或 read HTTP action。
- 全服务 operation-id 检索只发现 manifest strings 和 IdentityRegistration entrypoint 的两条静态 route match；无法证明 scope、version、KMS endpoint、WeChat authorization 或 keyset 行为，见 F-0172/P2。
- 本 AU 未运行 Vitest；没有为弥补测试空缺发明测试命令。

## 133. AU-133 Catalog 媒体复制质量

- media replication、product registration、OSS adapter 和 Worker 均有局部测试文件；本 AU 已确认 Worker 测试覆盖 fallback、incomplete registration 与 payload 基础合法性。
- 未见 http/private address、redirect、oversize response 或流式读取边界反事实；结合 source URL 直接 raw fetch 形成 F-0173/P1，待独立复核。
- 本 AU 未运行 Vitest。

## 134. AU-134 Catalog 媒体 URL 边界独立复核

- 两项测试分别固定 HTTPS provider 示例和基本 fallback/incomplete 反事实，均不构造 http、loopback/private IP、redirect、超大/流式 body。
- 独立调用链重查与 F-0173 一致，P1 保持、双轮确认；本 AU 未运行 Vitest。

## 136. AU-136 Catalog 媒体复制测试深审

- 三项测试合计覆盖 OSS adapter、replication coordinator 和 PGlite persistence：required/optional replica、hash mismatch、failure recovery、解绑、重试、多 target 与迁移 ledger 均有行为断言。
- 这些测试把 provider URL 作为已下载 bytes 或 HTTPS 示例，未覆盖 Worker URL allowlist、redirect 或 response-size；F-0173/P1 不因存储层测试充分而降级。
- 本 AU 未运行 Vitest。

## 137. AU-137 Catalog 导入与操作测试深审

- CatalogOperations、CatalogPackage、PgCatalogImport 三项测试直接覆盖 scope、去重/confirm、发布 progress、package row validation、stage-before-write、running facts 与 invalid row isolation。
- 这些测试为 Catalog 核心导入/发布状态转换提供了真实行为规格；本 AU 未运行 Vitest。

## 138. AU-138 Catalog 风险、SKU 与迁移测试深审

- `CatalogReadPerformanceMigration` 用 PGlite 真实执行 reverse-lookup migration 并核对三个索引；`SupplierNetworkMigration` 执行供应网络与 analytics migration 后核对供货方、价格、库存、结算与 reporting facts；`module.manifest` 核对 HTTP/job/event inventory。
- `ApplyRiskDecision` 与 `PgCatalogSku` 未见同名直接行为 fixture；本批次已从 Risk Worker 和 InventoryImportProcessor 的真实调用侧确认其职责，未把这一事实替代为运行验证。
- 已以项目正式 `npm test` 入口定向执行三项测试；审计 worktree 中 `vitest` 缺失，命令退出 127，因此测试执行状态为未验证，未修复或安装依赖。

## 139. AU-139 Catalog fixture 与兼容入口深审

- `catalog-cake-media.mock.json` 与 `catalog-package-v1.mock.json` 都清晰标示 `isMock`/`simulated`，并被既审 CatalogProductMediaRegistration、CatalogPackage、PgCatalogImport fixture 直接加载；它们不构成生产货盘或运行配置。
- 兼容入口不增加可执行分支；其中 legacy `interface/job/CatalogImportJob.ts` 仍受主 jobs catalog 导入，不能因自身仅一行转发而删除。

## 140. AU-140 Purchase composition 与支付边界深审

- `PurchaseOperations.test` 覆盖 internal capture、idempotency replay、AAL/actor/risk/tender 拒绝和 response allowlist；Policy、Benefit、禁用 payment/voucher 与 manifest 都有直接本地测试。
- Quote create 和 order create composition 没有直接行为 fixture；API entrypoint 仅断言 route→operation 注册，见 F-0174/P2。
- 因 AU-138 已证明审计 worktree 无 `vitest`，本 AU 未重复执行同一不可运行命令；所有测试执行结论仍为未验证。

## 141. AU-141 Runtime 专用健康探针深审

- Shared `RuntimeOperations.test` 以 fake pool 验证 queue oldest-age SQL 的 FILTER 位置；manifest test 仅验证 variant module identity。
- Purchase、Web Business、Identity Registration、Mall Provisioning 的 profile health operation 在测试中没有直接实例化或 invoke，见 F-0175/P2。
- 本 AU 未重复执行缺失 Vitest 的命令；测试执行状态仍为未验证。

## 142. AU-142 Voucher HTTP operation 与策略深审

- Policy test 覆盖 representative allowed/forbidden transition；manifest test 覆盖 public export 隔离、dependencies、operations、events、jobs。
- 19 项 Voucher action/查询未有直接 operation/repository/transaction fixture，见 F-0176/P2。
- 本 AU 未运行 Vitest；审计 worktree 的依赖缺口已在 AU-138 留档。

## 143. AU-143 Voucher 导入与异步生命周期深审

- VoucherPort、PgVoucherImport、VoucherImportProcessor、VoucherJobProcessor 和 VoucherDeadletter 没有直接测试；唯一 VoucherPort 跨模块实例使用空 selection，不能触及其写入路径。
- 导入加密/分片、issue/status/expiry chunk/continuation、finance/outbox/deadletter 的状态与恢复边界因此无回归规格，见 F-0177/P2。
- 本 AU 未运行 Vitest；不安装审计 worktree 依赖。

## 144. AU-144 Voucher 兼容入口与覆盖闭合

- Voucher 兼容出口没有独立业务分支；根 wrapper 的默认 FinancePort 注入仍被真实 checkout/order/payment/verification consumer 使用。
- 不将兼容转发误判为无用；全模块 47/47 文件已获得审阅状态。

## 145. AU-145 Mall Provisioning、模板克隆与域名购买深审

- CreateMall、HostedNodeProvisioningPort、template clone、domain policy/lifecycle、manifest 都有直接测试；CreateMall 覆盖 mall graph 顺序、stable IDs 与 conflict-before-write。
- `provisioningOperations` 本身没有 direct invoke；entrypoint test 仅断言 routes，见 F-0178/P2。
- 本 AU 未运行 Vitest；审计 worktree 依赖缺口保持未修复。

## 146. AU-146 Provisioning 兼容入口与覆盖闭合

- 兼容文件不包含独立运行分支；public index 的 export isolation 已由 manifest test 覆盖。
- 不将旧分层转发当作删除依据；Provisioning 27/27 文件已获得审阅状态。

## 147. AU-147 Member 运营读取与自定义资料深审

- `MemberReadOperations.test` 的 PGlite fixture 覆盖治理子树、operator/storefront 分离、商城范围、masked output、membership-bound identity、搜索、keyset、详情/邀请关系/订单和非 mall scope 拒绝；`MemberCustomProfileOperations.test` 覆盖七类字段、系统标签与跨商城隔离。
- `IdentityRegistrationApiEntrypoint.test` 和 manifest test 证明 selected-module 的 route/operation 装配与 public surface，但不能替代生产 HTTP/数据库执行。
- 按正式 Commerce `npm test` 入口定向运行 4 个相关文件，因 audit worktree 缺少 `vitest` 以退出码 127 终止；未安装依赖，所有本 AU 测试执行结论标为未验证。

## 148. AU-148 Member public port 与导入异步链深审

- `MemberPort.test` 直接以 fake database 断言 registration policy/invitation 条件、mobile mask、hosted node registration、Hosted mall open 与 sovereign upgrade 的 database-function 输入和 authority/result context；未覆盖真实 SQL function 或 HTTP action。
- `MemberImportOperations`、`PgMemberImport`、`MemberImportProcessor` 和 `MemberProfileImport` 在 `*.test.ts` 中没有 direct behavior fixture；staging、savepoint、cursor continuation、report completion/reject/fault 没有本模块回归规格。
- 本 AU 不重复运行已证实会在加载前因缺少 `vitest` 失败的同一工作区命令。F-0179 的 action 覆盖由 source-level composition 可直接复现，但尚未有 response projection regression test。

## 149. AU-149 Risk 策略与运行链深审

- Risk 的现有 unit tests 证明 engine hard limit/rollout/case transition 与 evaluator 的 selected decision；manifest test 证明 operation/job/event 声明。
- PostgreSQL repository、RiskCheckAdapter、HTTP route、riskscan policy replay/catalog deny consumer 没有直接行为 fixture，见 F-0180/P2。

## 150. AU-150 Risk compatibility 与覆盖闭合

- 兼容导出没有独立业务分支；`interface/job/RiskReplayJob.ts` 仍由主 jobs catalog 使用。
- Risk 36/36 文件已取得审阅状态；不将兼容转发误判为删除候选。

## 151. AU-151 Inventory 库存与导入深审

- `InventoryPort.test` 覆盖 reservation lock、mall-scoped movement、commit/release idempotency 和 return restock；manifest 覆盖 operation/job declaration。
- Inventory import operation/persistence/worker、StockImport 和 availability action 无 direct behavior fixture，见 F-0181/P2。

## 152. AU-152 Inventory compatibility 与覆盖闭合

- 兼容导出无独立业务分支；legacy job paths 由主 jobs catalog 直接消费。
- Inventory 20/20 文件均取得审阅状态，不将转发路径误判为删除候选。

## 153. AU-153 Partner、Store 与供应关系深审

- 唯一 Partner test 只断言 manifest operations/public identity。
- PartnerOperations 和 SupplierRelationshipPort 没有 direct behavior fixture，见 F-0182/P2。

## 154. AU-154 Audit compatibility 与覆盖闭合

- legacy export 无独立业务分支；manifest test 验证 public export isolation 与 audit HTTP/job declarations。
- Audit 25/25 文件均取得审阅状态。

## 155. AU-155 Reporting read/export HTTP 深审

- Reporting read test 覆盖 PostgreSQL timestamp cursor；ExportDocument test 覆盖 XLSX、CSV formula neutralization、order export filter/scope SQL 和任务列表。
- 本批未将 projection/export Worker 行为纳入结论，保留下一独立单元。

## 156. AU-156 Reporting projection/export Worker 深审

- ProjectEvent test 覆盖 paid-event hierarchy/partner metric 与未知事件 fail-closed；ExportDocument test 仅覆盖 document helper。
- 两个 JobProcessor 无 direct process/retry/abort/integrity/cache fixture，见 F-0183/P2。

## 157. AU-157 Reporting compatibility 与根入口深审

- 本批为 16 个纯 re-export 或 public index；无独立测试逻辑。
- root/runtime consumer 与仓内零 caller 的差异已纳入 G0/G1 清单，不以“缺测试”推导缺陷。

## 158. AU-158 Access owner/admin 深审

- Administrator segment tests 直接覆盖 database command shape、storefront identity fail-closed 与 note/list/detail；OwnerActionProof tests 覆盖 exact binding、篡改、缺失、过期和 HMAC domain separation。
- 未运行正式 suite：审计 worktree 依赖基线没有 Vitest；本批无源代码变更。

## 159. AU-159 Mall context 深审

- Direct unit tests 覆盖 mall-scope precedence、unique direct grant、ambiguous rejection、path non-inference 和 explicit job/event restore。
- 未运行正式 suite：审计 worktree 依赖基线没有 Vitest；本批无源代码变更。

## 160. AU-160 Verification core 深审

- 唯一测试只验证 manifest capabilities/operation list；没有 direct action fixture。
- nonce issue/consume/replay、trusted-device scope、voucher redeem/outbox 和 device version conflict 缺口见 F-0184/P2。

## 161. AU-161 Support case/message 写入链深审

- 现有 direct test 只验证 send prepare 的 expected-version 和 locked lookup conflict。
- case create、successful message side effects、scope/KMS error 与 SLA/assignment/outbox 没有 fixture，见 F-0185/P2。

## 162. AU-162 Support read/health 深审

- PGlite test 验证 message pagination、排序和 KMS finalize，但只使用授权 member fixture。
- 未覆盖未授权 case 的 attachment metadata；该查询缺少同等 authorization predicate，见 F-0186/P1，待独立复核。

## 164. AU-164 Support assignment/state 深审

- 本批没有 assignment、SLA 或 ticket close/reopen direct tests。
- transition 的 stale-version history 顺序缺陷见 F-0187/P2；需用失败和成功 fixture 固化契约。

## 165. AU-165 Support public/compatibility 深审

- Manifest test 断言 public surface 隔离、operation/event inventory 与 route/job declaration。
- 历史转发没有独立业务分支；G0/G1 依据 caller/compatibility evidence 记录，不将无 direct test 误记为运行缺陷。

## 166. AU-166 Commerce root test 深审

- DomainPolicy 是跨 checkout、finance、inventory、order、risk、support、notification、identity 的精确领域不变量规格。
- ModuleCatalog 断言 operation 归属、模块依赖与 method/path 唯一性；未运行正式 suite，审计 worktree 依赖基线没有 Vitest。

## 169. AU-169 Storefront public catalog/media 深审

- Catalog tests 直接覆盖 production configuration、mall slug sanitation、page bound/cache tier、ETag/mirror、taxonomy query、signed proxy/CDN 和上游失败。
- Wechat notification cryptographic tests不属于本批，留在支付 provider 单元；本批未将其缺席误记为 coverage gap。

## 170. AU-170 Session/membership/assurance 深审

- Session tests 直接验证 host-only cookie、不同 admin key、篡改/legacy payload 拒绝和 miniapp bearer 不能进入 admin host。
- Membership scope test 拒绝 request-shaped scope；assurance test 覆盖缺失/账号级拒绝与手机验证通过。

## 171. AU-171 Compatibility public auth 深审

- Handler tests直接覆盖 production禁用demo、phone/username credential、origin/redirect、membership multi-entrance fail-closed、initial-password reset和logout。
- Password、demo、test-only limiter tests覆盖PBKDF2/normalization、membership role binding、IPv4/IPv6 allowlist/expiry及bypass仍拒绝错误密码；审计工作树未运行Vitest。

## 172. AU-172 Core read-cache client 深审

- Direct tests覆盖无端点禁用、fresh envelope/token不在URL、网络故障unavailable，以及包含projection metadata的PUT写入。
- 未覆盖恶意sidecar响应或端点DNS变化；client只接私有loopback HTTP或HTTPS，sidecar本体留在其服务审阅。审计工作树未运行Vitest。

## 173. AU-173 HTTP transport 深审

- `http.test.ts` 直接覆盖JSON/错误/405 的 status、Allow、request-id与防护headers。
- `errorResponse.ts` 及 `routerSupport.ts` 没有同层direct fixture；应补已知/未知error、32KB边界、错误声明长度与实际长度、server-only scope参数。见F-0188/P3；审计工作树未运行Vitest。

## 174. AU-174 RPC/crypto adapter 深审

- Order/registration route tests以真实 `encryptJson` 调用进入上层mock RPC，但不解密或断言cipher envelope；`supabase.ts`与`crypto.ts`没有同层测试。
- 应直接覆盖AES-GCM round-trip、IV随机性、篡改/错误key拒绝、非法key与RPC 204/non-OK 2KB截断。见F-0189/P2；审计工作树未运行Vitest。

## 175. AU-175 WeChat/registration/step-up compatibility auth 深审

- WeChat test覆盖provider code公开结果、不回传session_key、new/existing membership与atomic register-bind；registration test覆盖OTP/debug/production禁用、输入/limiter/邀请结果；step-up test覆盖错误密码、成功新cookie和limiter。
- WeChat bind direct handler和OTP provider failure/retry没有本批direct fixture；当前auth namespace也没有正式router registration。审计工作树未运行Vitest。

## 176. AU-176 WeChat prepay/status 深审

- Direct test覆盖payment-status vocabulary、owned order detail和storefront payment-status route一致性。
- 没有prepay成功/reuse、phone/scope/idempotency拒绝、provider create/error、record failure或provider reconciliation direct fixture。见F-0190/P2；审计工作树未运行Vitest。

## 177. AU-177 WeChat Provider core 深审

- Client fixture生成临时RSA key，直接断言JSAPI request签名、已签名prepay/query response、无签名拒绝和已签名provider 503的retry分类。
- config loader、crypto resource decrypt、transaction edge-state和signature verifier本体仍有其专项测试/源码单元；本批不把未读文件算入coverage。审计工作树未运行Vitest。

## 178. AU-178 WeChat signature/test support 深审

- Client及notification fixtures用临时生成的RSA pair和签名headers间接执行signature verifier；通知suite另覆盖fresh/stale/missing签名。
- Verifier没有独立test file，但两条consumer test路径以真实签名材料覆盖其关键accept/reject边界。审计工作树未运行Vitest。

## 179. AU-179 WeChat notification 深审

- Parser test直接覆盖真实加密通知的验签/decrypt/summary最小化、body tamper、stale notification和attempt amount mismatch。
- `wechatPaymentNotificationRoute.ts`没有direct handler fixture；应覆盖method/size/config/protocol/RPC success/RPC exception及provider expected `{code:'SUCCESS'}` response。见F-0191/P2；审计工作树未运行Vitest。

## 180. AU-180 Address book 深审

- `addressRoutes.ts`没有同层test；应直接覆盖permission、PII-key missing、GET decrypt、PUT input/cipher/RPC、DELETE found/not-found及cross-user scope body。见F-0192/P2；审计工作树未运行Vitest。

## 181. AU-181 Cart 深审

- Direct test只覆盖GET qualified server snapshot与canonical media URL，不测试cart mutation。
- 应补permission、PUT valid/invalid quantity、membership/user scope RPC、DELETE found/not-found及body-too-large。见F-0193/P2；审计工作树未运行Vitest。

## 182. AU-182 Member code 深审

- Direct tests验证签发RPC只收hash而非credential、payload/QR结构、核验权限/credential hash以及撤销UUID拒绝。
- 尚未运行suite；one-time/replay的数据库事务语义留待migration/RPC专项交叉审计。

## 183. AU-183 Qualification admin 深审

- Direct test覆盖admin target、read/manage permission、mall scope、selector redaction、idempotency、draft save、fresh step-up publish和critical approval queue。
- RPC/database side的version conflict、审批原子状态和治理子routes留待qualification governance/RPC专项审计；审计工作树未运行Vitest。

## 184. AU-184 Qualification governance 深审

- Direct tests覆盖治理页面redaction、approval fresh step-up与server reviewer actor、employee tags/step-up和simulation current mall scope。
- History/rollback/preview各分支仍缺direct fixture；其handler依赖已覆盖的parse/persist helpers，数据库审批原子语义留给RPC专项审计。审计工作树未运行Vitest。

## 185. AU-185 Order/after-sale writes 深审

- Direct tests只覆盖phone assurance阻断在create order/internal payment之前、以及create-order成功的cart closure。
- 未直接覆盖after-sale、order list/ship、internal-payment success/validation、refund和finance reconciliation；见F-0194/P2。审计工作树未运行Vitest。

## 186. AU-186 Storefront account/bootstrap 深审

- Direct tests覆盖bootstrap采用当前database member profile而非demo资料、profile缺失闭合拒绝。
- accounts、account-ledgers和home snapshot没有direct fixture；不足以捕获order.read、current scope、余额mapping或并发失败传播回归，见F-0195/P2。审计工作树未运行Vitest。

## 187. AU-187 Member operations 深审

- Direct tests覆盖列表读取权限与PII/history/import-errors裁剪、invite fresh step-up拒绝、建档密码只传hash、无效导入错误不回显password。
- 缺少invite成功/停用、profile update、valid/partial import、1MB与500行边界的direct fixture；见F-0196/P2。审计工作树未运行Vitest。

## 188. AU-188 Permission admin 深审

- Direct tests覆盖读取双权限和PII裁剪、access自改禁令/fresh step-up/去重及商业层级scope、status自改禁令和offboard独立permission。
- 没有membership status成功RPC fixture或active/suspended路径覆盖；见F-0197/P2。审计工作树未运行Vitest。

## 189. AU-189 Custom roles 深审

- Direct tests覆盖role.read、create fresh step-up、validated create RPC payload、clone/permissions冲突、active/disabled permission分流和update拒绝。
- Update success RPC和disabled success RPC body并未完整fixture；但核心状态授权与create/enable成功路径已直接验证，作为覆盖缺口保留，不单列新问题。审计工作树未运行Vitest。

## 190. AU-190 Admin catalog/status 深审

- Direct tests覆盖catalog permission、overview target、product status coarse permission和overview返回server employee profile。
- Product status没有resource scope/idempotency/input或active/inactive成功RPC fixture；见F-0198/P2。审计工作树未运行Vitest。

## 191. AU-191 Storefront home composition 深审

- 未找到`homeRoutes` direct fixture；组合层的success及任一child failure传播不被独立验证，已归入F-0195/P2。审计工作树未运行Vitest。

## 192. AU-192 Security center compatibility 深审

- Direct tests覆盖current-password change、生产SMS未配置闭合、phone-change匿名拒绝和撤销其他session。
- security center、password reset、phone-change成功/失败和single-session revoke没有direct fixture；这些当前未注册的compatibility handlers一旦重新承诺会有回归盲区，见F-0199/P2。审计工作树未运行Vitest。

## 193. AU-193 OTP delivery 深审

- Existing test仅验证`OTP_RESEND_AFTER_SECONDS`为30秒。
- 没有direct fixture覆盖provider send、delivery record、record failure或provider error映射；见F-0200/P2。审计工作树未运行Vitest。

## 194. AU-194 SMS provider 深审

- Direct tests覆盖debug仅test、Aliyun request/单次3秒timeout及provider rejection净化。
- 缺失Aliyun sign/template与client transport throw没有fixture，见F-0201/P3。审计工作树未运行Vitest。

## 195. AU-195 Shared validation 深审

- Direct tests覆盖每个导出parser的正常输入和主要拒绝分支：重复SKU、金额、类型/渠道、手机号与voucher对应关系。
- Parser只做本地输入边界；数据库资源scope、余额和状态语义由调用route/RPC专项审计承接。无P0–P3新问题；审计工作树未运行Vitest。

## 196. AU-196 Payment simulation 深审

- 未找到payment simulation direct route fixture；local validation tests不能证明环境、target、permission、server order scope或write RPC参数。
- Production由simulation router和handler双重gate返回404；测试资金完整行为缺口见F-0202/P2。审计工作树未运行Vitest。

## 197. AU-197 Target routing tests 深审

- Direct mocked-router tests覆盖顶层storefront/admin分流、auth固定404及business/simulation错误target不进入handler。
- 下游真实handler/RPC行为不由这些routing tests替代，已在各模块单元单独评估。无P0–P3新问题；审计工作树未运行Vitest。

## 198. AU-198 WeChat routing-boundary test 深审

- Direct router test覆盖retired WeChat auth 404、public callback的POST method boundary与anonymous prepay认证拒绝。
- Handler内部回调RPC、prepay write和provider错误仍需各自route fixture，已记录F-0190/F-0191。无P0–P3新问题；审计工作树未运行Vitest。

## 199. AU-199 Runtime types 深审

- Type declarations本身没有独立运行行为；其关键field约束通过auth/router/handler测试与类型检查间接消费。
- 环境变量的部署注入与线上secret存在性属于runtime/deployment专项，不由TypeScript接口本身证明。无P0–P3新问题。

## 200. AU-200 WeChat Pay core test 深审

- Direct tests覆盖config fail-closed、RSA canonical signing、miniapp payment signature、description与trade-state helper。
- 不覆盖prepay/callback route到RPC/provider的行为，相关缺口已分别记录F-0190/F-0191。无P0–P3新问题；审计工作树未运行Vitest。

## 201. AU-201 Bootstrap container 深审

- ApiBootstrap direct test验证registered node manifest到实际request NodeContext的装配。
- Container的bind/get/duplicate/missing/freeze不变量没有独立fixture，见F-0203/P3。审计工作树未运行Vitest。

## 202. AU-202 Manifest signature verifier 深审

- 未找到manifest signature verifier的直接密码学fixture。
- 有效/篡改/错误key/base64行为未被该安全边界直接验证，见F-0204/P2。审计工作树未运行Vitest。

## 203. AU-203 Extension registry canary test 深审

- Direct test覆盖unhealthy canary discard保留旧实例、healthy candidate activation替换并停止旧实例。
- Registry其余分支与provider capability契约由AU-041及已有F-0127/F-0128专项记录承接。无P0–P3新问题；审计工作树未运行Vitest。

## 204. AU-204 Catalog Operator API runtime 深审

- Direct tests覆盖L1 manifest/origin/NodeContext与DB role compatibility failure。
- 不覆盖secret/object readiness、compatibility failure teardown、successful configure或close，见F-0205/P2。审计工作树未运行Vitest。

## 205. AU-205 Provider factories 深审

- 未找到factory catalog或unknown provider ID的direct fixture。
- Factory mapping错误可能在ProviderLoader启动时才暴露，见F-0206/P3。审计工作树未运行Vitest。

## 206. AU-206 CommandBus 深审

- 未找到CommandBus direct fixture；注册、重复、冻结、缺handler与dispatch行为仅由下游间接消费。
- 见F-0207/P3。审计工作树未运行Vitest。

## 207. AU-207 QueryBus 深审

- 未找到QueryBus direct fixture；注册、重复、冻结、缺handler与dispatch行为仅由下游间接消费。
- 见F-0208/P3。审计工作树未运行Vitest。

## 208. AU-208 TransactionRunner 深审

- TransactionRunner无独立分支；其唯一语义为忠实转交UnitOfWork并保留query/command transaction context。
- ModuleOperations通过不同workload pool消费它；无P0–P3新问题。

## 209. AU-209 UnitOfWork contract 深审

- ExecutionKernel direct test覆盖branded write transaction在execute后立即失效。
- PgUnitOfWork的锁、retry与rollback已在基础设施专项审阅；UnitOfWork契约本身无额外运行分支。无P0–P3新问题。

## 210. AU-210 ModuleOperations 深审

- Direct test覆盖identity/observability审计敏感字段、prepare→transaction→finalize顺序、write replay、public idempotency actor及expectedVersion hash绑定。
- 未覆盖catalog/action mismatch、deadline/abort、lifecycle discard和write short-circuit禁止，见F-0209/P3。审计工作树未运行Vitest。

## 211. AU-211 AuditSink contract 深审

- AuditSink是应用层接口，运行行为由已审RecordAudit、AuditRecord/AccessRecord与PgAuditRepository实现；接口不单独产生可执行分支。
- RecordAudit绑定和领域模型fixture由既有AU-051/AU-108承接；无P0–P3新问题。

## 212. AU-212 Generic BatchImport 深审

- 未找到BatchImportProcessor direct fixture；子模块测试只覆盖各自端口/operation/manifest，不能证明公共状态推进、对象失败分类、abort及report完成行为。
- 三个生产Jobs catalog entry直接运行该路径，见F-0210/P2。审计工作树未运行Vitest。

## 213. AU-213 Command message contract 深审

- Command仅为CommandBus泛型输入提供type discriminant；本身没有可执行分支。
- CommandBus direct fixture仍缺，已由F-0207记录；无P0–P3新问题。

## 214. AU-214 ExecutionKernel 深审

- Direct in-memory transaction fixture覆盖并发同key单次写入及replay、hash冲突、失败rollback/retry、key和transition拒绝、write context生命周期。
- 未直接覆盖provider fallback key、OperationRejection完成持久化和checkpoint丢失，见F-0211/P3。审计工作树未运行Vitest。

## 215. AU-215 Handler contract 深审

- Handler为type-only泛型契约，没有独立可执行分支；其dispatch行为由CommandBus/QueryBus审计单元承接。
- 无P0–P3新问题。

## 216. AU-216 Identity credential replay 深审

- Direct fixture通过真实ModuleOperations确认敏感session/ticket/cookie和invitation code不会写入可重放response，第二次请求不再执行业务action。
- AU-218确认OwnerActionCredentialPersistence覆盖ownership preview proof而非`identity.stepup.complete` action-proof；后者缺direct fixture，见F-0212/P3。审计工作树未运行Vitest。

## 217. AU-217 Job contract 深审

- Job是type-only执行契约；QueueJob/JobRunner和各runtime的行为由其各自审计与测试承接。
- 无P0–P3新问题。

## 218. AU-218 Ownership credential persistence 深审

- Direct fixture确认`access.ownership.transfers.preview`的proof不进入audit或idempotency replay，且第二次请求不重执行业务action。
- accept/cancel preview共用同一projection规则；step-up action proof使用不同分支且无direct fixture，见F-0212/P3。审计工作树未运行Vitest。

## 219. AU-219 Query message contract 深审

- Query仅为QueryBus泛型输入提供type discriminant；本身没有可执行分支。
- QueryBus direct fixture仍缺，已由F-0208记录；无P0–P3新问题。

## 220. AU-220 VersionedKey 深审

- Cache.test直接覆盖experience的active/version键区分和缺字段拒绝；webbusiness test间接使用reporting key。
- 未直接覆盖reporting field set、extra field、empty及超过512字符值，见F-0213/P3。审计工作树未运行Vitest。

## 221. AU-221 Domain primitives 深审

- 领域基础转发没有独立业务分支；其运行语义由已审`@shop/kernel`与各领域模型/policy fixture承接。
- Specification保持DC-0011/G1兼容候选；无P0–P3新问题。

## 222. AU-222 HealthProbe 深审

- 未找到HealthProbe direct fixture；现有HTTP server/route tests不能证明release smoke检查语义。
- HealthProbe把live/startup/ready任一有效status视为任意probe成功，可能产生错误通过，见F-0214/P2。审计工作树未运行Vitest。

## 223. AU-223 HttpClient direct test 深审

- Direct fixture覆盖read transport retry、unsafe write不重试与204 response handling。
- 不覆盖connection/response timeout、external abort或redirect error，见F-0215/P2。审计工作树未运行Vitest。

## 224. AU-224 CSV parser 深审

- 未找到parseCsv direct fixture；下游导入/财务测试不能替代通用CSV格式与错误码契约。
- 见F-0216/P2。审计工作树未运行Vitest。

## 225. AU-225 Deadline contract 深审

- Deadline为内核转发；HTTP deadline error mapping已有HttpApp direct fixture，其他行为由已审kernel/consumer承接。
- 无P0–P3新问题。

## 226. AU-226 Bulkhead contract 深审

- Bulkhead是内核转发；外部调用的排队/并发行为由Executor与kernel审计承接。
- 无P0–P3新问题。

## 227. AU-227 CircuitBreaker contract 深审

- CircuitBreaker为内核转发；实际熔断调用链由Executor与kernel审计承接。
- 无P0–P3新问题。

## 228. AU-228 Parallel contract 深审

- 未找到mapParallel direct fixture；现有券码模块测试不能固定通用并发、顺序和失败后在途operation语义。
- 见F-0217/P3。审计工作树未运行Vitest。

## 229. AU-229 RateLimiter contract 深审

- RateLimiter为内核转发；实际令牌行为由已审kernel及Executor调用链承接。
- 无P0–P3新问题。

## 230. AU-230 Semaphore contract 深审

- Semaphore为内核转发；实际并发行为由已审kernel和其四个Commerce消费者承接。
- 无P0–P3新问题。

## 231. AU-231 CursorCodec contract 深审

- 现有fixture覆盖canonical round-trip、malformed与unsupported version；不覆盖标题所称non-canonical值或position边界。
- 见F-0218/P3。审计工作树未运行Vitest。

## 232. AU-232 HttpRequest contract 深审

- HttpRequest为类型契约；运行行为由已审HttpApp、RouteRegistry与OperationController承接。
- 无P0–P3新问题。

## 233. AU-233 HttpResponse contract 深审

- HttpApp与NodeServer fixture均断言204运行输出；错误/操作结果生产者属于既有审计单元。
- 无P0–P3新问题。

## 234. AU-234 Validation/pagination shared boundary 深审

- Pagination fixture只覆盖Date sort的lookahead与terminal page；共同输入校验、query parse和result position分支没有direct fixture。
- 见F-0219/P2。审计工作树未运行Vitest。

## 235. AU-235 NodeServer ingress test boundary 深审

- 现有fixture覆盖node ingress与trusted peer address；没有端到端体积、取消、错误映射或response header/cookie写回fixture。
- 见F-0220/P2。审计工作树未运行Vitest。

## 236. AU-236 ErrorMapper contract 深审

- 现有direct fixture只锁定409与unknown 500；DomainError、冒号、non-Error与其他status族未覆盖。
- 见F-0221/P2。审计工作树未运行Vitest。

## 237. AU-237 HttpApp gates fixture 深审

- 覆盖declared gate、无声明旁路、无plugin与plugin failure的观测且不改变handler响应；与catalog当前唯一gate declaration闭合。
- 无P0–P3新问题。审计工作树未运行Vitest。

## 238. AU-238 Catalog controller scope fixture 深审

- Fixture直接注册catalog route并在authorizer截取参数，覆盖publication task的scope授权和普通import的具体resource授权。
- 无P0–P3新问题。审计工作树未运行Vitest。

## 239. AU-239 Finance controller scope fixture 深审

- 直接覆盖新policy的preview/manage在authorizer前使用selected scope，而不是未持久化的policy ID资源。
- 无P0–P3新问题。审计工作树未运行Vitest。
