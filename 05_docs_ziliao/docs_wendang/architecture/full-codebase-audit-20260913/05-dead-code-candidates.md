# 全代码库系统审计｜05 垃圾代码候选

## 1. 当前口径

AU-005 首次建立候选总账。零静态引用、零正式target或测试只调用某实现都不能单独证明可删除；数据、迁移、兼容、运维、唯一契约和恢复责任必须同时排除。本文件只记录已经进入G0–GX判定的对象，不等于删除计划。

当前累计：G0 60、G1 85、G2 5、G3 0、GX 40。没有任何已满足13项删除条件并完成第二次独立复核的G3。

## DC-0001｜授权版 Secret/KMS Handler 与 WorkloadAccessPolicy

| 字段 | 记录 |
| --- | --- |
| 分类 | G0：不是垃圾 |
| 对象 | `04_tools/tools/localsecrets/src/Handler.ts`、`localkms/src/Handler.ts`、`localinfra/src/WorkloadAccessPolicy.ts`及对应测试 |
| 疑似原因 | 排除测试和定义后，授权Handler生产引用为0；实际Main没有调用 |
| 保留证据 | [FACT][E-AU-005-006] 它们是仓库中唯一实现workload Bearer、401/403和exact secret/key ref授权的代码，并有反事实测试和staging policy契约 |
| 运行结论 | 缺陷是生产接线绕过它们（F-0021），不是这些文件无职责 |
| 数据/契约责任 | 保存Secret/KMS预期权限契约；删除会消灭唯一可执行规格并扩大修复不确定性 |
| 可否删除 | 否 |
| 二次复核 | G0不强制；F-0021本身在RV-0003队列 |

## GX-0001｜聚合 Jobs 通用控制面

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除，需专项设计 |
| 对象 | `entry/JobsMain.ts`、`entry/FullJobsMain.ts`、`OutboxRelay.ts`、`RuntimeEventPublisher.ts`、`RuntimeScheduler.ts`、`RuntimeJobs.ts`及其注册/测试 |
| 疑似原因 | production release/remote policy没有aggregate Jobs target，只有专用identity/catalog/payment workers；full-staging unit被设计为保持inactive |
| 保留证据 | [FACT][E-AU-005-003][E-AU-005-004] 这些对象保存唯一通用outbox→inbox/job发布、周期expiry、cleanup与过期running重排能力；全仓49个非测试文件含outbox写入语句，其中34个属于commerce运行源码 |
| 运行结论 | 正式控制面缺失形成F-0022；零target是接线风险，不是删除证据 |
| 数据/契约责任 | 承担持久事件、派生job、retention和崩溃恢复责任；删除会使恢复路径永久丢失 |
| 可否删除 | 禁止 |
| 二次复核 | 是，RV-0006待第二位独立审计者 |

## DC-0002｜ClientEnvironment 浏览器投影

| 字段 | 记录 |
| --- | --- |
| 分类 | G1：疑似闲置，证据不足 |
| 对象 | packages/config/src/ClientEnvironment.ts及package subpath ./client |
| 疑似原因 | [FACT][E-AU-006-009] 固定基线仅index.test调用clientEnvironment；Console/Auth/Storefront各有自己的运行配置路径 |
| 保留证据 | package.json仍公开./client；生产模式还保存API/Auth必须属于同一Identity节点的唯一可执行配对契约 |
| 未排除项 | 外部workspace/仓库消费者、历史兼容、未来统一客户端配置、动态包导入 |
| 可否删除 | 否；未满足公共API、兼容责任和等价替代条件 |
| 二次复核 | G1不强制；升级G2/G3前重新查包消费者和发布制品 |

## DC-0003｜ProviderEnvironment

| 字段 | 记录 |
| --- | --- |
| 分类 | G1：疑似闲置，证据不足 |
| 对象 | packages/config/src/ProviderEnvironment.ts，经@shop/config/server公共导出 |
| 疑似原因 | [FACT][E-AU-006-009] 固定基线没有生产或测试调用providerEnvironment |
| 保留证据 | 它仍位于公共server export，保存PROVIDER_REQUEST_TIMEOUT_MS解析契约；外部消费者未排除 |
| 未排除项 | 包外动态加载、兼容API、后续provider专项中的替代关系 |
| 可否删除 | 否；零仓内调用不等于无公共契约 |
| 二次复核 | G1不强制 |

## DC-0004｜minimumLength 与 base64ByteLength 公共 helper

| 字段 | 记录 |
| --- | --- |
| 分类 | G1：疑似闲置，证据不足 |
| 对象 | packages/config/src/Environment.ts:53-62，经@shop/config/server公共导出 |
| 疑似原因 | [FACT][E-AU-006-009] 全仓没有真实调用；同名minimumLength命中属于其它局部参数 |
| 保留证据 | 公共server subpath导出，可能是包兼容面；base64长度语义也可能被后续凭据契约复用 |
| 未排除项 | 外部消费者、语义版本承诺、尚未审阅provider/security模块 |
| 可否删除 | 否；未确认等价替代或正式下线 |
| 二次复核 | G1不强制 |

## DC-0005｜purchaseBrowserOrigins

| 字段 | 记录 |
| --- | --- |
| 分类 | G1：疑似闲置，证据不足 |
| 对象 | packages/config/src/SflNodeRegistry.ts:117-120，经sfl-node-registry subpath导出 |
| 疑似原因 | [FACT][E-AU-006-009] 固定基线只有定义，无调用；Purchase Bootstrap另从Manifest domain校验实际origin |
| 保留证据 | 函数投影registry中的purchase_origin_binding_refs，是当前声明里唯一显式浏览器购买来源集合API |
| 未排除项 | 外部发布/运维消费者、未来节点生成、与Purchase配置的定稿权威关系 |
| 可否删除 | 否；数据/契约责任与等价替代均未确认 |
| 二次复核 | G1不强制 |

## DC-0006｜capabilities.yml 影子目录

| 字段 | 记录 |
| --- | --- |
| 分类 | G0：不是垃圾，仍有真实构建职责 |
| 对象 | `01_core_hexin/packages/contract/definitions/capabilities.yml` |
| 疑似原因 | [STALE] voucher/Operations.md:19 声称该文件已删除；内容又只有190条，存在1个孤儿、5个permission漂移和156个Operation缺项 |
| 保留证据 | [FACT][E-AU-007-009/014] ContractGenerator.ts:49同步加载该文件，validateCapabilityAudiences对189个能匹配Operation的记录执行audience检查；删除会使generator读文件失败 |
| 运行结论 | 它不是数据库Capability发布权威，当前只是部分影子校验源；这是F-0041的边界/维护问题，不是零职责文件 |
| 数据/契约责任 | 保存历史Capability投影并影响正式contractgen check/generate能否启动；外部直接消费者仍未完全排除 |
| 可否删除 | 否；至少仍有静态加载和构建契约，不满足G3第1、3、5、6、9–13项 |
| 二次复核 | G0不强制；若未来决定退出该目录，必须作为独立兼容/生成器变更而不是垃圾清理 |

## DC-0007｜零仓内生产消费者的公共 Contract 与 Verification 符号

| 字段 | 记录 |
| --- | --- |
| 分类 | G1：疑似闲置，但证据不足 |
| 对象 | 生成的 EventSerializer.ts 中 `SERIALIZED_EVENT_TYPES`/`serializeEvent`/`SerializedEvent`；Contract.ts 的 `Contract`；VerificationContract.ts 的 `MEMBER_CODE_SECONDS`/`VerificationChallenge`/`VerificationResult` |
| 疑似原因 | [FACT][E-AU-007-014] 排除定义和generator模板后，固定仓库未找到这些符号的生产调用；实际事件发布使用app/events.ts的EVENT_HANDLERS/eventVersion |
| 保留证据 | 全部经@shop/contract根入口公开；EventSerializer由contractgen持续生成，Contract/Verification保存类型/时间契约；package外消费者、动态import和历史兼容未排除 |
| 未排除项 | 外部workspace/npm使用、类型级消费未被文本别名完整捕获、生成API兼容、未来Miniapp/Provider协议 |
| 可否独立删除 | 否；公共API、生成职责、等价替代、可观察行为和第二次复核均未满足 |
| 二次复核 | G1不强制；升级G2前需独立查外部消费者与语义版本承诺 |

## DC-0008｜生成的 Controller 与 Handler Operation ID 数组

| 字段 | 记录 |
| --- | --- |
| 分类 | G1：疑似闲置，但证据不足 |
| 对象 | 生成`OperationController.ts`的`CONTROLLER_OPERATION_IDS`与`OperationHandler.ts`的`HANDLED_OPERATION_IDS` |
| 疑似原因 | [FACT][E-AU-008-015] 排除generator模板和各自定义后，固定仓库未找到读取者；真实route/handler完整性由对象key、DefinedModule和RouteRegistry检查 |
| 保留证据 | 两个数组仍是生成模块的公开export，保存271个runtime ID的显式诊断投影；仓外工具、动态消费者和生成API兼容未排除 |
| 未排除项 | 外部架构检查、运行诊断、未来完整性oracle、生成输出语义版本承诺、等价替代的正式确认 |
| 可否独立删除 | 否；公共导出、生成职责、外部消费者和二次复核均未排除 |
| 二次复核 | G1不强制；升级G2前重查release/check工具和仓外消费者 |

## DC-0009｜SDK 已退出运行契约的兼容残留与微信 factory

| 字段 | 记录 |
| --- | --- |
| 分类 | G1：疑似闲置，但证据不足 |
| 对象 | `RequestContext.contractVersion`、`ApiError.contractResponse`、`defineStructuralOperation`、`createWechatCommerce` |
| 疑似原因 | [FACT][E-AU-008-015] context仍填充contractVersion但ApiClient不读取；其余符号没有仓内生产caller；版本/schema runtime阻断已由`57c1177d`正式退出 |
| 保留证据 | 全部仍经`@shop/sdk`公开或属于公开参数类型；`createWechatCommerce`是唯一微信Transport factory，且外部Miniapp工程/SDK消费者未知 |
| 未排除项 | npm/仓外调用者、类型兼容、历史客户端编译契约、Miniapp外置工程、正式deprecated周期和替代API |
| 可否独立删除 | 否；零仓内调用不能排除公共API、历史兼容和外部运行责任 |
| 二次复核 | G1不强制；升级G2/G3前必须查发布包消费者与Miniapp所有权 |

## DC-0010｜ModuleCatalog capability resolver

| 字段 | 记录 |
| --- | --- |
| 分类 | G1：疑似闲置，但证据不足 |
| 对象 | `packages/kernel/src/module_jiexianban/ModuleCatalog.ts` 的 `ModuleCatalog`、`ModuleSelection`、`ResolvedModulePlan` |
| 疑似原因 | [FACT][E-AU-009-003/006/014] 固定仓库只有自身4个测试构造ModuleCatalog；35份Commerce manifests只调用defineModuleManifest，正式startup使用另一套composition入口 |
| 保留证据 | 它仍经`@shop/kernel`根入口公开，保存仓库唯一capability provider/binding/topological resolver与missing/ambiguous/cycle契约；需求文档还引用历史ModuleCatalog测试路径 |
| 当前问题 | 35份manifest有37个required capability无provider，输入/返回对象又不具运行时不可变性，已登记F-0049；实现有缺陷不能作为删除依据 |
| 未排除项 | 仓外消费者、未来startup计划、公共类型兼容、架构所有者是否将其视为待接线能力、等价替代的正式确认 |
| 可否独立删除 | 否；公共API、测试规格、兼容/未来责任、等价替代、可观察行为与第二次复核均未满足 |
| 二次复核 | G1不强制；升级G2前须先定稿manifest执行责任并查仓外消费者 |

## DC-0011｜零仓内生产调用的 Kernel 公共原语组

| 字段 | 记录 |
| --- | --- |
| 分类 | G1：疑似闲置，但证据不足 |
| 对象 | `Email`、`Hash`、`Mobile`、`Page/page`、`Result/success/failure`、`Version`、`Specification/AndSpecification/OrSpecification` |
| 疑似原因 | [FACT][E-AU-009-003/014] 排除定义、barrel、同词普通变量/类型后，前六组没有仓内生产caller；Specification只有Commerce foundation兼容re-export而无下游生产caller |
| 保留证据 | 全部仍经private workspace包`@shop/kernel`根入口公开；分别保存值校验、分页/result/版本/规格组合语义，外部workspace或历史制品消费者未排除；Specification还有明确兼容转发 |
| 未排除项 | 仓外源码与已发布制品、动态包消费、类型级别别名、历史回滚、后续identity/member/API模块、正式deprecated周期和可验证等价替代 |
| 可否独立删除 | 否；只满足“仓内静态生产caller不足”，不满足G3的公共API、兼容、等价替代、行为不变、验证/恢复和第二次复核条件 |
| 二次复核 | G1不强制；逐符号证据见AU-009 `dead-code-symbols.csv`，不得把整组机械删除 |

## DC-0012｜`@shop/authz` 完整 `decide` façade 与 Decision 公共模型

| 字段 | 记录 |
| --- | --- |
| 分类 | G1：疑似闲置，但证据不足 |
| 对象 | `packages/authz/src/Policy.ts:20-28` 的 `decide`、`DecisionContext`，以及 `Decision.ts` 的完整结果模型 |
| 疑似原因 | [FACT][E-AU-010-003/013] 排除定义、barrel和测试后，固定仓库没有生产调用`decide`；真实Commerce `AccessPipeline`分别调用`precheck/checkScope/checkAssurance`以插入外部门禁 |
| 保留证据 | `decide`仍经private workspace包根入口公开，并由包测试和security test调用；它保存唯一的一次性纯判定顺序、稳定deny reason和allow evidence契约。仓外源码/历史制品消费者未排除 |
| 当前问题 | 分阶段函数有隐藏前置条件，AccessOperations误用已形成F-0054；这反而证明完整façade仍有防止漏阶段的契约价值，不能把实现分层直接视为等价替代 |
| 未排除项 | 仓外调用、动态package消费、历史兼容、是否计划让AccessPipeline复用完整façade、与`@smart-wing/authz`不同模型的正式收敛方案 |
| 可否独立删除 | 否；公共API、测试唯一规格、等价替代、兼容、可观察行为、恢复方法和第二次复核均未满足 |
| 二次复核 | G1不强制；升级G2前先完成AU-011并由架构所有者定稿两套Authz关系，不能凭同名`decide`认定等价 |

## DC-0013｜当前无正式运行单元的 Smart Wing Authz 兼容包

| 字段 | 记录 |
| --- | --- |
| 分类 | G1：疑似闲置，但证据不足 |
| 对象 | `01_core_hexin/packages/smart-wing-authz/` 全部4文件 |
| 疑似原因 | [FACT][E-AU-011-004] 当前Storefront Worker只加载public router，delivery禁止旧`commerce-api/dist/admin-server.cjs`，deployment checker把Commerce API列为retired；未找到正式protected runtime target |
| 保留证据 | 两个Commerce API源码文件直接import`decide`，13个路由经wrapper消费；包仍有公共export、手工compat build、独立数据库模型和13个唯一直接测试规格 |
| 未排除项 | 仓外workspace消费者、历史主机/制品、`public.*`权限数据与迁移/回滚职责、86条permission契约的正式承接计划 |
| 可否独立删除 | 否；静态/配置/构建/历史兼容/唯一契约/等价替代/可观察行为/恢复方法及第二次复核均未满足G3条件 |
| 二次复核 | 未执行；G1不强制。升级G2/G3前须独立重追运行入口和数据责任 |

## DC-0014｜无代码消费者且证据断裂的多端交付矩阵

| 字段 | 记录 |
| --- | --- |
| 分类 | G2：高度疑似无用，需要运行或人工复核 |
| 对象 | `01_core_hexin/packages/api-contract/src/delivery-matrix.json` |
| 疑似原因 | [FACT][E-AU-012-005/006/007] 全仓无代码引用、package未导出、正式`check:delivery`读取另一套文件；七条evidence中四条微信路径不存在 |
| 保留证据 | 文件保存五项多端能力的唯一逐平台状态，项目文档仍称其为机器可读现状；仓外发布/验收系统是否直接读取尚未确认 |
| 当前问题 | 三项`releaseReady:true`建立在不存在的微信实现路径上，见F-0063；这证明内容漂移，不证明状态责任已经被完整承接 |
| 未排除项 | 仓外CI、人工验收、历史发布、产品状态来源、替代文件是否语义完整、恢复方法 |
| 可否独立删除 | 否；公共文档契约、等价替代、可观察发布行为和第二次复核均未满足G3 |
| 二次复核 | RV-0010待产品/发布流程复核；若无法证明承接，保持G2或降G1 |

## DC-0015｜零仓内源消费者的平台 Adapter 与部分响应类型

| 字段 | 记录 |
| --- | --- |
| 分类 | G1：疑似闲置，但证据不足 |
| 对象 | `packages/api-contract/src/platform.ts`的15个adapter/async类型与运行平台常量，以及`memberCode.ts`、`commerce.ts`中零仓内消费者的响应类型 |
| 疑似原因 | [FACT][E-AU-012-003] 排除定义和本包测试后，固定仓库没有包外源码import这些类型或platform常量 |
| 保留证据 | 全部从private package公共入口导出；platform注释和多端标准明确把HarmonyOS/iOS/Android作为预留兼容面；仓外消费者未排除 |
| 当前问题 | 当前小程序实现没有采用这些adapter，delivery matrix也已漂移；但“尚未实现”不是“已正式下线” |
| 未排除项 | 仓外类型消费者、未来客户端计划、契约版本承诺、等价adapter体系、恢复方法 |
| 可否独立删除 | 否；公共API、正式退役、等价替代和第二次复核均不足 |
| 二次复核 | G1不强制；产品取消相关平台或兼容包退役时再专项复核 |

