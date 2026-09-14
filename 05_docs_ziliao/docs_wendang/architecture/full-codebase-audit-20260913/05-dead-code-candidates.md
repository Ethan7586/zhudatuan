# 全代码库系统审计｜05 垃圾代码候选

## 1. 当前口径

AU-005 首次建立候选总账。零静态引用、零正式target或测试只调用某实现都不能单独证明可删除；数据、迁移、兼容、运维、唯一契约和恢复责任必须同时排除。本文件只记录已经进入G0–GX判定的对象，不等于删除计划。

当前累计：G0 60、G1 79、G2 4、G3 0、GX 5。没有任何已满足13项删除条件并完成第二次独立复核的G3。

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
| 分类/对象 | G1；`mall_application_versions`、`mall_application_heads` 与 `api_mall_application_{center,experience,mutate}` 的后续 schema-v2 版本。 |
| 疑似原因 | 固定基线未发现 Commerce API、Console、Miniapp 或 Worker 对这三个 RPC/表的直接调用；商城应用的另一套 Commerce experience 模型仍在运行源码中。 |
| 保留证据 | 迁移建立不可变版本、发布投影、幂等、乐观并发、审计和 service-role 公共 RPC；schema-v2 契约测试直接覆盖 create/save/publish/restore。仓外 service-role、已发布前端和迁移数据责任均未排除。 |
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
