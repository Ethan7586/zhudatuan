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