## 2. G3 条件对账

## DC-0016｜正式发布入口缺失的客户端错误链

| 字段 | 记录 |
| --- | --- |
| 分类 | G1：疑似闲置，但证据不足 |
| 对象 | `ObservabilityModule`、`ClientErrorOperations`及`ClientErrorBuffer`运行链 |
| 疑似原因 | [FACT][E-AU-013-006] 两个Operation只随完整ApiMain注册，而该发布路径被正式deployment checker禁止；专用入口没有该模块 |
| 保留证据 | operations/capabilities、OpenAPI、SDK和唯一错误聚合/Scope读取契约仍在；仓外或历史完整ApiMain未排除 |
| 可否独立删除 | 否；公共API、正式退役、仓外运行、唯一行为和恢复方法均未满足G3 |
| 二次复核 | RV-0012发布/产品专项；不得凭零正式target删除 |

## DC-0017｜零仓内生产调用的平台Adapter与Tracer公共面

| 字段 | 记录 |
| --- | --- |
| 分类 | G1：疑似闲置，但证据不足 |
| 对象 | `browserTelemetry`、`miniappTelemetry`及独立Tracer公共接口 |
| 疑似原因 | [FACT][E-AU-013-003] 固定仓库无生产源码调用两个平台adapter，也没有独立Tracer消费者 |
| 保留证据 | private workspace根barrel公开、跨平台设计职责明确、createTelemetry内部仍构造Tracer；仓外消费者未知 |
| 可否独立删除 | 否；公共API、等价替代、正式下线和第二次复核均不足 |
| 二次复核 | G1不强制；平台能力正式退役时再专项复核 |

## DC-0018｜除DatabaseHarness外零仓内消费者的root测试工具

| 字段 | 记录 |
| --- | --- |
| 分类 | G1：疑似闲置，但证据不足 |
| 对象 | Event/Http/Provider Harness、TestClock、TestContainer、TestIdGenerator |
| 疑似原因 | [FACT][E-AU-014-003] 固定仓库唯一包外import只使用DatabaseHarness |
| 保留证据 | 全部经private package root公开；保存测试端口与fixture行为；仓外测试未知，TestIdGenerator问题也证明它仍有独立契约而非可直接删除 |
| 可否独立删除 | 否；公共API、仓外消费、唯一测试规格、正式下线与第二次复核均不足 |

## DC-0019｜只被包内自测消费的browser测试工具

| 字段 | 记录 |
| --- | --- |
| 分类 | G1：疑似闲置，但证据不足 |
| 对象 | `@shop/testing/browser` 全部A11y/MSW/Query/Render/Router/User工具 |
| 疑似原因 | 固定仓库没有包外subpath import；只有Browser.test内部使用 |
| 保留证据 | package公开subpath，直接测试证明组合职责；仓外测试和计划迁移未排除 |
| 可否独立删除 | 否；零引用只满足G3条件之一，等价替代、契约退役和恢复方法均未知 |

## DC-0020｜零运行消费者的旧 `@smart-wing/design-system` 包

| 字段 | 记录 |
| --- | --- |
| 分类 | G2：高度疑似无用，需要运行或人工复核 |
| 对象 | `01_core_hexin/packages/design-system/` 全部8文件 |
| 疑似原因 | [FACT][E-AU-016-003/006] 固定仓库无源码/CSS/脚本/config消费者；Storefront仅保留package/lock依赖；canonical design有完整替代面，3个SVG还字节相同 |
| 保留证据 | package公开4类subpath；Storefront依赖边仍在；wing-code资产和token内容与canonical不同；仓外工具和视觉回归未排除 |
| 当前问题 | 旧generated CSS无法由现行脚本验证/重生，见F-0075；内容漂移支持G2，不证明可观察行为为零 |
| 可否独立删除 | 否；公共API、构建/锁依赖、仓外消费、视觉验证、恢复方法和第二次独立复核均未满足G3 |
| 二次复核 | 升级G3前必须从Storefront build、仓外包消费和真实页面视觉重新追踪 |

上述G0、G1、G2和GX项均不满足“无公共/事件契约、无数据责任、存在等价替代、删除不改变可观察行为、已完成第二次复核”等条件。AU-016未对任何文件提出删除、归档或移动建议。

## DC-0021｜Canonical Design 无生产消费者的公共组件与工具面

| 字段 | 记录 |
| --- | --- |
| 等级 | G1 |
| 对象 | AppBoundary、Bootstrap、Brand、Divider、Icon/IconButton、design QueryState、RecordTable、RouteFallback、Status、Table、Theme、WorkspaceShell、WorkspaceMetrics等公开符号/文件 |
| 疑似原因 | [FACT][E-AU-017-012] 固定仓库生产源码无import/调用；仅包内test、Story或零调用。Console使用自己的QueryState、shell和指标实现 |
| 保留证据 | 全部从public root导出，部分有Story/测试或brand subpath；仓外消费者、迁移计划、唯一交互/视觉契约未排除 |
| 当前问题 | 同包存在真实活跃组件，不能按文件夹整体推断；Brand另有F-0080，Status类名与现有CSS不一致但当前零生产调用 |
| 可否独立删除 | 否；静态/动态仓外消费、公共兼容、Story/测试规格、构建与视觉回归、等价替代和二次复核未满足 |
| 二次复核 | G1不强制；任何升级必须按单符号重新追入口，不能把本组一次性升级G3 |

## DC-0022｜`mobile-platforms.json` 未接线的平台规则字段

| 字段 | 记录 |
| --- | --- |
| 等级 | G1 |
| 对象 | `wechatMiniProgram`、`sizeClasses`、`overflowRules`、`tabletPrinciple`、`tabletRules` |
| 疑似原因 | [FACT][E-AU-017-010] 固定仓库运行代码与生成器零字段消费；miniapp生成器不读取该文件 |
| 保留证据 | 同文件iOS/Android字段有web生成职责；未接线字段保存唯一跨端VI规则，未来平台实现、设计文档责任和Ethan取舍未知 |
| 当前问题 | F-0081说明规格与运行脱节，不等于规格无价值或正式下线 |
| 可否独立删除 | 否；无等价来源、无正式下线、无视觉/设备验证、无恢复设计和二次复核 |
| 二次复核 | 若未来升级G2/G3，必须由跨端专项同时核对miniapp、平板和视觉基线 |

AU-017没有G2/G3新增项；零生产引用只进入G1。没有删除、归档或移动任何文件。

## DC-0023｜Miniapp 除Environment外的7个无运行调用生成输出

| 字段 | 记录 |
| --- | --- |
| 等级 | G1 |
| 对象 | CachePolicy、RuntimeLimits、experience、deeplink、tokens.wxss、brandmark.svg、wingcode.svg |
| 疑似原因 | [FACT][E-AU-018-004] 当前9文件片段内无require/import/WXML/WXSS入口；没有app.json/pages/app.wxss/API/actions。唯一生成运行调用是app.js→Environment |
| 保留证据 | 四条正式生成链、generated check、release candidate复制和机器契约仍引用这些输出；可能是外部完整工程同步源，且保存唯一平台契约/资产 |
| 当前问题 | F-0006说明片段拓扑冲突；F-0082说明Experience parity漂移；这些问题不能反向证明文件可删除 |
| 可否独立删除 | 否；外部消费、发布责任、正式下线、可观察行为、恢复方法和二次复核均未满足 |
| 二次复核 | 升级G2/G3前必须确认唯一小程序仓库/线上版本，并逐文件复核生成和candidate入口 |

AU-018没有G2/G3项，也没有删除、归档、移动或重生任何Miniapp文件。
## GX-0002｜Auth owner-approved旧登录实现族

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除，需产品与架构专项 |
| 对象 | `auth-web/src/screens/LoginPage.tsx`、`src/services/auth.ts`及其只为该链服务的兼容行为 |
| 疑似原因 | [FACT][E-AU-019-008] 当前App只import ConsumerIdentityPage/OperatorIdentityPage；LoginPage与auth.ts仅互相引用或被测试引用 |
| 保留证据 | owner-approved-ui仍指定LoginPage；它保存唯一三段式、多身份、top-level credential POST、旧注册与未接通step-up可见契约 |
| 运行结论 | 当前源码入口不可达与机器批准清单冲突（F-0005）；不能自行判定应恢复哪套或哪套可删 |
| 数据/契约责任 | 保存历史兼容BFF端点、旧UI交互与业务说明；删除可能消灭唯一规格，恢复则可能替换现行页面 |
| 可否删除 | 禁止；需Ethan先裁定现行批准UI，再做仓外/线上/契约和第二次独立复核 |
| 二次复核 | 是；产品裁定后重新检查App、owner-approved、bundle、BFF和视觉 |

## DC-0024｜Auth未接入现行页面的辅助能力

| 字段 | 记录 |
| --- | --- |
| 分类 | G1：疑似闲置，证据不足 |
| 对象 | `registrationPresentation`、`useSmsResendCountdown`/otpPolicy、consumerFacade、`automaticRegistrationPassword`及originPolicy导出 |
| 疑似原因 | [FACT][E-AU-019-008/012] 固定仓库无现行生产caller，或只被GX-0002旧链/自身测试调用 |
| 保留证据 | 各对象保存邀请文案、重发时钟、同源accounts挂载、密码生成和origin allowlist等唯一行为；部分仍是测试/潜在兼容API |
| 未排除项 | owner-approved旧UI去向、仓外消费者、同源/login挂载和未来页面收敛 |
| 可否删除 | 否；未确认正式下线、等价替代和无可观察行为 |
| 二次复核 | G1不强制；升级G2/G3前按符号逐一复核 |

## DC-0025｜Auth旧品牌静态资产

| 字段 | 记录 |
| --- | --- |
| 分类 | G1：疑似闲置，证据不足 |
| 对象 | `brand-lockup-horizontal.svg`、`brand-mark.svg`、`wing-code-symbol.svg`、`wing-pattern.svg` |
| 疑似原因 | [FACT] 当前Consumer/Operator入口不用这些public资产；brand-mark只由GX-0002 LoginPage引用，其余固定源码零引用 |
| 保留证据 | 品牌历史与owner-approved旧页面尚未裁定；仓外静态URL、缓存和设计交付消费者未排除 |
| 未排除项 | 线上旧HTML/缓存、外部引用、视觉回滚、品牌迁移 |
| 可否删除 | 否；必须视觉/网络/发布和第二次复核后才可能升级 |
| 二次复核 | G1不强制 |

## 20. AU-020 微信支付候选复核

- 18个文件均有包入口、生产调用、测试、配置或构建职责；没有仅凭零静态引用即可成立的删除对象。
- `notifyUrl` override虽形成F-0093契约边界问题，但仍被当前生产Gateway使用，不能列垃圾代码候选。
- 本AU新增G0/G1/G2/G3/GX均为0；累计G0 2、G1 21、G2 2、G3 0、GX 2。

## DC-0026｜Provider Core旧Webhook ingress包装器及转发导出

| 字段 | 记录 |
| --- | --- |
| 分类 | G1：疑似闲置，证据不足 |
| 对象 | `extensions/providers/core/src/Webhook.ts`及多个`providers/*/Webhook.ts`改名转发 |
| 疑似原因 | [FACT][E-AU-021-007/008] 固定源码只由Provider.test实例化；生产factory、Loader、Registry和Channel route使用PortFactory的另一套ProviderWebhookVerifier |
| 保留证据 | core barrel与多个provider package公共导出仍保存API；测试是其唯一行为规格；仓外consumer未排除 |
| 未排除项 | 仓外插件、历史集成、迁移/回滚用途、provider包API兼容承诺 |
| 可否删除 | 否；没有满足无公共API、无契约、无历史兼容责任和第二次复核条件 |
| 二次复核 | G1不强制；若拟删除必须升级专项并与F-0095测试迁移分开 |

## 21. AU-021 Provider Core候选复核

- 新增DC-0026/G1；没有G2、G3或GX新增项。
- 当前累计G0 2、G1 22、G2 2、G3 0、GX 2。公共barrel和仓外consumer未排除前不得升级删除结论。

## DC-0027｜HeaderAuthenticator公共认证器

| 字段 | 记录 |
| --- | --- |
| 分类 | G1：疑似闲置，证据不足 |
| 对象 | `extensions/vendors/core/src/Auth.ts`的`HeaderAuthenticator`及barrel导出 |
| 疑似原因 | [FACT][E-AU-022-012] 固定仓库内只在Vendor Core与Provider Core测试中构造；真实vendor factory使用HMAC或RSA认证器 |
| 保留证据 | `@shop/vendorcore`公共barrel仍导出该类型；仓外插件/测试工具、历史兼容和未来vendor协议未排除 |
| 未排除项 | npm/workspace外部consumer、动态插件、回滚版本和简单header协议职责 |
| 可否删除 | 否；不满足无公共API、无契约责任、正式下线和第二次复核条件 |
| 二次复核 | G1不强制；拟删除时需重新核对包消费者与发布制品 |

## 22. AU-022 Vendor Core候选复核

- 新增DC-0027/G1；没有G2、G3或GX新增项。
- 当前累计G0 2、G1 23、G2 2、G3 0、GX 2。未修改或删除任何实现。

## DC-0028｜Cakeuncle被禁用的Webhook与H5/Card签名协议族

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除，需专项设计 |
| 对象 | `vendors/cakeuncle/Webhook.ts`、`Signer.ts`中的H5/Card签名及对应测试 |
| 疑似原因 | [FACT][E-AU-023-008/009] Webhook未从barrel导出且只被测试引用；H5/Card签名无仓内生产caller |
| 保留证据 | README记录payload未签、unsigned callback、HTTP endpoint及加密契约不完整等禁用原因；代码和测试保存唯一协议向量与风险事实 |
| 当前问题 | Foodvoucher生产factory另行暴露通用写入/Webhook，形成F-0100；删除这里会消灭核对冲突所需证据，直接启用则可能接受被改payload |
| 可否独立删除 | 禁止；没有排除仓外兼容、供应商协议、回滚和唯一业务契约责任 |
| 二次复核 | 是，RV-0017；GX必须重新检查调用链和运行入口 |

## DC-0029｜Cakeuncle零仓内caller的公共别名与endpoint常量

| 字段 | 记录 |
| --- | --- |
| 分类 | G1：疑似闲置，证据不足 |
| 对象 | `CakeuncleRatePolicy`、`CakeuncleCircuitPolicy`、`CakeuncleSigner`、`CAKEUNCLE_VOUCHER_ENDPOINTS`、`CAKEUNCLE_MEAL_COMMON_ENDPOINTS` |
| 疑似原因 | [FACT][E-AU-023-009] 固定仓库无生产或测试caller（定义/导出除外） |
| 保留证据 | 全部仍由package公共barrel导出；供应商扩展、仓外consumer、兼容与未来启用能力未排除 |
| 当前问题 | 转发与未消费常量增加公共表面积，但不是无责任证明 |
| 可否删除 | 否；不满足无公共API、正式下线、等价替代和第二次复核条件 |
| 二次复核 | G1不强制；拟删除时需逐符号复核仓外制品和版本兼容 |

## 23. AU-023 Cakeuncle Vendor候选复核

- 新增DC-0028/GX与DC-0029/G1；没有G2或G3新增项。
- 当前累计G0 2、G1 24、G2 2、G3 0、GX 3。未修改、删除、导出或注册任何候选实现。

## DC-0030｜Foodvoucher ErrorMap公共导出

| 字段 | 记录 |
| --- | --- |
| 分类 | G1：疑似闲置，证据不足 |
| 对象 | `extensions/providers/foodvoucher/ErrorMap.ts`的`mapFoodvoucherError`及index导出 |
| 疑似原因 | [FACT][E-AU-024-010] 固定仓库除定义和barrel外零caller；Provider调用链也没有使用该映射 |
| 保留证据 | package公共API仍导出；仓外consumer、历史错误码兼容、未来Foodvoucher专项实现未排除 |
| 当前问题 | 每provider前缀ErrorMap模式与真实错误传播脱节，但删除会改变公共表面 |
| 可否删除 | 否；没有满足无公共API、无兼容职责、正式下线和第二次复核条件 |
| 二次复核 | G1不强制；拟删除时应与全部provider ErrorMap统一专项复核 |

## 24. AU-024 Foodvoucher Provider候选复核

- 新增DC-0030/G1；FoodvoucherWebhook已属于DC-0026，不重复计数。
- 当前累计G0 2、G1 25、G2 2、G3 0、GX 3；没有G3，未删除或移动文件。

## DC-0031｜Cake未接线OrderRequest

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除，需专项设计 |
| 对象 | `providers/cake/OrderRequest.ts`及测试 |
| 疑似原因 | 仅测试直接引用，未由barrel导出，Provider无Order capability/port |
| 保留证据 | 保存唯一收货、排期、门店、并行数组、金额和附加项请求契约；README明确当前履约输入不足 |
| 可否删除 | 否；无正式下线、等价规格、运行/恢复验证和二次复核 |
| 二次复核 | 是，RV-0019；禁止直接启用或删除 |

## DC-0032｜Cake ErrorMap公共导出

| 字段 | 记录 |
| --- | --- |
| 分类 | G1 |
| 对象 | `mapCakeError` |
| 疑似原因 | 固定仓库零caller |
| 保留证据 | package公共导出，仓外兼容与未来适配未知 |
| 可否删除 | 否 |
| 二次复核 | 升级删除结论时需要 |

## 25. AU-025 Cake Provider候选复核

- 新增DC-0031/GX、DC-0032/G1；CakeWebhook已在DC-0026覆盖。
- 累计G0 2、G1 26、G2 2、G3 0、GX 4；未删除任何文件。

