# 全代码库系统审计｜05 垃圾代码候选

## 1. 当前口径

AU-005 首次建立候选总账。零静态引用、零正式target或测试只调用某实现都不能单独证明可删除；数据、迁移、兼容、运维、唯一契约和恢复责任必须同时排除。本文件只记录已经进入G0–GX判定的对象，不等于删除计划。

当前累计：G0 2、G1 12、G2 1、G3 0、GX 1。没有任何已满足13项删除条件并完成第二次独立复核的G3。

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

上述G0、G1、G2和GX项均不满足“无公共/事件契约、无数据责任、存在等价替代、删除不改变可观察行为、已完成第二次复核”等条件。AU-012未对任何文件提出删除、归档或移动建议。
