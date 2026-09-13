# 全代码库系统审计｜05 垃圾代码候选

## 1. 当前口径

AU-005 首次建立候选总账。零静态引用、零正式target或测试只调用某实现都不能单独证明可删除；数据、迁移、兼容、运维、唯一契约和恢复责任必须同时排除。本文件只记录已经进入G0–GX判定的对象，不等于删除计划。

当前累计：G0 1、G1 4、G2 0、G3 0、GX 1。没有任何已满足13项删除条件并完成第二次独立复核的G3。

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

## 2. G3 条件对账

上述G0、G1和GX项均不满足“无公共/事件契约、无数据责任、存在等价替代、删除不改变可观察行为、已完成第二次复核”等条件。AU-006未对任何文件提出删除、归档或移动建议。