## DC-0033｜Flower ErrorMap公共导出

| 字段 | 记录 |
| --- | --- |
| 分类 | G1 |
| 对象 | `providers/flower/ErrorMap.ts`的`mapFlowerError` |
| 疑似原因 | 固定仓库全局检索零caller |
| 保留证据 | package通过barrel公共导出；仓外消费者、兼容责任和未来适配未知 |
| 可否删除 | 否；未满足无公共API、正式下线、行为不变和第二次复核条件 |
| 二次复核 | G1不强制；升级删除结论时需要 |

## 26. AU-026 Flower Provider候选复核

- 新增DC-0033/G1；FlowerWebhook继续由DC-0026覆盖，不重复计数。
- 累计G0 2、G1 27、G2 2、G3 0、GX 4；没有G3，未删除任何文件。

## DC-0034｜Meal未接线OrderDraft

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除，需专项设计 |
| 对象 | `providers/meal/OrderDraft.ts`及对应测试 |
| 疑似原因 | 仅测试直接引用，未由barrel导出，Provider无Order capability/port |
| 保留证据 | 保存七品牌商品字段、门店、手机号、模型和非幂等下单endpoint契约；注释明确等待运行时幂等与订单重查 |
| 可否删除 | 否；没有正式下线、等价规格、运行/恢复验证和二次复核 |
| 二次复核 | 是，RV-0020；禁止直接启用或删除 |

## DC-0035｜Meal公共兼容导出零caller

| 字段 | 记录 |
| --- | --- |
| 分类 | G1 |
| 对象 | `mapMealError`与`MEAL_BRAND_NAMES` |
| 疑似原因 | 固定仓库全局检索零caller |
| 保留证据 | package barrel公共导出；仓外消费者、展示语义和未来适配未知 |
| 可否删除 | 否；未满足无公共API、正式下线、行为不变和第二次复核条件 |
| 二次复核 | G1不强制；升级删除结论时需要 |

## 27. AU-027 Meal Provider候选复核

- 新增DC-0034/GX、DC-0035/G1；MealWebhook继续由DC-0026覆盖，不重复计数。
- 累计G0 2、G1 28、G2 2、G3 0、GX 5；没有G3，未删除任何文件。

## DC-0036｜Book ErrorMap公共导出

| 字段 | 记录 |
| --- | --- |
| 分类 | G1 |
| 对象 | `providers/book/ErrorMap.ts`的`mapBookError` |
| 疑似原因 | 固定仓库全局检索零caller |
| 保留证据 | package barrel公共导出；仓外消费者和兼容责任未知 |
| 可否删除 | 否；未满足无公共API、正式下线、行为不变和第二次复核条件 |
| 二次复核 | G1不强制；升级删除结论时需要 |

## 28. AU-028 Book Provider候选复核

- 新增DC-0036/G1；BookWebhook继续由DC-0026覆盖，不重复计数。
- 累计G0 2、G1 29、G2 2、G3 0、GX 5；没有G3，未删除任何文件。

## DC-0037｜Directcharge ErrorMap公共导出

| 字段 | 记录 |
| --- | --- |
| 分类 | G1 |
| 对象 | `providers/directcharge/ErrorMap.ts`的`mapDirectchargeError` |
| 疑似原因 | 固定仓库全局检索零caller |
| 保留证据 | package barrel公共导出；仓外消费者和兼容责任未知 |
| 可否删除 | 否；未满足无公共API、正式下线、行为不变和第二次复核条件 |
| 二次复核 | G1不强制；升级删除结论时需要 |

## 29. AU-029 Directcharge Provider候选复核

- 新增DC-0037/G1；DirectchargeWebhook继续由DC-0026覆盖，不重复计数。
- 累计G0 2、G1 30、G2 2、G3 0、GX 5；没有G3，未删除任何文件。

## DC-0038｜Jdfresh ErrorMap公共导出

| 字段 | 记录 |
| --- | --- |
| 分类/对象 | G1；`mapJdfreshError` |
| 证据 | 固定仓库零caller，但package barrel公共导出，仓外兼容未知 |
| 可否删除 | 否；不满足公共API、正式下线、行为不变和二次复核条件 |

## 30. AU-030 Jdfresh候选复核

- 新增DC-0038/G1；JdfreshWebhook由DC-0026覆盖。
- 累计G0 2、G1 31、G2 2、G3 0、GX 5；未删除文件。

## DC-0039｜Jdproduct ErrorMap公共导出

| 字段 | 记录 |
| --- | --- |
| 分类/对象 | G1；`01_core_hexin/extensions/providers/jdproduct/ErrorMap.ts`的`mapJdproductError` |
| 证据 | 固定仓库检索零caller，但package barrel公共导出，仓外兼容/替代消费者未排除 |
| 可否删除 | 否；不满足无公共API、正式下线、行为不变和二次复核条件 |
| 二次复核 | G1不强制；升级到G2/G3前必须按符号逐一核对仓外消费者与兼容路径 |

## 31. AU-031 Jdproduct候选复核

- 新增DC-0039/G1；`mapJdproductError`无固定仓内调用，`manifest/Return`与operations口径不一致仍需单独修复候选而非删除。
- 累计G0 2、G1 32、G2 2、G3 0、GX 5；未删除任何文件。

## DC-0040｜Private 错误映射函数零caller

| 分类/对象 | G1；`01_core_hexin/extensions/providers/private/ErrorMap.ts`的`mapPrivateError` |
| --- | --- |
| 证据 | 固定仓内检索零caller，package barrel公开导出，仓外兼容与替代路径未排除。 |
| 可否删除 | 否；不满足公共API排查、正式退役、行为不变和第二次复核条件。 |
| 二次复核 | G1不强制；拟删除前需与其它provider error-map专项复核。 |

## 32. AU-033 私有provider候选复核

- 新增DC-0040/G1；`mapPrivateError`无仓内直接caller，因 `Provider` 与 `registry` 尚保有运行契约链路未判删。
- 累计G0 2、G1 33、G2 2、G3 0、GX 5；未删除任何文件。

## DC-0041｜Tmallmarket 错误映射函数零caller

| 分类/对象 | G1；`01_core_hexin/extensions/providers/tmallmarket/ErrorMap.ts`的`mapTmallmarketError` |
| --- | --- |
| 证据 | 固定仓内检索零caller，package barrel公开导出，仓外兼容与替代路径未排除。 |
| 可否删除 | 否；不满足公共API排查、正式退役、行为不变和第二次复核条件。 |
| 二次复核 | G1不强制；拟删除前需与provider error-map专项复核。 |

## 33. AU-034 Tmallmarket候选复核

- 新增DC-0041/G1；`mapTmallmarketError`无仓内直接caller，需先确认仓外兼容与错误封装承接后再考虑删除。
- 累计G0 2、G1 34、G2 2、G3 0、GX 5；未删除任何文件。

## DC-0042｜Tmall vendor adapter 转发导出零caller

| 分类/对象 | G1；`01_core_hexin/extensions/vendors/tmall/Signer.ts`、`RatePolicy.ts`、`CircuitPolicy.ts` |
| --- | --- |
| 证据 | 固定仓内检索零caller，`index.ts` 仅作包级导出。 |
| 可否删除 | 否；package 公共出口与潜在外部兼容路径未排除，尚未形成正式下线边界。 |
| 二次复核 | G1不强制；拟删除前需确认包外消费者与兼容声明。 |

## 34. AU-035 Tmall vendor候选复核

- 新增DC-0042/G1；该三项转发符号未见仓内生产/测试直接使用，需先核实外部兼容路径。
- 累计G0 2、G1 35、G2 2、G3 0、GX 5；未删除任何文件。

## DC-0043｜JD vendor adapter 转发导出零caller

| 分类/对象 | G1；`01_core_hexin/extensions/vendors/jd/Signer.ts`、`RatePolicy.ts`、`CircuitPolicy.ts` |
| --- | --- |
| 证据 | 固定仓内检索到该三项零直接 caller；`index.ts` 仅作包级导出。 |
| 可否删除 | 否；package 公共出口与潜在外部兼容路径未排除，且该三项承接 vendorcore 到运行时导出的一致性。 |
| 二次复核 | G1不强制；拟删除前需确认包外消费者与兼容声明。 |

## 35. AU-036 JD vendor候选复核

- 新增DC-0043/G1；该三项转发符号未见仓内生产/测试直接使用，需先核实外部兼容路径。
- 累计G0 2、G1 36、G2 2、G3 0、GX 5；未删除任何文件。

## DC-0044｜Wanlian vendor adapter 转发导出零caller

| 分类/对象 | G1；`01_core_hexin/extensions/vendors/wanlian/Signer.ts`、`RatePolicy.ts`、`CircuitPolicy.ts` |
| --- | --- |
| 证据 | 固定仓内检索到该三项零直接 caller；`index.ts` 仅作包级导出。 |
| 可否删除 | 否；package 公共出口与潜在外部兼容路径未排除，且该三项承接 vendorcore 到运行时导出的一致性。 |
| 二次复核 | G1不强制；拟删除前需确认包外消费者与兼容声明。 |

## 36. AU-037 Wanlian vendor候选复核

- 新增DC-0044/G1；该三项转发符号未见仓内生产/测试直接使用，需先核实外部兼容路径。
- 累计G0 2、G1 37、G2 2、G3 0、GX 5；未删除任何文件。

## DC-0045｜Wenxuan vendor adapter 转发导出零caller

| 分类/对象 | G1；`01_core_hexin/extensions/vendors/wenxuan/Signer.ts`、`RatePolicy.ts`、`CircuitPolicy.ts` |
| --- | --- |
| 证据 | 固定仓内检索到该三项零直接 caller；`index.ts` 仅作包级导出。 |
| 可否删除 | 否；package 公共出口与潜在外部兼容路径未排除，且该三项承接 vendorcore 到运行时导出的一致性。 |
| 二次复核 | G1不强制；拟删除前需确认包外消费者与兼容声明。 |

## 37. AU-038 Wenxuan vendor候选复核

- 新增DC-0045/G1；该三项转发符号未见仓内生产/测试直接使用，需先核实外部兼容路径。
- 累计G0 2、G1 38、G2 2、G3 0、GX 5；未删除任何文件。

## 139. AU-139 Catalog compatibility 复核

- `modules/catalog/{CatalogModule,CatalogOperations,CatalogProvisioningPort,CatalogReadOperations,CatalogSourcePort,IdentityOperatorCatalogModule,index}.ts` 与 `interface/job/CatalogImportJob.ts` 均为已审实现的转发入口，且后者有主 jobs catalog 直接 runtime import。
- 全部归类 G0：现有公共/兼容职责成立；不因文件自身无业务分支或局部零 caller 形成删除候选。累计 G0 10、G1 38、G2 2、G3 0、GX 5；未删除任何文件。

## 144. AU-144 Voucher compatibility 复核

- 13 个 Voucher re-export 保留旧分层 import；根 `VoucherPort.ts` 还提供默认 FinancePort 组装，且由 Checkout、Order、Payment、Verification 与测试直接或经 public entry 消费。
- 全部归类 G0：具有明确兼容/运行职责，不是删除候选。累计 G0 24、G1 38、G2 2、G3 0、GX 5；未删除任何文件。

## 146. AU-146 Provisioning compatibility 复核

- 八个 Provisioning legacy/root export 保持旧 import；public index 是稳定 port/domain surface，主应用与独立 provisioning API 均使用 canonical target。
- 全部归类 G0：具有明确兼容/公共职责，不是删除候选。累计 G0 33、G1 38、G2 2、G3 0、GX 5；未删除任何文件。

## 150. AU-150 Risk compatibility 复核

- 14 个 legacy English-layer re-export 指向已审 canonical 风险实现；其中 `interface/job/RiskReplayJob.ts` 是主 jobs catalog 的实际运行 import。
- 全部归类 G0：兼容或真实运行职责成立。累计 G0 47、G1 38、G2 2、G3 0、GX 5；未删除任何文件。

## 152. AU-152 Inventory compatibility 复核

- 七个 root/legacy export 保持 stable module/public import；两项 legacy job path 由主 jobs catalog 实际运行使用。
- 全部归类 G0：兼容或真实运行职责成立。累计 G0 54、G1 38、G2 2、G3 0、GX 5；未删除任何文件。

## DC-0046｜Reporting 历史一行转发层

| 字段 | 记录 |
| --- | --- |
| 分类/对象 | G1；`modules/reporting/{application/{command/{CreateExport,ProjectEvent},port/ReportingPort,query/{GetDashboard,GetExport,GetSalesReport}},domain/model/{ExportJob,Metric,Projection},infrastructure/persistence/PgReportingRepository,interface/http/ReportingRoutes}.ts` |
| 疑似原因 | 逐项仓内静态检索没有 import 这些 legacy 路径；它们均只 re-export 已审 canonical 实现。 |
| 保留证据 | 动态/字符串加载、发布外 consumer 与历史 import 兼容承诺尚未排除；一行转发不能单独证明可删除。 |
| 可否删除 | 否；未满足公共 API、动态引用和兼容责任的排除条件。 |
| 二次复核 | G1不强制；升级前应独立复核 package consumer 与构建产物。 |

## 157. AU-157 Reporting compatibility 复核

- root Identity/read 入口分别被 IdentityRegistrationApiMain 直接导入；root index 被 finance/order 直接导入；legacy job 路径被 jobs catalog 注册，五项为 G0。
- 其余十项归 DC-0046/G1。累计 G0 59、G1 48、G2 2、G3 0、GX 5；未删除任何文件。

## DC-0047｜Support historical 一行转发层

| 字段 | 记录 |
| --- | --- |
| 分类/对象 | G1；`modules/support/{ConsoleSupportHealth,SupportModule,application/**,domain/**,infrastructure/persistence/PgSupportRepository,interface/http/SupportRoutes}.ts`，共 17 个一行转发文件 |
| 疑似原因 | 仓内静态检索没有 direct import 这些 historical paths；均只 re-export 已深审 canonical 实现。 |
| 保留证据 | package 外 consumer、动态加载与历史 import 兼容责任未排除。 |
| 可否删除 | 否；未满足公共 API、动态引用和兼容责任的排除条件。 |
| 二次复核 | G1不强制；升级前需独立检查发布包 consumer。 |

## 165. AU-165 Support compatibility 复核

- legacy `interface/job/SlaJob.ts` 由 jobs catalog 直接运行，归 G0。
- 其余 17 项归 DC-0047/G1。累计 G0 60、G1 65、G2 2、G3 0、GX 5；未删除任何文件。

## DC-0048｜Commerce API compatibility public auth handlers

| 字段 | 记录 |
| --- | --- |
| 分类/对象 | G1；`services/commerce-api/src/api/{publicRoutes,registrationRoutes,wechatAuthRoutes,stepUpRoutes,securityCenterRoutes}.ts` 内 compatibility auth handler exports及其 credential/demo/limiter/security closure |
| 疑似原因 | 当前 `routeApi` 明确将 `/api/v1/auth/*` 返回404；Storefront Worker实际只调用 `routePublicRequest`，该router只注册health/catalog/payment。 |
| 保留证据 | Auth Web兼容 `LoginPage/auth.ts` 仍调用这些路径；security center路径仍有旧文档、公开导出和direct tests；handlers具有workspace/compat build关系，且WeChat/注册/step-up/安全中心仍有独立RPC契约和仓外历史部署未知项。 |
| 可否删除 | 否；不是“零入口、零契约、零兼容责任”，不满足G3。 |
| 二次复核 | G1不强制；拟删除前需核验正式Auth前端是否已完全迁移及仓外兼容部署。 |

## 171. AU-171 Compatibility public auth 候选复核

- AU-171/AU-175/AU-192：DC-0048/G1覆盖全部compatibility auth handler；缺当前正式路由注册，但保留客户端、文档、测试、公共API与兼容部署未知项；未作删除动作。累计 G0 60、G1 66、G2 2、G3 0、GX 5；未删除任何文件。

## 221. AU-221 Domain primitives 候选复核

- `foundation/domain/Specification.ts`复核后仍为DC-0011/G1：无仓内caller但有`@shop/kernel`及Commerce foundation两层公开兼容责任，未核验外部消费者；不得删除。
- Aggregate、DomainEvent、Entity、Policy、ValueObject与DomainError分别存在静态消费者或领域错误运行职责，归G0。累计候选数量不变；未删除任何文件。

## DC-0049｜旧 Supabase 用户订单读模型

| 字段 | 记录 |
| --- | --- |
| 分类/对象 | G1；`02_platform_pingtai/database/supabase/migrations/20260724101500_order_read_model.sql` 中的 `api_order_views` |
| 疑似原因 | 固定基线未找到仓内调用旧函数；Commerce API 的订单和后台概览已调用后续 `api_order_views_scoped`。 |
| 保留证据 | 旧函数仍获 `service_role` 执行权限，且迁移重放、外部服务、历史制品或直接数据库调用均未排除。 |
| 可否删除 | 否；未满足公共 API、部署/运维调用、历史兼容、可观察行为及独立复核等G3条件。 |
| 二次复核 | G1不强制；拟删除前需复核数据库实际依赖、外部消费者与替代读模型的响应契约。 |

## 331. AU-331 Supabase 订单读模型复核

- 旧用户范围读模型归 DC-0049/G1；后续 scoped 读模型已在当前 API 路由使用，但外部 `service_role` 消费者未被排除。累计 G0 60、G1 67、G2 2、G3 0、GX 5；未删除任何文件。

## DC-0050｜供应商履约最小 PII 读取 RPC

| 字段 | 记录 |
| --- | --- |
| 分类/对象 | G1；`02_platform_pingtai/database/supabase/migrations/20260809094000_supplier_fulfillment_pii_boundary.sql` 中的 `api_supplier_fulfillment` |
| 疑似原因 | 固定基线没有仓内供应商 HTTP 路由、Worker 或脚本调用该 RPC。 |
| 保留证据 | 它是唯一明确按 tenant、supplier 和 sub-order 限制的供应商履约密文快照读取形状；外部履约方、未来供应商入口与历史运行契约未排除。 |
| 可否删除 | 否；未满足外部调用、公共 API、数据责任、可观察行为和第二次复核等G3条件。 |
| 二次复核 | G1不强制；拟删除前须核验供应商部署、外部适配器和履约数据访问契约。 |

## 350. AU-350 供应商履约 PII 边界复核

- PII快照复制触发器、历史回填和非空约束归 G0；最小履约读取 RPC 归 DC-0050/G1。累计 G0 60、G1 68、G2 2、G3 0、GX 5；未删除任何文件。

## DC-0051｜旧媒体域商品封面回写 RPC

| 字段 | 记录 |
| --- | --- |
| 分类/对象 | G1；`02_platform_pingtai/database/supabase/migrations/20260815030000_catalog_media_cover_writeback.sql` 中的 `api_sync_catalog_media_covers(jsonb)` |
| 疑似原因 | 全仓没有应用、Worker、任务或脚本调用；该函数只接受历史 `img.hbbtzn.com` CDN 路径，而当前公开媒体投影只认可 `media.zhudatuan.com` 为规范媒体域。 |
| 保留证据 | 函数仍向 service_role 公开；媒体同步可在仓外运行；迁移 ledger、历史对象、回滚和 Compatibility 替代是否进入同一执行链均未验证。 |
| 可否删除 | 否；未满足运维调用、历史兼容、等价替代、可观察行为、验证与恢复条件。 |
| 二次复核 | G1不强制；升级前必须核对实际数据库函数定义、cover_url 域分布、媒体同步作业与可恢复迁移路径。 |

## 378. AU-378 商品封面回写复核

- 旧媒体域回写 RPC 归 DC-0051/G1；输入完整性和 service-role 边界仍具历史责任。累计 G0 60、G1 69、G2 2、G3 0、GX 5；未删除任何文件。

## DC-0052｜成员入口查询 RPC

| 字段 | 记录 |
| --- | --- |
| 分类/对象 | G1；`02_platform_pingtai/database/supabase/migrations/20260817110000_universal_storefront_access.sql` 中的 `api_member_entrances(text)` |
| 疑似原因 | 固定基线未找到应用、路由、Worker、脚本或测试调用；当前登录候选 RPC 已内嵌 entrances 投影。 |
| 保留证据 | 仍获 service_role 执行权限；仓外成员入口选择器、运维查询与历史客户端兼容未被排除。 |
| 可否删除 | 否；未满足公共 API、外部消费者、可观察行为、等价替代和恢复条件。 |
| 二次复核 | G1不强制；升级前应核验已发布客户端、服务端调用和实际数据库依赖。 |

## 383. AU-383 通用 Storefront 访问复核

- 管理员创建最小 Storefront membership 的触发器、回填和本地登录候选归 G0；入口查询 RPC 归 DC-0052/G1。累计 G0 60、G1 70、G2 2、G3 0、GX 5；未删除任何文件。

## DC-0053｜未接线 TOTP 管理员 MFA 链

| 字段 | 记录 |
| --- | --- |
| 分类/对象 | G1；`02_platform_pingtai/database/supabase/migrations/20260817113000_admin_mfa_step_up.sql` 的 factor/challenge 表与 `api_admin_step_up_{start,verification_material,record_failure,complete}`。 |
| 疑似原因 | 当前 Commerce API 二次验证只调用 password step-up 与 `api_record_step_up`；固定基线没有 TOTP HTTP 路由、Worker 或运维脚本调用。 |
| 保留证据 | service_role 仍可执行，数据库契约测试仍直接覆盖 start RPC；已发布后台、MFA 设备密钥、历史会话和产品策略均未排除。 |
| 可否删除 | 否；未满足外部调用、密钥数据责任、正式退役、等价替代、验证和恢复条件。 |
| 二次复核 | G1不强制；拟退役前须独立核验生产 MFA 使用情况、密钥轮换/恢复流程与后台入口。 |

## 384. AU-384 管理员 MFA 二次验证复核

- TOTP MFA 运行链归 DC-0053/G1；当前 password step-up 和 F-0235 保持既有结论。累计 G0 60、G1 71、G2 2、G3 0、GX 5；未删除任何文件。

## DC-0054｜登录候选 entrances.runtime 子投影

| 字段 | 记录 |
| --- | --- |
| 分类/对象 | G1；`api_local_login_candidate` 返回的每 entrance `runtime` JSON 子投影。 |
| 疑似原因 | 当前 Commerce API 仅读取 entrances 数量，随后重新调用 runtime RPC；固定基线未找到该子字段的应用读取者。 |
| 保留证据 | 候选 RPC 向 service_role 公开；仓外认证服务或已发布客户端可能解析该公共响应，且其响应兼容尚未核验。 |
| 可否删除 | 否；未满足公共 API、外部消费者、等价替代、验证和恢复条件。 |
| 二次复核 | G1不强制；任何响应收缩前须独立检查服务端/客户端消费者。 |

## 385. AU-385 登录运行时快速路径复核

- 候选 RPC 主体归 G0；未消费 runtime 子投影归 DC-0054/G1，同时记录 F-0240/P3。累计 G0 60、G1 72、G2 2、G3 0、GX 5；未删除任何文件。

## DC-0055｜可选登录成员身份列表 RPC

| 字段 | 记录 |
| --- | --- |
| 分类/对象 | G1；`api_list_login_memberships(text)`，包括后续 distributor-anchor 过滤版本。 |
| 疑似原因 | 当前 Commerce API 与 Auth Web 在多入口时 fail-closed，未注册选择 token 或列表读取路径；仓内没有 RPC 调用。 |
| 保留证据 | service_role 公共 RPC、身份选择 UI/协议的未完成契约、外部认证服务和已发布客户端均未排除。 |
| 可否删除 | 否；未满足公共 API、外部消费者、正式下线、等价替代和恢复条件。 |
| 二次复核 | G1不强制；若实现或下线选择流程，需先核验服务端选择 token 与所有客户端。 |

## 388. AU-388 可选登录成员身份复核

- 可选身份列表归 DC-0055/G1；多入口登录的当前拒绝行为是明确的 fail-closed 运行契约。累计 G0 60、G1 73、G2 2、G3 0、GX 5；未删除任何文件。

## DC-0056｜商城应用构建器 service-role 接口链

| 字段 | 记录 |
| --- | --- |
| 分类/对象 | G1；`mall_application_versions`、`mall_application_heads`、schema-v2 校验/投影函数与 `api_mall_application_{center,experience,mutate}` 的后续版本。 |
| 疑似原因 | 固定基线未发现 Commerce API、Console、Miniapp 或 Worker 对这三个 RPC/表的直接调用；商城应用的另一套 Commerce experience 模型仍在运行源码中。 |
| 保留证据 | 迁移建立 v1→v2 确定性投影、严格 JSON 配置验证、不可变版本、发布投影、幂等、乐观并发、审计和 service-role 公共 RPC；schema-v2 契约测试直接覆盖投影、create/save/publish/restore。仓外 service-role、已发布前端和迁移数据责任均未排除。 |
| 可否删除 | 否；未满足公共 API、数据/迁移责任、外部消费者、正式下线、等价替代、验证和恢复条件。 |
| 二次复核 | G1不强制；拟整合或下线前须核验 Supabase 运行实例、服务端适配器与已发布客户端。 |

## 389. AU-389 商城应用构建器复核

- 初版 v1 已由 schema-v2、规范化权限和授权证据接口演进覆盖；不可变版本、发布投影、事务锁与审计职责仍为真实数据库契约。未接线的 service-role 构建器链归 DC-0056/G1。累计 G0 60、G1 74、G2 2、G3 0、GX 5；未删除任何文件。

## DC-0057｜销售总览 service-role RPC

| 字段 | 记录 |
| --- | --- |
| 分类/对象 | G1；`api_admin_sales_overview_scoped(text,text,text,text)` 与其三项专用索引。 |
| 疑似原因 | 固定基线未发现 API、Console、Worker 或数据库测试对该 RPC 的调用。 |
| 保留证据 | service-role 公共接口，聚合订单、退款、商品和分类事实；仓外适配器、已发布后台和运行数据库使用均未核验。索引还可能服务运维查询。 |
| 可否删除 | 否；未满足公共 API、外部消费者、运行索引使用、正式下线、验证和恢复条件。 |
| 二次复核 | G1不强制；任何退役前须取得生产查询/调用证据和回滚计划。 |

## 392. AU-392 管理端销售总览复核

- 该函数明确区分累计净销售、期间支付额与单列退款，固定时区为 Asia/Shanghai；未发现当前定义的后续替代或仓内调用。接口和索引归 DC-0057/G1，累计 G0 60、G1 75、G2 2、G3 0、GX 5；未删除任何文件。

## DC-0058｜客户端错误上报与通知 outbox 链

| 字段 | 记录 |
| --- | --- |
| 分类/对象 | G2；`client_error_reports`、witnesses、outbox 及 `api_{record,claim,complete}_client_error_*`。 |
| 疑似原因 | 固定基线未发现前端/API 上报调用、Worker claim/complete 调用、后续迁移替代或数据库契约测试。 |
| 保留证据 | service-role 公共接口，含限流式指纹聚合、栈信息留存、重试/死信状态和 PII 边界说明；仓外上报端、通知 worker、历史事故数据和生产任务尚未核验。 |
| 可否删除 | 否；需要专项运行核验，不能从仓内零调用推断没有数据或部署消费者。 |
| 二次复核 | 是；复核生产服务角色调用、outbox 队列状态、通知收件契约、栈数据留存/删除政策和恢复方案。 |

## 394. AU-394 客户端错误回报复核

- 全链归 DC-0058/G2；仓内没有登记上报者或消费者，静态证据不足以作删除结论。累计 G0 60、G1 75、G2 3、G3 0、GX 5；未删除任何文件。

## DC-0059｜平台分销商创建与挂载 RPC

| 字段 | 记录 |
| --- | --- |
| 分类/对象 | G1；`api_platform_create_distributor`、`api_platform_attach_tenant_to_distributor`、`api_platform_distributors` 及初版 `distributor.*` 权限。 |
| 疑似原因 | 固定基线未发现应用/Worker 调用；主合同运行权限为另一套 `channel.distributor.*` 命名。 |
| 保留证据 | service-role 公共写入接口，含组织层级、租户单一 active 归属、幂等和审计；`distributors`/`distributor_tenants` 被后续 canonical scope 绑定和中心查询继续使用。 |
| 可否删除 | 否；旧权限、仓外调用、历史挂载和组织层级兼容性均未排除。 |
| 二次复核 | G1不强制；若整合到 channel 合同，先核验生产 service-role 消费者、权限迁移和租户归属回滚。 |

## 396. AU-396 分销渠道基础复核

- 核心数据与分销中心查询经 canonical scope 绑定继续承担运行职责，归 G0；未接线的平台写入/列表接口归 DC-0059/G1。累计 G0 60、G1 76、G2 3、G3 0、GX 5；未删除任何文件。

## DC-0060｜未接线的券运营 service-role 链

| 字段 | 记录 |
| --- | --- |
| 分类/对象 | G2；券项目、库存池、备券、发行、券、核销/冲正、对账表及相关读取/写入 RPC。 |
| 疑似原因 | 固定基线未找到应用、Worker、运维脚本或数据库契约测试调用整个链。 |
| 保留证据 | 资金余额、不可变事件、幂等、审计和外部 service-role 公共契约；历史券数据、仓外收银端/服务和上线状态未排除。 |
| 可否删除 | 否；还存在 F-0241 权限缺口，必须先完成运行与安全专项复核。 |
| 二次复核 | 是；先独立检查实际迁移 ledger、券余额/审计数据、所有 service-role 调用者和权限模型。 |

## 397. AU-397 券运营基础复核

- 券资金链归 DC-0060/G2；同时记录 F-0241/P1 候选。累计 G0 60、G1 76、G2 4、G3 0、GX 5；未删除任何文件。

## DC-0061｜管理端订单授权查询/导出 RPC

| 字段 | 记录 |
| --- | --- |
| 分类/对象 | G1；`api_admin_order_management_{page,export}_authorized` 及内部范围 predicate。 |
| 疑似原因 | 固定基线未见 Commerce API、Console 或 Worker 调用这两个受控 public RPC。 |
| 保留证据 | service-role 公共契约；权限、授权证据、self-scope、导出审计和底层读取 ACL 收紧均由数据库契约测试覆盖。 |
| 可否删除 | 否；仓外 API/已发布后台和迁移后的直接消费者未排除。 |
| 二次复核 | G1不强制；任何收缩前须复核 service-role 调用日志、运行数据库 ACL 和客户端契约。 |

## 401. AU-401 管理端订单查询导出授权复核

- 授权包装器为底层订单读取的正确数据库边界，但仓内未接线，归 DC-0061/G1。累计 G0 60、G1 77、G2 4、G3 0、GX 5；未删除任何文件。

## DC-0062｜Supabase 原子 checkout RPC

| 字段 | 记录 |
| --- | --- |
| 分类/对象 | G1；`api_checkout_order_authorized` 及其 public order/cart checkout 入口替换。 |
| 疑似原因 | 固定基线未找到仓内 HTTP/Worker 调用该 RPC；Commerce 现行 checkout 使用另一套领域表和 Purchase API。 |
| 保留证据 | service-role 公共写入接口，包含身份、资格、地址、供应商拆单、库存预留、审计与幂等；migration 数据/历史函数退役和仓外调用均未排除。 |
| 可否删除 | 否；未满足公共接口、数据兼容、外部消费者、正式下线、验证和恢复条件。 |
| 二次复核 | G1不强制；需要实际 Supabase ledger、调用日志和订单数据对账后才可治理。 |

## 404. AU-404 原子 checkout 与库存预留复核

- 原子订单—预留事务自身为完整的 fail-closed 设计；仓内未接线的 public RPC 归 DC-0062/G1。累计 G0 60、G1 78、G2 4、G3 0、GX 5；未删除任何文件。

## DC-0063｜支付域 canonical outbox relay RPC

| 字段 | 记录 |
| --- | --- |
| 分类/对象 | G1；`api_claim_payment_outbox`、`api_start_payment_effects`、`api_finish_payment_outbox`、`api_claim_payment_event_effects` 与 `api_execute_payment_event_effect`。 |
| 疑似原因 | 固定基线中，这五个精确 RPC 名称仅见迁移与数据库契约测试；Commerce `PaymentJobs` 使用另一套 `payment`/`runtime.outbox` 直接数据库模型。 |
| 保留证据 | service-role 公共接口；其租约、死信、聚合版本阻塞、payload 事实复核、inbox 去重以及会计/履约/通知效果均有专门数据库契约测试。仓外作业、生产服务角色调用、已部署 Supabase 调度器和历史 outbox/effect 积压均未核验。 |
| 可否删除 | 否；未满足公共 API、外部消费者、数据/迁移兼容、正式下线、运行行为、验证恢复及第二次复核条件。 |
| 二次复核 | G1不强制；治理前应先核验生产 RPC 调用日志、service-role 作业配置、outbox 积压和故障恢复演练。 |

## 408. AU-408 支付域出站中继复核

- 中继的单租约、证据验证、去重、指数重试与死信顺序控制设计完整；但 canonical RPC 的仓内运行消费者尚未发现，归 DC-0063/G1。累计 G0 60、G1 79、G2 4、G3 0、GX 5；未删除任何文件。

## 409. AU-409 支付效果执行器复核

- 会计、履约和通知效果由订单锁、有效租约、不可变身份、幂等唯一键、死信阻塞及退款超越逻辑保护；其 canonical service-role 消费者与中继共同归 DC-0063/G1。累计 G0 60、G1 79、G2 4、G3 0、GX 5；未删除任何文件。

## DC-0064｜支付 outbox 死信运维 API

| 字段 | 记录 |
| --- | --- |
| 分类/对象 | G1；`api_payment_outbox_deadletters`、`api_replay_payment_deadletter`、`api_ignore_payment_deadletter`。 |
| 疑似原因 | 固定基线未找到应用、管理 API、Console 或 Worker 对三个精确 RPC 的调用，仅有数据库授权契约测试。 |
| 保留证据 | service-role 公共运维契约：租户/企业/商场范围授权、请求幂等、订单锁、重放版本保护、双独立成员批准忽略及审计记录都在实现和契约测试中可见。生产事故处置端、调用日志、待处理死信和服务角色消费者未核验。 |
| 可否删除 | 否；不满足公共 API、外部/运维消费者、事故恢复职责、验证/恢复和第二次复核条件。 |
| 二次复核 | G1不强制；退役前必须复核线上死信 SOP、服务角色调用、审计保留和人工恢复演练。 |

## 410. AU-410 支付 outbox 死信运维复核

- 该链以最小范围授权、重放幂等、顺序保护和双人忽略降低误操作风险；仓内管理调用尚未发现，归 DC-0064/G1。累计 G0 60、G1 80、G2 4、G3 0、GX 5；未删除任何文件。

## DC-0065｜微信付款查询 canonical 作业 RPC

| 字段 | 记录 |
| --- | --- |
| 分类/对象 | G1；`api_claim_wechat_payment_queries`、`lock_wechat_payment_query`、`api_fail_wechat_payment_query`、`api_record_wechat_payment_query_result`、`api_record_wechat_payment_close_accepted`。 |
| 疑似原因 | 固定基线没有找到五个精确 RPC 的应用或 Worker 调用；Commerce API 调用旧 `api_apply_wechat_payment_query`，恢复队列使用另一套 `access.purchase_enqueue_payment_query`。 |
| 保留证据 | service-role 公共接口；查询/关单任务具备订单—支付—尝试锁顺序、租约、退避、十二次死信和审计，结果确认与观察落账在同一有效租约下完成。后续数据库契约测试保留其兼容及恢复职责。 |
| 可否删除 | 否；生产支付查询作业、Supabase service-role 消费者、待处理尝试和运营恢复流程尚未核验。 |
| 二次复核 | G1不强制；治理前核验运行作业、调用日志、死信量与微信对账恢复路径。 |

## 411. AU-411 微信支付查询队列复核

- 查询/关单任务控制完整，但仓内 canonical 消费者未发现，归 DC-0065/G1。累计 G0 60、G1 81、G2 4、G3 0、GX 5；未删除任何文件。

## 413. AU-413 微信支付查询结果复核

- 结果确认与关单接受逻辑建立在同一租约/观察边界上，但仓内实际调用仍指向另一旧入口，归 DC-0065/G1。累计 G0 60、G1 81、G2 4、G3 0、GX 5；未删除任何文件。

## DC-0066｜订单付款超时回收作业 RPC

| 字段 | 记录 |
| --- | --- |
| 分类/对象 | G1；`api_expire_due_checkout_orders`。 |
| 疑似原因 | 固定基线只见迁移与数据库契约测试，未见仓内应用或 Worker 对该精确 RPC 的调用。 |
| 保留证据 | service-role 公共恢复接口；它以支付终态观察证据阻止错误释放库存，回收订单、子订单和预留并审计。生产调度器、活跃预留、支付对账与仓外消费者均未核验。 |
| 可否删除 | 否；不满足外部消费者、资金状态、库存回收、验证/恢复和第二次复核条件。 |
| 二次复核 | G1不强制；治理前核验线上调度、调用日志、未终态支付订单和恢复 SOP。 |

## 414. AU-414 订单付款超时守卫复核

- 仅在不可变终态支付证据存在时回收过期预留，设计为 fail-closed；仓内调度消费者尚未发现，归 DC-0066/G1。累计 G0 60、G1 82、G2 4、G3 0、GX 5；未删除任何文件。

## DC-0067｜未接线的微信退款闭环

| 字段 | 记录 |
| --- | --- |
| 分类/对象 | G2；`wechat_refund_*` 命令/尝试/通知/事件表、退款授权、命令领取/回执、通知、事件领取/执行/重放及财务对账 RPC。 |
| 疑似原因 | 固定基线没有发现上述 canonical RPC 的应用、Worker 或运维脚本消费者；Commerce 运行代码未调用这些入口，仍保有另一条退款实现。 |
| 保留证据 | 退款链涵盖来源支付核验、订单锁、供应商观察、命令和事件租约、死信、账务双录、退款金额上限、补偿通知、授权审计及广泛数据库契约测试。它还对既有退款历史财务分录执行补记。 |
| 可否删除 | 否；涉及资金、退款历史、供应商回执、对账与事故恢复。仓外调用、线上迁移 ledger、历史退款/会计数据、支付提供商身份和正式切换状态均未核验。 |
| 二次复核 | 是；须独立复查迁移执行记录、生产 service-role/Provider webhook 消费者、退款及账本对账、死信量、恢复 SOP 和旧路径切换。 |

## 415. AU-415 微信退款闭环复核

- 退款命令至财务/通知的 fail-closed 设计完整，但当前仓内未见 canonical 消费者且与现行 Commerce 退款路径并存，归 DC-0067/G2。累计 G0 60、G1 82、G2 5、G3 0、GX 5；未删除任何文件。

## DC-0068｜支付效果/查询告警恢复 API

| 字段 | 记录 |
| --- | --- |
| 分类/对象 | G1；`api_payment_operation_deadletters` 与 `api_replay_payment_operation_deadletter`。 |
| 疑似原因 | 固定基线未找到应用、管理 API、Console 或 Worker 对精确 RPC 的调用。 |
| 保留证据 | service-role 运维契约；它复用持久化 critical 告警、订单锁、成员范围授权、请求幂等和不可变恢复记录，实际改变支付效果或查询死信状态。 |
| 可否删除 | 否；生产告警看板、仓外管理入口、历史恢复记录和事故 SOP 未核验。 |
| 二次复核 | G1不强制；治理前复核线上告警消费者、调用日志、恢复请求和人工演练。 |

## 417. AU-417 支付死信授权恢复复核

- 重放通过受权、订单锁、幂等与审计控制，但仓内管理消费者未发现，归 DC-0068/G1。累计 G0 60、G1 83、G2 5、G3 0、GX 5；未删除任何文件。

## 418. AU-418 商城应用 schema-v2 复核

- v1 配置确定性投影到 v2，并保留严格验证、版本化发布与恢复；仓内 canonical 构建器消费者仍未发现，归 DC-0056/G1。累计 G0 60、G1 83、G2 5、G3 0、GX 5；未删除任何文件。

## GX-0006｜环境特定平台 Owner 调和迁移

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除、修改或单独重放，需专项运行与身份治理设计。 |
| 对象 | `20260820132000_platform_owner_reconciliation.sql`。 |
| 直接证据 | 迁移选择本地用户名 `ethan` 作为 canonical Owner、写入平台/租户 scope、暂时关闭 Owner 保护 trigger，并批量暂停 `*-test-*` membership/member/user；无法找到 Owner 或唯一 Owner 均会中止。 |
| 运行边界 | `RegistrationMigrationPlan` 将其明示标记为“environment-specific Ethan platform owner reconciliation”并作为 omitted migration 记账；运行数据库边界与阿里云校验仍要求活动平台 Owner 数为 1。其他 Supabase/发布通道是否执行该原文件不由仓内静态证据证明。 |
| 可否删除 | 否；它承担历史身份调和与迁移 ledger 责任，且删除、重放或改写均可能改变平台最高权限与测试隔离。 |
| 二次复核 | 是；必须独立核验所有迁移执行器、生产 ledger、Owner 身份/组织 scope、测试账号保留策略和恢复方案。 |

## 420. AU-420 平台 Owner 调和复核

- 环境特定迁移已由注册执行器显式省略，但其原文件仍高风险并可能被其他通道处理，归 GX-0006。累计 G0 60、G1 83、G2 5、G3 0、GX 6；未删除任何文件。

## GX-0007｜库存单一事实源切换迁移

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除、改写、重放或与其他改动混合。 |
| 对象 | `20260820133000_inventory_single_source_cutover.sql`。 |
| 直接证据 | 迁移锁定 legacy `public.inventory` 与订单/库存表，快照迁移为 `inventory.stock_items`/cutover record，区分 `ready` 与 `manual_review`，提供受权人工复核，重写目录及供应商库存写路径，最后删除 `public.inventory` 和测试维护函数。 |
| 运行边界 | `RegistrationMigrationPlan` 对该文件执行原文；数据库切换契约测试覆盖手工复核、可售库存、授权及 legacy 对象退出。兼容迁移目录仍含 legacy `public.inventory` 引用，不能仅凭源码搜索断定其不承担历史恢复/独立环境职责。 |
| 可否删除 | 否；涉及真实库存、订单预留、目录可售性、供应商导入、历史数据和迁移 ledger。 |
| 二次复核 | 是；需独立核验所有生产数据库 ledger、实际库存/预留对账、手工复核遗留、供应商同步、回滚与恢复演练。 |

## 421. AU-421 库存单一事实源切换复核

- 迁移建立库存唯一权威与 fail-closed 手工复核，但包含不可逆 legacy 表删除，归 GX-0007。累计 G0 60、G1 83、G2 5、G3 0、GX 7；未删除任何文件。

## GX-0008｜全域历史数据回填迁移

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除、修改、单独重放或与任意功能改动混合。 |
| 对象 | `20260821026000_backfill_domain_data.sql`。 |
| 直接证据 | 一个事务向二十余领域表回填 legacy `public.*` 数据，包括身份、订单、支付、退款、券、权益、财务、事件收件箱/发件箱、审计与报告投影；敏感数据前置 secure-stage 断言，且保留死信、历史幂等键与证据。 |
| 运行边界 | 数据库契约脚本把该文件纳入固定执行序列；后续 `reconcile_domain_data` 对数量、金额、引用与哈希执行迁移后核验。迁移 ledger、历史业务数据与其他部署通道均未在本次静态审阅中验证。 |
| 可否删除 | 否；不满足历史兼容、数据迁移、恢复、可观察行为和第二次复核条件。 |
| 二次复核 | 是；须在隔离备份副本上独立复核迁移 ledger、数据对账、敏感字段前置条件、失败恢复与回滚方案。 |

## 437. AU-437 领域数据回填复核

- 全域迁移保留历史状态、资金、事件和审计责任，归 GX-0008。累计 G0 60、G1 83、G2 5、G3 0、GX 8；未删除任何文件。

## GX-0009｜全域历史数据对账迁移

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除、修改、单独重放或与功能改动混合。 |
| 对象 | `20260821027000_reconcile_domain_data.sql`。 |
| 直接证据 | 创建 reconciliation evidence/hash，并对历史源与目标的数量、金额、哈希、组织层级、订单、券、账本、权益和引用完整性设置 fail-closed 断言。 |
| 运行边界 | 是紧随全域回填的验收门禁，数据库契约脚本固定包含该文件；其 `public.*` 读取只承担迁移时数据核验责任。 |
| 可否删除 | 否；不满足迁移验收、历史兼容、恢复与第二次复核条件。 |
| 二次复核 | 是；在隔离备份副本复核 ledger、对账输出、失败恢复方案和所有 legacy 数据保留要求。 |

## 438. AU-438 领域数据对账复核

- 全域数量、金额、哈希和引用对账是回填迁移的 fail-closed 验收责任，归 GX-0009。累计 G0 60、G1 83、G2 5、G3 0、GX 9；未删除任何文件。

## GX-0010｜legacy 数据库对象退役迁移

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除、改写、单独重放或与功能变更混合。 |
| 对象 | `20260821031000_drop_legacy_objects.sql`。 |
| 直接证据 | 在单事务维护窗口中以 `DROP ... CASCADE` 清除全部 public legacy 业务对象、旧 inventory 表/函数及敏感 stage 表。 |
| 运行边界 | 前置回填和对账迁移提供数据承接证据；后续 target-head 与支付迁移明确要求旧对象不得残留；数据库契约固定包含该序列。 |
| 可否删除 | 否；涉及不可逆数据/对象退役、历史 migration ledger、回滚和兼容责任。 |
| 二次复核 | 是；必须独立验证备份、源/目标对账、所有部署 ledger、依赖清单、维护窗口和恢复演练。 |

## 442. AU-442 legacy 对象退役复核

- 不可逆旧对象退役与后续 fail-closed target-head 断言构成同一切换边界，归 GX-0010。累计 G0 60、G1 83、G2 5、G3 0、GX 10；未删除任何文件。

## GX-0011｜权益旧流水到财务总账的迁移

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除、改写、单独重放或与功能变更混合。 |
| 对象 | `20260821042000_benefit_lifecycle.sql`。 |
| 直接证据 | 迁移将 `benefit.entry` 的正负金额逐条调用 `finance.post` 投影为带 scope 的复式总账，随后 `drop table benefit.entry`；同时回填 lot 与 lotmovement。 |
| 运行边界 | 当前权益 API 从 `benefit.balance`（财务 entry/journal 投影）、lot 和 lotmovement 读取，`benefitgrant`/`benefitexpiry` Worker 继续写同一模型；迁移 ledger 与断言要求旧表不存在。 |
| 可否删除 | 否；承担财务迁移、历史数据、不可逆退役、恢复和审计责任。 |
| 二次复核 | 是；必须独立核验每 scope/币种的金额与笔数对账、journal 幂等键、备份可恢复性、目标 schema ledger、部署窗口与回滚演练。 |

## 452. AU-452 权益生命周期复核

- 权益批次、预算、lot、财务总账及异步发放/到期处理构成完整运行链；旧流水退役归 GX-0011。累计 G0 60、G1 83、G2 5、G3 0、GX 11；未删除任何文件。

## GX-0012｜财务账本与结算生命周期迁移

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除、改写、单独重放或与功能变更混合。 |
| 对象 | `20260821043000_finance_lifecycle.sql`。 |
| 直接证据 | 迁移新增范围化 journal 幂等键、账本不可变触发器、对账/结算/提现/期间关闭/发票事实表和历史 finance backfill 证据记录；改变资金、税务和审计数据的持久化边界。 |
| 运行边界 | Finance API、对账与结算 Worker、提现网关、死信处理和通知/projection 订阅共同依赖这些表、函数、事件与 RLS；失败提现被标记 `uncertain`，而非自动再次付款。 |
| 可否删除 | 否；承担资金状态、复式账本、结算证据、发票历史、数据切换、恢复和审计责任。 |
| 二次复核 | 是；必须独立核验历史 journal/entry 对账、账户与范围映射、结算/提现幂等、期间关闭、权限/RLS、备份恢复和渠道侧付款状态。 |

## 453. AU-453 财务生命周期复核

- 财务账本、对账、结算、提现和发票链路均有当前 API/Worker 入口；高风险数据与资金边界归 GX-0012。累计 G0 60、G1 83、G2 5、G3 0、GX 12；未删除任何文件。

## 487. AU-487 对账完整性复核

- `20260828091000_finance_reconciliation_integrity.sql` 以账单来源触发器、金额/唯一性/状态约束和 fail-closed 存量检查收紧 GX-0012 的对账事实边界；已注册的 reconciliation Worker 仍实际依赖该模型，不能作为删除或单独重放候选。未发现新增 P0–P3；历史数据、真实 ledger 与恢复演练待独立复核。

## 488. AU-488 财务安全边界复核

- `20260828092000_finance_security_boundaries.sql` 继续属于 GX-0012：它绑定高风险动作凭证、账本/事件保留、RLS 与受控写权限，不能删除或单独重放。F-0243 记录了当前 action proof 消费/版本锁定未接入命令链的 P1 候选；此事实不构成删除依据。

## 489. AU-489 财务会计完整性复核

- `20260828093000_finance_accounting_integrity.sql` 是 GX-0012 的账本/期间/结算收口；当前 FinancePort 与 Worker 依赖其规则矩阵和受控函数。F-0244 是受限 bootstrap 的规则漂移，不是删除依据；不得据此删除账本迁移、函数或 test-only 过程。

## 490. AU-490 支付提供方时间证据复核

- `20260828095000_payment_provider_time_evidence.sql` 被支付/退款 Job、结算和对账修复链实际使用；provider 时间、effect digest 与不可变性归 GX-0021 支付证据边界，G0，不构成删除候选。

## 491. AU-491 Docker 构建上下文复核

- 根 `.dockerignore` 是 Docker root context 自动消费的凭据/产物排除契约，保护阿里云 Dockerfile 的 builder 输入；无正式 workflow build 入口的静态证据不等于可删除，归 G0。

## 492. AU-492 编辑器格式约定复核

- 根 `.editorconfig` 是兼容编辑器自动消费的文本格式、Markdown 硬换行与 YAML 缩进契约；仓内无显式 formatter 消费不构成删除证据，归 G0。

## 493. AU-493 Git 属性复核

- 根 `.gitattributes` 是 Git 自动消费的 LF/二进制边界；避免跨平台格式假漂移，不因缺少运行源码引用而成为删除候选，归 G0。

## 494. AU-494 Code owner 映射复核

- `.github/CODEOWNERS` 对自身与两个实际订单域路径定义 GitHub PR 责任映射；远端强制状态未验证，但不构成删除证据，归 G0。

## 495. AU-495 本地状态与凭据排除复核

- 根 `.gitignore` 被 localinfra、开发脚本和支付证书边界实际依赖，保护 local env、TLS/data、secrets 与构建产物；归 G0，不构成删除候选。

## 496. AU-496 历史检索排除复核

- 根 `.ignore` 被 ripgrep 自动消费，预防可选 `06_history_lishi/` 旧主线污染日常检索；目录当前缺席不构成删除证据，归 G0。

## 497. AU-497 Prettier 排除复核

- `.prettierignore` 被正式 format/check:format 入口自动消费，保护迁移、生成 Miniapp/token、锁文件与 byte-preserved 交接物，归 G0。

## 498. AU-498 Prettier 主配置复核

- `.prettierrc.json` 被正式 format/check:format 入口自动解析，并与 EditorConfig/Git LF 边界一致；归 G0，无删除候选。

## 499. AU-499 核心代码布局 README 复核

- `01_core_hexin/README.md` 的 apps/services/packages/extensions 一级导航与实际目录一致；归 G0，不作为运行权威或删除依据。

## 500. AU-500 Compatibility API 环境模板复核

- `commerce-api/.env.example` 是无实际凭据的本地/部署安全配置模板，覆盖 session、PII、注册、SMS、微信和支付；归 G0，不构成删除候选。

## 501. AU-501 Compatibility API Vitest 配置复核

- `commerce-api/vitest.config.ts` 是 package test 入口的 Node/API-test collection 边界；归 G0，兼容 Admin 的测试覆盖另待模块证据确认。

## GX-0013｜渠道外部对象 scope 映射切换

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除、改写、单独重放或与功能变更混合。 |
| 对象 | `20260821045000_channel_scope_mapping.sql`。 |
| 直接证据 | 迁移从 `catalog.sourcelisting` 回填 `channel.externalobject.scope_id`；任何未能关联的旧记录会抛出 `EXTERNAL_MAPPING_SCOPE_BACKFILL_REQUIRED`，随后将列设为非空，并将三张表的唯一性改为包含 scope。 |
| 运行边界 | Channel sync 写入 `(provider,scope_id,objecttype,externalid,sourceversion)`；Catalog source projection 与查询均显式携带 scope；`channel.externalobject` RLS 依 `access.scope_allowed(scope_id)` 授权。 |
| 可否删除 | 否；承担租户隔离、外部对象幂等键、历史回填、Webhook/渠道同步正确路由和恢复责任。 |
| 二次复核 | 是；必须独立验证回填缺口为零、相同 external id 跨 scope 的并存行为、RLS、渠道重放、冲突键、备份恢复和部署 ledger。 |

## 454. AU-454 渠道 scope 映射复核

- 外部对象和源记录以 scope 为事实所有权，未关联历史记录 fail-closed；归 GX-0013。累计 G0 60、G1 83、G2 5、G3 0、GX 13；未删除任何文件。

## GX-0014｜客服 case 到 conversation/ticket 的历史切换

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除、改写、单独重放或与功能变更混合。 |
| 对象 | `20260821046000_support_lifecycle.sql`。 |
| 直接证据 | 迁移从 `support.case` 建立 conversation 并改名 ticket，回填 message/history/assignment/evidence/escalation 的 scope 与会话关系，随后删除旧 case 外键及 ticket 中已迁出的字段。 |
| 运行边界 | Support API 通过 conversation/ticket 处理建单、消息、附件、分配和关闭；`supportsla`/`supportscan` Worker 处理升级和附件扫描；消息/历史有 append-only 触发器和 scope RLS。 |
| 可否删除 | 否；承担客户数据、工单历史、授权范围、SLA、审计和恢复责任。 |
| 二次复核 | 是；必须独立核验每条旧 case 的 conversation/ticket/message/history/evidence 映射、RLS、附件访问、SLA 重排、备份恢复和部署 ledger。 |

## 455. AU-455 客服生命周期复核

- 客服会话、工单、消息、SLA 与扫描任务构成实际运行链；历史结构切换归 GX-0014。累计 G0 60、G1 83、G2 5、G3 0、GX 14；未删除任何文件。

## GX-0015｜通知投递与成员可见性迁移

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除、改写、单独重放或与功能变更混合。 |
| 对象 | `20260821047000_notification_lifecycle.sql`。 |
| 直接证据 | 为既有 dispatch/attempt 回填 scope、成员、渠道和内容，若任何 dispatch 缺失 scope/channel/body 则 fail-closed；重建按成员/范围的 RLS，并把通知读取切换至 member audience。 |
| 运行边界 | Notification repository 从 event consumer 写 scope 化 dispatch 和 job；notification Worker 写 attempt/状态；成员偏好、公告和模板均由当前 API 与 RLS 使用。 |
| 可否删除 | 否；承担隐私可见性、投递幂等、历史回填、成员授权和恢复责任。 |
| 二次复核 | 是；须验证历史回填、成员/运营可见性、模板激活唯一性、重复投递、失败重试、公告受众、备份恢复和 ledger。 |

## 456. AU-456 通知生命周期复核

- 通知事件、投递 Worker、成员偏好与公告均依赖该迁移；高风险隐私边界归 GX-0015。累计 G0 60、G1 83、G2 5、G3 0、GX 15；未删除任何文件。

## GX-0016｜报表投影与导出授权状态迁移

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除、改写、单独重放或与功能变更混合。 |
| 对象 | `20260821048000_reporting_lifecycle.sql`。 |
| 直接证据 | 为 export 回填 authorization snapshot，并使旧 completed 导出失效；completed 状态强制要求对象、哈希、大小、clean 扫描结果、生成和过期时间。新增投影事件去重表及 scope RLS。 |
| 运行边界 | Projection consumer 记录 event/水位；export Worker 以 scope、筛选和授权快照读取数据、写对象和状态；资源 scope 进入统一授权解析。 |
| 可否删除 | 否；承担敏感报表数据、导出访问控制、事件投影一致性、对象恢复和审计责任。 |
| 二次复核 | 是；须验证历史导出失效、授权快照、对象扫描、跨 scope 过滤、投影重放/水位、过期删除与恢复。 |

## 457. AU-457 报表生命周期复核

- 报表投影和导出均有当前 Worker/API 入口；授权与对象状态切换归 GX-0016。累计 G0 60、G1 83、G2 5、G3 0、GX 16；未删除任何文件。

## GX-0017｜外部扩展安装与健康状态迁移

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除、改写、单独重放或与功能变更混合。 |
| 对象 | `20260821051000_extension_lifecycle.sql`。 |
| 直接证据 | 迁移约束 manifest 签名/哈希/大小、安装 endpoint HTTPS 与 secret 引用，旧 draft 安装统一转 disabled，重建 enabled 唯一性/RLS，并启动 extensionhealth 扫描任务。 |
| 运行边界 | Extension repository 加载/更新安装并调度健康任务；健康 Worker 按结果转 enabled/degraded/disabled 并记录事件，Channel 扩展 sink 依赖该安装状态。 |
| 可否删除 | 否；承担外部供应链、租户范围、凭据引用、安装状态、健康恢复和审计责任。 |
| 二次复核 | 是；须验证签名/contract 校验、secret 引用、HTTPS、状态转移、健康重试、跨 scope RLS、禁用恢复和迁移 ledger。 |

## 458. AU-458 扩展生命周期复核

- 外部扩展的安装、签名、健康任务与状态恢复都有当前入口；归 GX-0017。累计 G0 60、G1 83、G2 5、G3 0、GX 17；未删除任何文件。

## GX-0018｜批量导入进度、暂存行与报告迁移

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除、改写、单独重放或与功能变更混合。 |
| 对象 | `20260821052000_import_lifecycle.sql`。 |
| 直接证据 | 迁移回填 catalog 导入进度/验证摘要，新增受限状态、进度、报告完整性约束和 scope 化错误；创建 inventory import job/row/error，暂存行仅授予 job 身份。 |
| 运行边界 | catalogimport 与 inventoryimport Worker 分片暂存/处理、使用 savepoint 记录行失败、产生报告；运营 API 按 scope 创建/读取 job，runtime job 负责实际处理。 |
| 可否删除 | 否；承担历史导入状态、数据隔离、错误报告、幂等恢复和运行任务责任。 |
| 二次复核 | 是；须验证旧 job 回填、跨 scope 拒绝、重复 job/对象、分片失败、报告对象、取消/重试和备份恢复。 |

## 459. AU-459 导入生命周期复核

- 当前目录与库存导入 Worker 依赖该模型；历史状态与暂存边界归 GX-0018。累计 G0 60、G1 83、G2 5、G3 0、GX 18；未删除任何文件。

## GX-0019｜成员与券批量导入完成迁移

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除、改写、单独重放或与功能变更混合。 |
| 对象 | `20260821053000_complete_batch_imports.sql`。 |
| 直接证据 | 将 member/voucher job 迁移到受限进度/报告状态，创建仅 job 可读的 member/voucher 暂存行；券码暂存由密文、指纹、密钥版本与错误互斥约束保护。 |
| 运行边界 | 四类导入由统一 runtime job 目录注册；member Worker 分片/完成后删除暂存行，voucher Worker 以 KMS 加密码并生成报告。 |
| 可否删除 | 否；承担个人资料、券码密钥材料、导入进度、错误报告和恢复责任。 |
| 二次复核 | 是；须验证成员/券历史 job、暂存数据保留/清除、加密指纹唯一、跨 scope、重试/死信、报告和备份恢复。 |

## 460. AU-460 成员与券导入完善复核

- 成员与券导入均有实际 API/Worker 入口；敏感暂存与历史状态迁移归 GX-0019。累计 G0 60、G1 83、G2 5、G3 0、GX 19；未删除任何文件。

## GX-0020｜Membership 从 member 到 access 的所有权迁移

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除、改写、单独重放或与功能变更混合。 |
| 对象 | `20260821054000_move_membership_owner.sql`。 |
| 直接证据 | `alter table member.membership set schema access`，并断言 `access.membership` 存在、`member.membership` 不再存在。 |
| 运行边界 | Identity session/federated identity、凭据操作、成员查询及权限逻辑均直接引用 `access.membership`。 |
| 可否删除 | 否；承担身份、会话、角色、授权范围与历史 migration ledger 责任。 |
| 二次复核 | 是；须验证角色/会话/联合身份/注册、RLS/grant、所有 SQL consumer、备份恢复和部署 ledger。 |

## 461. AU-461 Membership 所有权迁移复核

- identity、member 和 access 的当前调用链以 `access.membership` 为标准；核心授权迁移归 GX-0020。累计 G0 60、G1 83、G2 5、G3 0、GX 20；未删除任何文件。

## GX-0021｜微信支付应用场景隔离

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除、改写、单独重放或与功能变更混合。 |
| 对象 | `20260821055000_isolate_wechat_payment_applications.sql`。 |
| 直接证据 | 为 `payment.attempt` 增加 miniapp/jsapi 场景和 AppID SHA-256；未终态尝试必须同时拥有二者，并为 application+intent+时间建立索引。 |
| 运行边界 | Payment create 写入 scene/application hash；Webhook 按观测应用核验；支付查询/退款任务读取同一尝试绑定。 |
| 可否删除 | 否；承担资金渠道路由、应用隔离、回调归属和审计责任。 |
| 二次复核 | 是；须验证 Miniapp/JSAPI 分流、Webhook AppID 不匹配、重试、历史终态、渠道凭据和回滚恢复。 |

## 462. AU-462 微信支付应用隔离复核

- 支付创建、Webhook 和异步任务均依赖 scene/AppID 哈希绑定；归 GX-0021。累计 G0 60、G1 83、G2 5、G3 0、GX 21；未删除任何文件。

## GX-0022｜成员个人数据 scope 授权函数

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除、改写、单独重放或与功能变更混合。 |
| 对象 | `20260821056000_authorize_member_data_scope.sql`。 |
| 直接证据 | 重定义 `access.scope_allowed`：允许当前授权 scope/其下级，或活跃 membership 的 member_id、organization_id/其下级；注释明确禁止祖先与兄弟范围。 |
| 运行边界 | member profile/address/import 读写和大量 RLS policy 经该函数判定；函数依 `access.membership` 的活跃状态。 |
| 可否删除 | 否；承担个人数据、组织层级、行级权限与会话授权责任。 |
| 二次复核 | 是；须验证本人、组织、下级、祖先、兄弟、失效 membership、无 session context 及所有关键 RLS consumer。 |

## 463. AU-463 成员数据范围授权复核

- 成员本人和组织子树的范围判断由当前 `scope_allowed` 实施；归 GX-0022。累计 G0 60、G1 83、G2 5、G3 0、GX 22；未删除任何文件。

## GX-0023｜支付 Webhook scope resolver 历史演进

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除、改写、单独重放或与功能变更混合。 |
| 对象 | `20260821057000_resolve_payment_webhook_scope.sql`。 |
| 直接证据 | 迁移按 payment/refund provider reference 解析订单 scope，禁止 public/anon/authenticated/service_role 执行；后续 `20260901220000` 显式 drop 双参数函数并以 application hash 三参数版本替代。 |
| 运行边界 | 当前 PaymentWebhook 调用三参数 resolver，并核验 attempt 的 scene/application hash；旧文件保留在固定迁移序列中。 |
| 可否删除 | 否；承担资金回调授权演进、历史 schema 构建、迁移 ledger 与恢复责任。 |
| 二次复核 | 是；须验证 payment/refund reference、错误 application hash、函数权限、历史升级路径、回调拒绝和恢复。 |

## 464. AU-464 支付 Webhook scope 复核

- 双参数 resolver 已升级而非“无用”；资金回调演进迁移归 GX-0023。累计 G0 60、G1 83、G2 5、G3 0、GX 23；未删除任何文件。

## GX-0024｜跨域 member audience 契约对齐

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除、改写、单独重放或与功能变更混合。 |
| 对象 | `20260821058000_align_member_operations.sql`。 |
| 直接证据 | 对 17 个 cart/checkout/order/benefit/voucher/invoice/support/payment/catalog/pricing/inventory operation 设置 `audience='member'`，并断言精确数量与运行契约 checksum。 |
| 运行边界 | 后续 `access.resource_scope` 明确用 capability audience 决定成员个人 scope；所列操作均由生产模块注册。 |
| 可否删除 | 否；承担前后端/鉴权/路由三处共用的成员与运营受众契约责任。 |
| 二次复核 | 是；须逐操作验证身份、scope、permission、前端调用方、错误码与 operator 边界。 |

## 465. AU-465 成员操作受众复核

- 17 个跨域业务入口的成员受众由当前 capability contract 决定；归 GX-0024。累计 G0 60、G1 83、G2 5、G3 0、GX 24；未删除任何文件。

## GX-0025｜Runtime contract head checksum 对账

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除、改写、单独重放或与功能变更混合。 |
| 对象 | `20260821059000_reconcile_contract_head.sql`。 |
| 直接证据 | 更新 `runtime.schemaversion` 中契约 head checksum，新增版本 ledger，并 fail-closed 断言固定 checksum。 |
| 运行边界 | 后续迁移、运行就绪检查和部署边界反复读取/断言 schemaversion contract head。 |
| 可否删除 | 否；承担 schema 顺序、契约一致性、部署门禁、恢复和历史 ledger 责任。 |
| 二次复核 | 是；须验证执行顺序、目标 head、readiness consumer、备份恢复和发布控制面 ledger。 |

## 466. AU-466 Runtime contract head 复核

- 契约 checksum 是迁移/就绪门禁的基础历史；归 GX-0025。累计 G0 60、G1 83、G2 5、G3 0、GX 25；未删除任何文件。

## GX-0026｜Membership 权威函数 schema 重绑

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除、改写、单独重放或与功能变更混合。 |
| 对象 | `20260821060000_rebind_membership_functions.sql`。 |
| 直接证据 | 通过 `pg_get_functiondef` 重写 session/membership/version/resource-scope/capability 五个函数的 `member.membership` 引用；不符合预期源码或出现残留引用即异常。 |
| 运行边界 | Identity 会话解析、授权 membership 解析/版本、资源 scope 与 capability operation 都调用这些函数。 |
| 可否删除 | 否；承担动态 SQL 定义、身份授权、迁移升级和恢复责任。 |
| 二次复核 | 是；须核验所有函数签名/权限、函数定义、会话解析、access version、resource scope、capability 和 rollback 语义。 |

## 467. AU-467 Membership 函数重绑复核

- AU-461 的表转移只有在五个权威函数重绑后才完整；归 GX-0026。累计 G0 60、G1 83、G2 5、G3 0、GX 26；未删除任何文件。

## GX-0027｜Membership scopegrant 历史规范化

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除、改写、单独重放或与功能变更混合。 |
| 对象 | `20260821061000_normalize_membership_scopes.sql`。 |
| 直接证据 | 回填 self/owner/组织 scope 的 canonical id/path，为 active membership 补 self、为 storefront 补 owner allow，随后按 membership/kind/scope/effect 去重并断言 kind 一致。 |
| 运行边界 | access scope object/resolver、session context 与 RLS 使用 scopegrant；grant 保留 membership access_version。 |
| 可否删除 | 否；承担授权范围、个人/组织边界、历史数据、会话访问版本与恢复责任。 |
| 二次复核 | 是；须验证所有 scope kind、active/inactive membership、storefront owner、冲突去重、access version、RLS 和备份恢复。 |

## 468. AU-468 Membership scope 规范化复核

- scopegrant 是当前授权事实，不是可删除的重复配置；归 GX-0027。累计 G0 60、G1 83、G2 5、G3 0、GX 27；未删除任何文件。

## GX-0028｜Runtime target-head error-contract 发布封板

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除，需专项设计 |
| 对象 | `02_platform_pingtai/database/supabase/migrations/20260821062000_publish_error_contract.sql`、`20260821063000_finalize_error_contract.sql` |
| 疑似原因 | 文件名提及 error contract，但正文仅更新 `runtime.schemaversion` checksum，容易被误判为冗余账本写入。 |
| 保留证据 | [FACT][E-AU-469-470] 两个顺序版本均验证 `20260821032000_assert_target_head.sql` 的固定 checksum；该 target-head 断言 schema、operation/event、capability、RLS、grant、遗留对象与 reconciliation evidence。失败会显式中止迁移。 |
| 运行结论 | 这是数据库发布完整性门禁的历史步骤，不是客户端错误码实现，也不是可安全重建的构建产物。 |
| 数据/契约责任 | 维持迁移版本链与已发布目标数据库形态之间的可验证关系；删除或改写可能使错误 schema head 被错误接受。 |
| 可否删除 | 禁止 |
| 二次复核 | 是：须在隔离数据库核对迁移执行器、version checksum 与恢复流程。 |

- migration ledger 与 target-head 断言共同构成发布封板；AU-469/470 归 GX-0028。累计 G0 60、G1 83、G2 5、G3 0、GX 28；未删除任何文件。

## GX-0029｜Invitation 生命周期与注册政策历史绑定

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除，需专项设计 |
| 对象 | `02_platform_pingtai/database/supabase/migrations/20260821065000_add_invitation_lifecycle.sql` |
| 疑似原因 | 该文件看似仅为 invite 补充元数据和登记两项 operation。 |
| 保留证据 | [FACT][E-AU-472] 它回填并强制 `registration_policy_id`/`terms_hash`，创建外键与约束；当前 create 写入该绑定，revoke/read/scope resolver 继续以 invite 的组织、状态与版本作授权事实。 |
| 运行结论 | 这是身份邀请、条款同意和 operator 授权的历史数据演进，而非孤立 schema 变更。 |
| 数据/契约责任 | 保存历史邀请的条款/政策可追溯性，并建立 create/revoke operation、permission 与 capability 共同契约。 |
| 可否删除 | 禁止 |
| 二次复核 | 是：应在隔离数据库抽样核对历史政策选取、invite scope 和恢复路径。 |

- invitation 条款/政策绑定与授权生命周期归 GX-0029。累计 G0 60、G1 83、G2 5、G3 0、GX 29；未删除任何文件。

## GX-0030｜Invitation resource scope resolver 演进

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除，需专项设计 |
| 对象 | `02_platform_pingtai/database/supabase/migrations/20260821066000_resolve_invitation_scope.sql`、`20260821079000_resolve_experience_version_scope.sql` |
| 疑似原因 | 该文件是历史版本的 function replacement，之后又被多次覆盖。 |
| 保留证据 | [FACT][E-AU-473/485] invitation 分支建立组织 scope 归属，experience version 分支将 immutable version 反查至 owning application scope；两者均在 unknown 时显式失败、仅 shopapp 可执行，后续三参/四参 resolver 从此演进。 |
| 运行结论 | 后续覆盖是演进，不是删除依据；错误改写会改变 handler 授权范围。 |
| 数据/契约责任 | 确立 invitation 的组织归属和 operation→resource 数据所有权投影。 |
| 可否删除 | 禁止 |
| 二次复核 | 是：以真实数据库 current definition、grant 和跨组织反事实调用复核。 |

- invitation/experience scope resolver 演进归 GX-0030。累计 G0 60、G1 83、G2 5、G3 0、GX 30；未删除任何文件。

## GX-0031｜Identity session 管理与撤销事件

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除，需专项设计 |
| 对象 | `02_platform_pingtai/database/supabase/migrations/20260821067000_add_session_management.sql` |
| 疑似原因 | 文件主要插入 operation/event/capability registry，容易被视为可再生成的目录数据。 |
| 保留证据 | [FACT][E-AU-474] 当前 session list/revoke handler 使用该 operation，撤销成功后发布 `identity.session.revoked`；下游 session validity 继续依据 revoked、expiry、credential/access version 拒绝失效会话。 |
| 运行结论 | 会话撤销的 API、事件和失效验证构成完整身份安全链，不能按单独登记记录处理。 |
| 数据/契约责任 | 规定同 account/realm 的会话边界与撤销事件契约。 |
| 可否删除 | 禁止 |
| 二次复核 | 是：需验证撤销/outbox 原子性、事件消费者与跨 realm 隔离。 |

- identity session 安全链归 GX-0031。累计 G0 60、G1 83、G2 5、G3 0、GX 31；未删除任何文件。

## GX-0032｜Store management scope 与授权函数演进

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除，需专项设计 |
| 对象 | `02_platform_pingtai/database/supabase/migrations/20260821069000_add_store_management.sql`、`20260821080000_restore_member_scope_authorization.sql` |
| 疑似原因 | 文件同时替换 scope 函数、增加门店 operation 和 checksum，表面上与后续 scope 函数有重叠。 |
| 保留证据 | [FACT][E-AU-476/486] 当前 PartnerOperations 与 member/benefit/voucher SQL 都以 `access.scope_allowed` 保护范围；DatabaseContext 从服务端 AccessPipeline 写入 context。800 迁移显式恢复 690 意外移除的 member→organization 语义并断言无关 scope 仍拒绝。 |
| 运行结论 | 该历史步骤定义 store 管理范围和函数版本链；后续替换不等于可以删除或跳过。 |
| 数据/契约责任 | 承担 operator store 管理 API、KMS 地址写入范围和 scope SQL 的授权边界。 |
| 可否删除 | 禁止 |
| 二次复核 | 是：current function、迁移顺序、成员/店铺越权反事实和恢复演练。 |

- store management/member scope 演进归 GX-0032。累计 G0 60、G1 83、G2 5、G3 0、GX 32；未删除任何文件。

## GX-0033｜Decision audit actor/scope RLS 修复

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除，需专项设计 |
| 对象 | `02_platform_pingtai/database/supabase/migrations/20260821070000_repair_decision_audit_scope.sql` |
| 疑似原因 | 该文件只替换一条 RLS policy，容易在文件级清理时被低估。 |
| 保留证据 | [FACT][E-AU-477] PgDecisionSink 写入 decisionaudit；WebRiskCheckAdapter 读取其 actor/operation/scope/time 构建速度窗口。policy 将 null scope 限为同 actor，将有 scope 记录交给 scope_allowed。 |
| 运行结论 | 这是授权决策输入的隔离边界；后续专用角色 policy 是额外收敛，不是删除依据。 |
| 数据/契约责任 | 保存风险速度计算所依赖的 actor 与 scope 决策历史。 |
| 可否删除 | 禁止 |
| 二次复核 | 是：current RLS、表级 grant、actor-less 请求和专用角色 policy 联合测试。 |

- decision audit RLS 修复归 GX-0033。累计 G0 60、G1 83、G2 5、G3 0、GX 33；未删除任何文件。

## GX-0034｜Platform Owner 门店管理权限授予

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除，需专项设计 |
| 对象 | `02_platform_pingtai/database/supabase/migrations/20260821071000_grant_store_administration.sql` |
| 疑似原因 | 文件仅给现有角色补两项既有 permission，可能被误判为重复授权。 |
| 保留证据 | [FACT][E-AU-478] store operation 以 partner.read/manage 为 capability permission；AccessPipeline 根据 rolepermission 决定可调用操作，PartnerOperations 继续以 scope_allowed 限制资源。 |
| 运行结论 | 该映射补齐平台 Owner 的已发布门店职责，后续精确 owner-role 演进不是删除依据。 |
| 数据/契约责任 | 承担平台级门店管理操作的特权授权边界。 |
| 可否删除 | 禁止 |
| 二次复核 | 是：owner 权限全集、deny 覆盖、scope SQL 与审计记录。 |

- platform Owner 门店授权归 GX-0034。累计 G0 60、G1 83、G2 5、G3 0、GX 34；未删除任何文件。

## GX-0035｜Console member manage 与 password assurance 契约

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除，需专项设计 |
| 对象 | `02_platform_pingtai/database/supabase/migrations/20260821072000_add_console_member_commands.sql` |
| 疑似原因 | 文件增加两个 operation 与一项 role grant，可能被误判为纯后台命令目录。 |
| 保留证据 | [FACT][E-AU-479] member-manage 会变更角色/范围/override/状态并撤销会话，password verify 建立当前 session 的时限 assurance；两者均由本迁移能力契约注册。 |
| 运行结论 | 这是身份生命周期和敏感操作 step-up 的必要发布边界。 |
| 数据/契约责任 | 约束高权限成员管理、会话失效和密码重新验证事实。 |
| 可否删除 | 禁止 |
| 二次复核 | 是：owner target、事务原子性、session revoke、assurance TTL/频率与日志。 |

- console member command/assurance 归 GX-0035。累计 G0 60、G1 83、G2 5、G3 0、GX 35；未删除任何文件。

## GX-0036｜Console contract runtime ledger 封板

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除，需专项设计 |
| 对象 | `02_platform_pingtai/database/supabase/migrations/20260821073000_publish_console_contract.sql` |
| 疑似原因 | 文件只更新 checksum 和 migration version，缺少显式前端代码。 |
| 保留证据 | [FACT][E-AU-480] 该 checksum 固定此前 Console operation/permission 变更的 target head；后续控制台专用运行单元读取 runtime ledger 和 operation registry 进行就绪检查。 |
| 运行结论 | 这是发布完整性边界，不是可以脱离迁移序列删除的构建元数据。 |
| 数据/契约责任 | 保存 Console API/授权与目标数据库版本的一致性历史。 |
| 可否删除 | 禁止 |
| 二次复核 | 是：target DB head、runtime readiness、前后端 operation 兼容和恢复流程。 |

- console contract ledger 封板归 GX-0036。累计 G0 60、G1 83、G2 5、G3 0、GX 36；未删除任何文件。

## GX-0037｜Platform Owner Console 只读 operation 授权

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除，需专项设计 |
| 对象 | `02_platform_pingtai/database/supabase/migrations/20260821074000_grant_platform_owner_operations.sql` |
| 疑似原因 | 文件批量移除 deny 并授予 12 项 Owner permission，容易被误判为无约束的特权扩张。 |
| 保留证据 | [FACT][E-AU-481] 固定清单仅包含 read gates；迁移以实际 membership_operations 断言各对应 operation；AccessPipeline 在任何 handler 前按 capability 拦截。 |
| 运行结论 | 这是解决 Owner Console 可用性断链的精确授权，写权限与资源范围仍单独控制。 |
| 数据/契约责任 | 保存 Owner 对控制台只读板块的已发布能力边界。 |
| 可否删除 | 禁止 |
| 二次复核 | 是：role assignment、allow/deny 优先、12项 operation scope 和 Console 发布单元。 |

- platform Owner Console read grant 归 GX-0037。累计 G0 60、G1 83、G2 5、G3 0、GX 37；未删除任何文件。

## GX-0038｜Platform Owner card library read 授权

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除，需专项设计 |
| 对象 | `02_platform_pingtai/database/supabase/migrations/20260821075000_grant_platform_cardlibrary_read.sql` |
| 疑似原因 | 文件只有一项 deny→allow 映射和 ledger 断言。 |
| 保留证据 | [FACT][E-AU-482] 实际 membership capability 断言 voucher.cardlibraries.read；VoucherOperations 使用 pool/allocation scope 查询，card data 保存 ciphertext/fingerprint，写路径独立受控。 |
| 运行结论 | 这是高权限但范围限制的卡券库存读取授权，不是向 Owner 开放卡券写操作。 |
| 数据/契约责任 | 规定平台 Owner 对 cardpool/分配/导入摘要的可见性边界。 |
| 可否删除 | 禁止 |
| 二次复核 | 是：role permission、RLS/allocator scope、卡密字段和审计输出。 |

- platform Owner card-library read grant 归 GX-0038。累计 G0 60、G1 83、G2 5、G3 0、GX 38；未删除任何文件。

## GX-0039｜Platform Owner Cockpit catalog/inventory read 授权

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除，需专项设计 |
| 对象 | `02_platform_pingtai/database/supabase/migrations/20260821076000_grant_platform_cockpit_reads.sql` |
| 疑似原因 | 仅两项 permission 的 deny→allow 变更，表面像 UI 可见性修复。 |
| 保留证据 | [FACT][E-AU-483] Cockpit 是 Console 默认入口；迁移断言实际 membership 能调用 catalog.listings.read/inventory.availability.read，且权限清单明确仅 read。 |
| 运行结论 | 这是默认运营看板的 API 访问边界，不授予任何目录或库存写操作。 |
| 数据/契约责任 | 规定平台 Owner 可读取商品和可用库存的控制台 capability。 |
| 可否删除 | 禁止 |
| 二次复核 | 是：role permission、RLS/scope、UI capability 隐藏与审计。 |

- platform Cockpit read grant 归 GX-0039。累计 G0 60、G1 83、G2 5、G3 0、GX 39；未删除任何文件。

## GX-0040｜Reporting Cockpit 跨域汇总函数

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除，需专项设计 |
| 对象 | `02_platform_pingtai/database/supabase/migrations/20260821077000_add_reporting_cockpit.sql` |
| 疑似原因 | 单个 SQL function 同时读取 reporting、catalog、inventory 和 ordering 数据，且后续出现 overload。 |
| 保留证据 | [FACT][E-AU-484] Dashboard handler 用 AccessPipeline scope 调 ReportingRepository；三参 cockpit 的无 supplier 视图分支回落至该一参函数；函数是 security invoker 且只授予内部角色。 |
| 运行结论 | 这是跨域 read model 的受控所有者边界，overload 为功能演进而非删除依据。 |
| 数据/契约责任 | 汇总运营指标、watermark、趋势和类目份额，并保持调用角色 RLS 语义。 |
| 可否删除 | 禁止 |
| 二次复核 | 是：current function、RLS、跨 scope/tenant、金额/时区、fact watermark 与 UI fallback。 |

- reporting Cockpit read model 归 GX-0040。累计 G0 60、G1 83、G2 5、G3 0、GX 40；未删除任何文件。

## DC-0069｜未接线的 Administrator segment TypeScript project

| 字段 | 记录 |
| --- | --- |
| 分类 | G1：疑似闲置，证据不足 |
| 对象 | `01_core_hexin/services/commerce/tsconfig.admin-segment.json` |
| 疑似原因 | [FACT][E-AU-537-001] 固定基线内未发现 path 文本引用；`@shop/commerce` scripts 只调用全量 `tsc --noEmit`。 |
| 保留证据 | 清单聚焦 Administrator Context Resolver、admin segment Access operations 及相应测试，保留一个可被 `tsc -p` 显式调用的受限检查单元。 |
| 未排除项 | 仓外 CI/本地命令、编辑器 TypeScript project、临时发布 gate、历史兼容或动态配置调用。 |
| 可否删除 | 否；未满足外部调用、构建/运维责任及等价替代条件。 |
| 二次复核 | G1 不强制；升级 G2/G3 前必须检查外部 CI 与实际 quality gate。 |

- Administrator segment TypeScript project 归 DC-0069。累计 G0 60、G1 84、G2 5、G3 0、GX 40；未删除任何文件。

## DC-0070｜未接线的生产命名政策

| 字段 | 记录 |
| --- | --- |
| 分类 | G1：疑似闲置，证据不足 |
| 对象 | `02_platform_pingtai/config/naming.yml` |
| 疑似原因 | [FACT][E-AU-549-001] production regex/exception 值在固定基线中除配置清单外无 script、workflow、release 或 package consumer。 |
| 保留证据 | 仍表达文件/目录命名及 framework exception 的潜在治理契约；外部 delivery policy/人工审查未核验。 |
| 未排除项 | 仓外 CI、delivery agent、LAW 启用标准、历史兼容与人工质量门。 |
| 可否删除 | 否；未满足外部调用、治理责任和等价替代条件。 |
| 二次复核 | G1 不强制；升级 G2/G3 前须查外部质量门并做反事实命名违例检查。 |

- production naming policy 归 DC-0070。累计 G0 60、G1 85、G2 5、G3 0、GX 40；未删除任何文件。

## DC-0071｜Compatibility 旧用户订单读模型

| 字段 | 记录 |
| --- | --- |
| 分类 | G1：疑似闲置，证据不足 |
| 对象 | `02_platform_pingtai/database/storefront-compatibility/supabase/migrations/20260724101500_order_read_model.sql` 中的 `api_order_views` |
| 疑似原因 | [FACT][E-AU-570-001] 固定基线内未发现应用调用；Commerce API 订单和管理读取已调用 later `api_order_views_scoped`。 |
| 保留证据 | 函数仍授予 service_role，返回用户订单/payment allocation/item snapshot；Compatibility migration replay、仓外服务和直连报表均未排除。 |
| 可否删除 | 否；文件本身有历史 migration 职责，函数未满足公共 API、外部调用、契约兼容、可观察行为和独立复核等 G3 条件。 |
| 二次复核 | G1 不强制；任何 cleanup 前必须读取真实 DB dependency/privilege、仓外 consumers，并对比旧/新 response schema。 |

- Compatibility 旧订单读模型归 DC-0071。累计 G0 60、G1 86、G2 5、G3 0、GX 40；未删除任何文件。

## DC-0072｜Compatibility 受限测试目录导入 RPC

| 字段 | 记录 |
| --- | --- |
| 分类 | G1：疑似闲置，证据不足 |
| 对象 | `02_platform_pingtai/database/storefront-compatibility/supabase/migrations/20260725003000_test_catalog_import_rpc.sql` 中的 `api_import_test_catalog` |
| 疑似原因 | 固定基线没有 Compatibility 应用、脚本或测试对该 RPC 的静态调用。 |
| 保留证据 | 它是唯一把 `abo_` 测试项收敛为 is_test/零价/零库存数据的受限 service_role 操作；后续 fix migration、外部 test/load runner 和 Compatibility DB运行状态均未排除。 |
| 可否删除 | 否；未满足外部调用、测试数据职责、历史 compatibility、可观察行为及独立复核等 G3 条件。 |
| 二次复核 | G1 不强制；拟删除前必须检查实际 Compatibility DB function/privilege、test/load pipeline 和数据清理/隔离反事实。 |

- Compatibility 测试目录导入 RPC 归 DC-0072。累计 G0 60、G1 87、G2 5、G3 0、GX 40；未删除任何文件。

## DC-0073｜Compatibility 供应商履约最小 PII 读取 RPC

| 字段 | 记录 |
| --- | --- |
| 分类 | G1：疑似闲置，证据不足 |
| 对象 | `02_platform_pingtai/database/storefront-compatibility/supabase/migrations/20260809094000_supplier_fulfillment_pii_boundary.sql` 中的 `api_supplier_fulfillment` |
| 疑似原因 | 固定基线没有仓内供应商 HTTP route、Worker、脚本或测试调用该 RPC。 |
| 保留证据 | 它是 Compatibility DB唯一明示按 tenant、supplier、sub-order 限制的履约密文快照读取形状；外部履约方、未来 supplier入口、数据库直连/历史运行契约均未排除。 |
| 可否删除 | 否；未满足外部调用、PII最小化数据职责、兼容性、可观察行为与独立复核等 G3 条件。 |
| 二次复核 | G1 不强制；拟删除前必须核验供应商部署、外部适配器、解密/审计边界和真实 DB function/privilege。 |

- Compatibility 供应商履约 PII RPC 归 DC-0073。累计 G0 60、G1 88、G2 5、G3 0、GX 40；未删除任何文件。

## DC-0074｜Storefront Member-Node Projection 的仓内调用缺口

| 字段 | 记录 |
| --- | --- |
| 分类 | G1：疑似闲置，证据不足 |
| 对象 | `identity.resolve_storefront_member_node(text,text)`，由 `20260912182000` 创建、`20260912183000` 修复 |
| 疑似原因 | [FACT][E-AU-700-002] 固定基线的非测试 Commerce/apps/packages/tools/quality source无该 function静态调用。 |
| 保留证据 | 该 function是 `zhudatuanidentityapi` execute-only security-definer boundary，迁移 assertion明确禁止该 API role 对 registration/node/relation 获得 table privilege；v2保留无 registration 的默认 consumer/L6 semantics。 |
| 未排除项 | 仓外 Identity API、direct DB caller、发布制品、未来 route、生产 function dependency/privilege和产品对默认 L6 的要求。 |
| 可否删除 | 否；未满足公共 API、外部调用、兼容责任、可观察行为及独立复核等 G3 条件。 |
| 二次复核 | G1不强制；升级G2/G3前必须核验 production consumer/`pg_depend`/privileges 和真实 Storefront login response。 |

- Storefront Member-Node projection 调用缺口归 DC-0074。累计 G0 60、G1 89、G2 5、G3 0、GX 40；未删除任何文件。

## DC-0075｜公司模板克隆特权边界

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除，需专项设计 |
| 对象 | `organization.clone_company_template(jsonb)`，由 `20260912200000_create_sfl_company_template_clone.sql` 创建；Provisioning `CloneCompanyTemplate`/`CompanyTemplateCloneWorkflow`。 |
| 不能按闲置处理的证据 | function向 `zhudatuanwebapi` 授予直接 execute，创建 enterprise/Mall/Realm/node/account/membership/scope/pool/application/pending binding与 outbox；PG17 contract和fixture证明其完整事务职责。固定基线虽无注册 route/operation consumer，但仓外 caller、direct DB invocation、发布制品和未来 provisioning entry均未排除。 |
| 高风险原因 | security-definer身份/权限边界尚存在 F-0285；任何删除、权限缩减或“未使用”结论都可能破坏 company provisioning、identity topology或幂等回执。 |
| 可否删除 | 否；仅在独立 authorization/design review先确定实际调用者、session context、capability、production dependencies和完整恢复路径后，才可讨论替换/下线。 |
| 二次复核 | 是；专项复核实际 Web API role、connection session setter、production function dependencies/privileges、external provisioning caller和clone data recovery procedure。 |

- 公司模板克隆特权边界归 DC-0075。累计 G0 60、G1 89、G2 5、G3 0、GX 41；未删除任何文件。

## DC-0076｜Identity Catalog Command ACL 的仓内调用缺口

| 字段 | 记录 |
| --- | --- |
| 分类 | G1：疑似闲置，证据不足 |
| 对象 | `20260907010000_enable_identity_catalog_commands.sql` 对 `zhudatuanidentityapi` 的 Catalog table grants/RLS policies。 |
| 疑似原因 | [FACT][E-AU-714-001] 固定基线的 Identity operation catalog、module、route、worker及非测试 source未发现 Catalog import/listing caller；Catalog operator API独立拥有对应路由。 |
| 保留证据 | migration定义 scope-protected grant/policy，可能服务仓外 Identity API、direct DB caller、历史 registration runner或兼容运行契约。 |
| 可否删除 | 否；未满足外部调用、数据库 privilege、历史 migration、可观察行为和独立复核等G3条件。 |
| 二次复核 | G1不强制；拟收窄前必须核验 production `pg_class`/`pg_policies`/role inheritance、connection SQL trace、仓外 callers和 replay requirement。 |

- Identity Catalog command ACL 调用缺口归 DC-0076。累计 G0 60、G1 90、G2 5、G3 0、GX 41；未删除任何文件。

## DC-0077｜Console Support 专用运行面仓内调用缺口

| 字段 | 记录 |
| --- | --- |
| 分类 | G1：疑似闲置，证据不足 |
| 对象 | `console-support.env.example`、`zhudatuan-console-support.service`、`ConsoleSupportMain` 的专用 loopback 4324 运行面。 |
| 疑似原因 | [FACT][E-AU-717-001] release target、service 和 health check仍保留该进程；[FACT][E-AU-717-002] 固定基线 Caddy未将任何公开路由代理到4324；[FACT][E-AU-717-003] Console runtime以 `apiBaseUrl` 调用 canonical `api.fufu.wang`，完整 ApiMain含 SupportModule，未发现其它仓内 client/local caller。 |
| 保留证据 | systemd/release seed/health contract、可能的仓外 localhost consumer、回滚或运维用途均未排除。 |
| 可否删除 | 否；不满足外部调用、发布/运维责任、可观察行为和独立复核等G3条件。 |
| 二次复核 | G1不强制；任何退役前在生产节点只读核验 service state/listeners/local access log、release history、Caddy active config与运维文档。 |

- Console Support 运行面调用缺口归 DC-0077。累计 G0 60、G1 91、G2 5、G3 0、GX 41；未删除任何文件。

## DC-0078｜hbbtzn L1 Caddy 路由片段的仓内接入缺口

| 字段 | 记录 |
| --- | --- |
| 分类 | G1：疑似闲置，证据不足 |
| 对象 | `02_platform_pingtai/infrastructure/projects_xiangmu/hbbtzn/deployment/sfl-l1-console-routes.caddy` 与 `sfl-l1-storefront-routes.caddy`。 |
| 疑似原因 | 固定基线的当前 Caddy 主配置、发布配置和自动化脚本没有导入这两份 snippet。 |
| 保留证据 | hbbtzn project identity 是 preserved/release-ineligible 的配置型租户；片段要求 alias Worker 提供 L1 node/surface headers，可能由仓外节点 Caddy、DNS/Worker、历史回滚或租户恢复流程装载。 |
| 可否删除 | 否；未满足外部配置引用、发布/回滚职责、租户隔离行为和独立复核等 G3 条件。 |
| 二次复核 | G1 不强制；拟变更前只读检查 hbbtzn 节点 active Caddy import、alias Worker header 发放、访问日志、release history 与恢复 runbook。 |

- hbbtzn L1 Caddy 片段归 DC-0078。累计 G0 62、G1 92、G2 5、G3 0、GX 41；未删除任何文件。

## DC-0079｜Storefront compatibility 旧 PM2/备份运行面

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除，需专项设计 |
| 对象 | `02_platform_pingtai/infrastructure/storefront-compatibility/aliyun/` 的 legacy PM2 configs、backup env、`smart-wing-postgres-backup.service`/`.timer`、部署文档及关联 `deploy.sh`。 |
| 不能按闲置处理的证据 | current `zhudatuan` delivery 把该目录列为 forbidden input，但 `purchase-deployment.mjs` 仍读取 legacy `deploy.sh`，以断言旧 Caddy reload 路径未重新进入新 release control-plane；timer/service 可由仓外 systemd 注册；文档保留异云 PostgreSQL恢复步骤。 |
| 高风险原因 | 资产涉及 root systemd、数据库备份 DSN、OSS/RAM 凭据、Caddy reload、PM2 进程与历史 hbbtzn 域名；仅凭当前新控制面排除它不能证明不存在回滚、备份恢复或仓外主机消费者。 |
| 可否删除 | 否；必须先在独立 legacy-runtime retirement design 中只读核验主机 PM2/systemd timer、OSS bucket/备份恢复链、release history、实际运营 runbook和现有 smart-wing consumers。 |
| 二次复核 | 是；专项复核必须独立确认旧基础设施是否仍存在，以及移除后如何保留可恢复备份和已发布版本。 |

- Storefront compatibility 旧运行面归 DC-0079。累计 G0 62、G1 92、G2 5、G3 0、GX 42；未删除任何文件。

## DC-0080｜未见仓内启动者的浏览器 MVP fixture server

| 字段 | 记录 |
| --- | --- |
| 分类 | G1：疑似闲置，证据不足 |
| 对象 | `03_quality_ceshi/tests/browser/MvpServer.mjs`。 |
| 疑似原因 | 固定基线 browser source 未找到对该文件的静态 import/spawn 或正式 test 配置引用。 |
| 保留证据 | 它实现完整 loopback 商品、购物车、报价、订单与模拟支付 HTTP fixture，可能由仓外/手动 E2E 命令、历史验收或未来 browser suite 启动；仅凭静态无引用不足以判断无运行责任。 |
| 可否删除 | 否；需先复核 quality runbook、CI test selection、历史验收命令与当前手动 MVP 验收需求。 |
| 二次复核 | 否；升级前需确认静态引用、npm scripts、CI workflow和测试负责人实际使用。 |

- Browser MVP fixture server 归 DC-0080。累计 G0 62、G1 93、G2 5、G3 0、GX 42；未删除任何文件。

## DC-0081｜隔离依赖准备辅助脚本的仓内启动缺口

| 字段 | 记录 |
| --- | --- |
| 分类 | G1：疑似闲置，证据不足 |
| 对象 | `04_tools/release-engine/adapters/zdt-next/prepare-isolated-dependencies.sh` 与其唯一仓内下游 `assert-workspace-isolation.mjs`。 |
| 疑似原因 | 固定基线的 release manifest、CLI、GitHub workflow、README 和脚本 source 未找到对 prepare shell script 的静态启动；isolation assertion 仅由该 shell script 调用。 |
| 保留证据 | 脚本在隔离工作树创建 hard-link 复用的 `node_modules`，随后拒绝指向 workspace 外的 package symlink；可能由仓外 `zdt-delivery`、构建宿主 bootstrap、人工受控恢复或未纳入仓内的 release policy 调用。 |
| 可否删除 | 否；未满足外部调用、构建宿主、恢复职责、可观察行为及独立复核等 G3 条件。 |
| 二次复核 | G1 不强制；若拟收敛，先只读核验当前 `zdt-delivery` 实现、构建机 bootstrap logs、release runbook 与最近 delivery receipt 的实际 argv。 |

- 隔离依赖准备辅助脚本归 DC-0081。累计 G0 62、G1 94、G2 5、G3 0、GX 42；未删除任何文件。

## DC-0082｜Linux readiness 的 root/systemd 隔离演练 fixture

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除，需专项设计 |
| 对象 | `04_tools/release-engine/test/linux-readiness-fixture.mjs`。 |
| 仓内接入情况 | 未找到该 fixture 或其 `AI_DELIVERY_FIXTURE_*` 环境变量的仓内静态启动者。 |
| 保留/高风险证据 | 仅 Linux root 可启动；输入强制收窄到 `/opt/ai-delivery/fixtures/readiness-*`、随机 service name 和高位端口。它会创建 systemd transient target/sentinel units、写入测试 policy/releases/layers、执行 candidate activation/rollback/hard-fail/timeout，并在前后 snapshot `sfl-*hbbtzn-l1*` 受保护进程及 `/opt/sfl` pointers，断言不变。 |
| 可否删除 | 否；即使无静态引用，它也可能由仓外 release host/CI 演练入口执行，且承担真实 readiness/rollback 事故演练与生产邻接隔离证明。 |
| 二次复核 | 是；在专用、非生产 Linux host 上独立核验实际 launcher、root/systemd namespace、随机端口冲突、fixture cleanup receipt、受保护单元/指针只读快照和失败恢复；不得在生产节点或审计工作树执行。 |

- Linux readiness fixture 归 DC-0082。累计 G0 62、G1 94、G2 5、G3 0、GX 43；未删除任何文件。

## DC-0083｜数据库对象合同生成器的正式入口缺口

| 字段 | 记录 |
| --- | --- |
| 分类 | G1：疑似闲置，证据不足 |
| 对象 | `04_tools/scripts/audit/build-database-object-contract.mjs`。 |
| 疑似原因 | 固定基线未找到 package script、GitHub workflow 或 release manifest 对该生成器的静态调用；现有 governance 台账同样登记它为 generator-no-entry。 |
| 保留证据 | 它按 migration SQL 静态推导 schema/table/view/function/trigger/policy/grant 并重写 `database/contracts/objects.yml`；该清单被 database callgraph、mall-provisioning deployment、JourneyHarness、database-contracts 与 P0 verifier 消费。 |
| 可否删除 | 否；生成器可能由人工/仓外数据库契约流程运行，且直接影响 3 万行对象清单和多个发布/质量 gate。 |
| 二次复核 | G1 不强制；拟收敛前必须确认 Database Contract Owner、当前权威生成入口、migration replay/catalog diff 证据和重生成是否可得到无差异 output。 |

- 数据库对象合同生成器归 DC-0083。累计 G0 62、G1 95、G2 5、G3 0、GX 43；未删除任何文件。

## DC-0084｜财务会计完整性集成验证的仓内入口缺口

| 字段 | 记录 |
| --- | --- |
| 分类 | G1：疑似闲置，证据不足 |
| 对象 | `04_tools/scripts/audit/finance-accounting-integrity.mjs` 的 `verifyFinanceAccountingIntegrity(database)`。 |
| 疑似原因 | 固定基线未找到 import、package script、workflow 或 release manifest 对该函数/文件的仓内启动。 |
| 保留证据 | 它直接观察 fully replayed PostgreSQL 的 posting、trial balance、subledger、append-only reversal/correction、period close、reconciliation/outbox/job 状态与 EXECUTE 边界；删除会丢失唯一的高精度财务回归规格。 |
| 可否删除 | 否；可能由仓外财务验收、数据库 fixture runner 或人工受控审计调用。 |
| 二次复核 | G1 不强制；拟收敛前确认 Finance Owner 的验收入口、最近 isolated replay receipt、CI/外部 runner 和当前 ledger/period-close contract。 |

- 财务会计完整性验证归 DC-0084。累计 G0 62、G1 96、G2 5、G3 0、GX 43；未删除任何文件。

## DC-0085｜Identity mobile 一次性生产数据修复 SQL

| 字段 | 记录 |
| --- | --- |
| 分类 | GX：高风险，禁止删除，需专项设计 |
| 对象 | `identity-mobile-consistency.sql` 与 `identity-mobile-consistency-repair.sql`。 |
| 风险/保留证据 | 前者只读找出 active account/password credential/profile/session 的 mobile/realm 一致性偏差；后者明确锁定四个 L0/L1 account，要求恰为四项 credential mismatch 且无 realm collision，随后更新 `subject_hash`、轮换时间、credential/account version 并撤销所有未撤销会话。 |
| 仓内接入情况 | 固定基线未发现 package/workflow/release manifest 的静态执行入口；不能据此排除人工 DBA、事故修复、迁移验收或仓外 runbook 消费。 |
| 可否删除 | 否；删除可能消灭身份迁移回滚/恢复所需的精确历史修复方案，也不能证明目标数据已永久收敛。 |
| 二次复核 | 是；任何运行或退役前必须在只读 production snapshot 核验四个 account、realm/mobile token、credential collision、profile/session 映射、最近登录/业务影响和备份/恢复方案，并由 Identity Owner 独立批准。 |

- Identity mobile consistency repair 归 DC-0085。累计 G0 62、G1 96、G2 5、G3 0、GX 44；未删除任何文件。

## DC-0086｜AutoNode 候选节点隔离证据生成器的自动入口缺口

| 字段 | 记录 |
| --- | --- |
| 分类 | G1：疑似闲置，证据不足 |
| 对象 | `04_tools/scripts/check/autonode-candidate.mjs`。 |
| 疑似原因 | 固定基线未发现根 package script、GitHub workflow、release manifest 或其它生产入口对该 CLI 的静态调用；脚本注释要求人工提供 candidate output root 或 Console artifact。 |
| 保留证据 | 它调用 candidate-only `FileNodeProvisioningEngine`，验证三个不同 node/realm/data-scope/manifest、唯一端口、同一 immutable artifact、五次并发幂等和单节点 rollback 隔离；治理台账明确将其归入人工隔离预览、无根自动入口，不能从无自动入口推断无业务/恢复责任。 |
| 未排除项 | 仓外候选验收、人工发布负责人流程、历史/未来 node provisioning 演练，以及其作为 `autonode-engine` 高层隔离规格的唯一性。 |
| 可否删除 | 否；未满足公共/运维契约、替代、可观察行为和第二次复核条件。 |
| 二次复核 | G1不强制；拟收敛前必须确认当前 Node Delivery Owner 的候选验收入口、artifact provenance 要求、受控临时目录策略与最近隔离演练回执。 |

- AutoNode candidate evidence generator 归 DC-0086。累计 G0 62、G1 97、G2 5、G3 0、GX 44；未删除任何文件。

## DC-0087｜本地预览数据库与运行时检查器的自动入口缺口

| 字段 | 记录 |
| --- | --- |
| 分类 | G1：疑似闲置，证据不足 |
| 对象 | `04_tools/scripts/check/local-preview-database.mjs`、`local-preview-runtime.mjs`。 |
| 疑似原因 | 固定基线未发现根 package script、GitHub workflow 或 release manifest 自动调用。 |
| 保留证据 | database checker只接受 loopback URL并使用 `begin read only`；runtime checker提供候选变更归属、lockfile、migration ledger和本地端口/worktree attribution，且治理台账标为人工隔离预览工具。 |
| 未排除项 | 当前或未来本地 preview操作者、外部开发脚本、candidate evidence与历史兼容流程。`--prepare-runtime-config`的 local secret 改写也说明其不能被当作无职责文本删除。 |
| 可否删除 | 否；未满足运维责任、替代、可观察行为和第二次复核条件。 |
| 二次复核 | G1不强制；拟收敛前由 Local Preview Owner 确认当前 branch/base/preview topology、secrets policy和是否已有替代工具。 |

- Local preview checkers 归 DC-0087。累计 G0 62、G1 98、G2 5、G3 0、GX 44；未删除任何文件。
