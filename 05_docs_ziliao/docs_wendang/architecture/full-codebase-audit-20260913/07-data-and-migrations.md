# 全代码库系统审计｜07 数据、事务与迁移

## 1. 当前覆盖

本版是AU-005的数据基础设施层，不是业务表全审。纳入PostgreSQL创建/代理/连接/事务、runtime共享表、Local Objects与恢复责任；各业务schema、字段约束和357份迁移的逐文件语义仍待后续单元。

## 2. 数据所有权

| 资产 | 逻辑owner | 写入者 | 读取者 | 边界 |
| --- | --- | --- | --- | --- |
| 业务schema | 各领域模块，待逐模块确认 | API/Jobs/迁移role | 对应模块及许可的read model | 同一PostgreSQL共享实例，不等于共享所有权 |
| runtime.outbox | runtime平台保存、业务aggregate产生事实 | 业务事务 | OutboxRelay | 通用relay正式入口缺失F-0022 |
| runtime.inbox/job | runtime平台 | RuntimeEventPublisher、scheduler、直接job producer | dedicated/aggregate workers | consumer/kind/scope逻辑隔离 |
| runtime.lease/deadletter | runtime平台 | scheduler/workers | 运维与workers | 恢复/人工review责任待明确 |
| Local Objects bytes/metadata/path | node-local object service | 持有object bearer的workloads | 同node API/Jobs；public签名读 | L0/L1目录和token分离；同物理host |
| Catalog media OSS | Catalog模块逻辑拥有 | media replication job | 前端/渠道消费者待专项 | 与Local Objects不同provider边界 |

完整表见 `records/AU-005-shared-state-infrastructure-map/data-infrastructure-map.csv`。

## 3. 事务与并发

- [FACT] command使用serializable transaction，锁键先去重排序，再取进程锁和PostgreSQL advisory lock；只重试serialization/deadlock并最终释放或销毁连接。
- [FACT] outbox与业务写同事务；inbox去重与每个handler job enqueue同事务。enqueue提交后、mark published前崩溃可由inbox幂等重放。
- [CONFLICT] generic job claim不接受过期running，正式Catalog export走该分支；cleanup虽能重排，却没有正式aggregate worker，形成F-0024。
- [HYPOTHESIS] heartbeat更新失败被吞后，旧processor可能与新lease owner并行；外部副作用幂等必须逐processor审，当前不定级。

## 4. 创建与迁移冲突

[CONFLICT][E-AU-005-010] production Compose固定PostgreSQL 17，首次空卷加载的registration init脚本却只接受16，并携RDS address/boundary-role前置；example和Compose无法从零提供完整前置。PG16 fixture和deployment checker没有覆盖这组生产组合，形成F-0023/P1候选。

这不证明现有非空volume当前不能启动；也不授权修改既有迁移、ledger或生产volume。独立复核必须使用一次性隔离新卷。

## 5. 对象数据一致性

- bytes以SHA-256命名并由temporary rename提交，完整性设计清晰。
- metadata和path在rename后分别写入，没有文件系统事务；中途崩溃恢复工具未见。
- metadata也只按SHA-256唯一，却包含path/contentType；相同bytes后写覆盖旧metadata，形成F-0027。
- 上传分片只在进程内Map，重启后未完成上传不可恢复；已完成对象保留。

## 6. 恢复与未知项

仓库内未发现当前zhudatuan PostgreSQL、Local Objects、secret catalog或KMS master key的备份创建/restore演练入口；只证明路径和服务restart。云快照、主机外timer或人工runbook可能存在，因此统一标记UNKNOWN，不写成“没有备份”。责任矩阵见 `recovery-ownership.csv`。

## 7. AU-006 迁移与配置所有权补充

- MigrationEnvironment提供通用DATABASE_MIGRATION_CONNECTION_REF与迁移目录投影；RegistrationMigrationEnvironment进一步限制production、loopback、目标schema/ledger和节点refs。实际数据库迁移执行与ledger原子窗口仍以AU-003/F-0013为准，本AU未重放迁移。
- 节点Manifest、registry declaration、cache/capacity YAML都是配置数据，但不属于业务数据库事实。它们的生成、digest和runtime pointer不能代替数据库migration ledger。
- [CONFLICT][E-AU-006-006] registry嵌套声明在进程内可变，但文件和数据库不会被该探针写入；重启会恢复固定JSON。风险是运行期事实漂移，不是持久数据损坏。
- [UNKNOWN] 线上migration env、Manifest文件与数据库schema head的一致性未读取；不能从example推断live。

## 8. AU-007 契约发布与数据库投影

- [FACT][E-AU-007-003/013] `database/contracts/current.sql` 是 contractgen 的 tracked 输出：它发布 271 个 runtime Operation 与 67 个 Event，并从 Operations 生成 capability/binding；74 个 frozen Operation 不进入运行发布面。
- [FACT] `capabilities.yml` 不生成数据库 capability 行，因此其存在或漂移不能直接代表数据库当前授权状态。
- [CONFLICT][E-AU-007-007] `CONTRACT_CHECKSUM` 的 Event 投影遗漏 schema 与 handlers；反事实修改两者会改变数据库 event 行或运行 handler registry，但 checksum 不变，形成 F-0039。
- [UNKNOWN] tracked `current.sql` 只证明期望发布内容，不证明任一环境已执行、ledger 已登记或数据库当前行与之相同。旧 checksum 与当前输出不同也因历史移除 runtime 阻断职责而不能单独定级为事故。

本 AU 未执行迁移、未连接数据库，也未修改既有 migration 或 ledger。

## 9. AU-008 生成数据库快照边界

- [FACT][E-AU-008-003/012] `database/contracts/current.sql`包含271个runtime Operation、67个Event及由Operation投影的capability/binding；仓内精确消费者只有contractgen写端和`VoucherTargetContract.test.ts`读端。
- release candidate、migration runner、服务启动入口和受管迁移目录均未加载该文件。它当前是tracked生成快照与测试oracle，不是已证明的迁移。
- [UNKNOWN] 历史或仓外人工流程是否直接应用该SQL；因此不能删除、执行或把它当作恢复入口。若未来调查，必须先对账migration ledger、操作者流程和数据库现状。
- 本AU未执行SQL、迁移或数据库连接，也未修改ledger。

## 10. AU-009 Kernel 数据边界

- Kernel 40文件没有数据库连接、SQL、migration或表所有权。Entity/Aggregate/DomainEvent只是进程内领域端口；真实持久化由Commerce repository/OutboxStore拥有。
- [FACT] `domainEvent`浅冻结envelope和payload外壳；当前OutboxStore在调用数据库前同步 `JSON.stringify`。本AU未观察到持久化前的异步mutation窗口，但nested payload、BigInt/cycle与事务语义仍留给事件/领域专项。
- Money使用safe-integer minor unit并检查加减乘溢出，是值得保留的金额边界；运行时可变Currency目录属于进程一致性F-0032，不是迁移问题。
- [INFERENCE][E-AU-009-005] F-0048的风险位于外部provider副作用：本地dispatch唯一性无法回滚同一次执行内部的第二个无键POST。当前没有证据证明产生重复数据库行。

## 11. AU-010 权限数据、快照与迁移接缝

- Authz包本身不连接数据库、不拥有表、不写migration。`access.permission`、role、rolepermission、membershiprole、membershipoverride、scopegrant和decisionaudit由PostgreSQL Access域拥有；organization closure/scope_object拥有canonical Scope投影。
- [FACT][E-AU-010-007] PgMembershipResolver在一个materialized查询中返回grants/denies和数据库`evaluated_at`；Policy对effective/expiry复用同一时间，避免应用时钟与多行读取漂移。Session projection和current membership version另行核对。
- [FACT][E-AU-010-012] access/credential version为PostgreSQL bigint，pg运行时返回string而TS端口声明number；当前三路比较通常同型通过，数据adapter真实性问题见F-0057。
- [P1-CANDIDATE] F-0053成功路径会写rolepermission、membershiprole/scopegrant并递增目标access_version；未来修复若需处理已有越界custom role，必须另做受管、可逆的数据清单，不能在审计分支直接删除或改角色。
- [P2] F-0055的normal路径缓解来自`scope_object`和closure；是否已有缺tenant、错误closure或跨表ID冲突是线上数据UNKNOWN，本AU未连接数据库、未重放migration。
- ModuleCatalog解析在内存中完成，失败无数据库半状态；35份manifest是否未来驱动migration/startup仍UNKNOWN。

## 12. AU-011 兼容权限数据与迁移责任

- `@smart-wing/authz`本身无SQL或事务；输入由兼容`public.memberships/public.permissions/public.role_permissions/public.membership_scopes`及资源Scope RPC投影，数据所有权在兼容PostgreSQL面。
- [FACT][E-AU-011-007] custom role创建/更新/assign会比较actor effective permission并检查可授Scope，避免非Owner向上转授；该机制是历史数据责任，禁止因当前正式runtime退役就删除相关迁移。
- canonical `@shop/authz`使用`access.*`角色、override、scopegrant与organization closure。两个模型只有8个permission code重合；未核对线上双写、迁移ledger或退役数据，因此不存在“已完成迁移”的事实。
- 本AU未连接数据库、执行SQL、重放迁移或修改ledger；线上是否仍有兼容role/membership数据保持UNKNOWN。

## 13. AU-012 分类与兼容契约数据接缝

- api-contract本身不连接数据库，但permission code、Membership/Scope类型和taxonomy code分别约束兼容Access RPC、资源Scope与商品分类投影。
- [CONFLICT][E-AU-012-004/008] 数据库迁移明确创建`digital_mobile`并把手机配件映射为`digital_mobile_accessory`；JSON leaves保留该路径，但categories树漏掉L2父节点。不能通过删除叶子规避，因为它承担现有数据code兼容责任。
- [FACT][E-AU-012-011] payment status mapper只做响应投影，不写订单或支付状态；事务、退款与对账仍由数据库函数拥有。
- 本AU未连接数据库、统计线上商品、执行迁移或修改任何code映射。

## 14. AU-013 遥测数据所有权

- `ClientErrorBuffer`只拥有进程内Map，按fingerprint聚合并按retention裁剪；服务重启后不可恢复。历史资料把它描述为可清理缓冲，本AU没有足够证据把非持久化定为缺陷。
- Operation audit由Commerce审计sink/数据库拥有；Telemetry Redactor只负责写前投影。F-0065意味着敏感字符串可能进入持久化审计，但本AU未读取线上表或证明已有真实记录。
- Telemetry包没有迁移、事务或数据库连接；本AU未执行SQL、迁移或数据修复。

## 15. AU-020 微信支付数据所有权

- `@shop/wechatpayment`不连接数据库、不拥有表或迁移；它只产生经签名核验的provider observation/evidence。
- 支付意图、退款、provider event、job和outbox由Commerce payment/runtime数据库contract拥有。Webhook在本地scope、金额、currency、payer/application hash和intent/refund证据匹配后才接受事件，并按`consumer + event_id`去重。
- 退款申请使用稳定`outRefundNo`；provider响应不确定时转查询而非重复申请，降低重复资金写入风险。F-0092可能延迟查询恢复，但未证明重复扣款或账务写错。
- 本AU未连接数据库、运行迁移、重放通知或修改支付数据。

## 16. AU-021 Channel Webhook数据边界

- Provider Core本身不拥有表；`channel.webhookinbox`以`connection_id + external_id`唯一，原文由KMS加密保存，raw/signature hash用于证据，新增inbox原子排入channelwebhook job。
- Job按inbox ID幂等，但不同event ID会产生不同inbox/job/outbox。F-0094证明相同签名正文改ID可越过唯一键；数据库当前没有同connection+raw hash或signature hash去重。
- provideroperation按provider+external reference更新，能缓解部分重复状态覆盖；outbox仍按inbox ID独立产生，下游最终幂等尚未确认。
- 本AU只读迁移和调用SQL，没有连接数据库、执行迁移、插入或重放事件。

## 17. AU-022 Vendor Core数据边界

- Vendor Core不拥有数据库表或迁移；connection配置由Channel模块持久化，业务商品/订单/履约数据仍由各领域contract拥有。
- Client仅对读请求、带business idempotency key的写入或明确幂等operation执行重试；无key的非幂等写入只尝试一次。该边界可降低重复写入，应保留。
- F-0097可能使远端已处理、本地尚未解析的写入进入不确定状态；具体恢复取决于各vendor查询能力和幂等键，不能统一推断为重复业务数据。
- 本AU未连接数据库、执行迁移、调用vendor或修改connection。

## 18. AU-023 Cakeuncle数据边界

- 包不拥有表或迁移；Cake/Flower/Meal返回源目录/价格/库存记录，由Commerce catalog投影拥有。connection与secret引用由Channel/Extension层拥有。
- 非幂等调用发生可重试Transport错误时被转换为`CAKEUNCLE_WRITE_OUTCOME_UNKNOWN`且不重试，这是防止重复远端写入的有效边界。
- F-0100显示Foodvoucher写ports被发布，但其协议与数据状态契约未闭合；未核实线上installation前，不推断实际发行、退款或核销数据已错误。
- 本AU未执行SQL、迁移、远端写入、Webhook重放或数据修复。

## 19. AU-024 Foodvoucher数据边界

- Provider包不拥有表/迁移；Catalog源数据进入Channel/Catalog，Statement进入Channel/Finance，Webhook进入Channel inbox/job。卡券发行与核销的本地Voucher数据由Commerce voucher模块拥有，当前未找到其调用provider verification/order port的静态链。
- F-0103主要造成目录/价格缺失或同步失败，不直接删除既有数据。F-0100的Statement/Webhook可达链可能造成对账或状态停滞，但线上启用与真实数据影响未知。
- 历史专用Mapper曾校验产品ID唯一、金额精度和字段shape；当前通用Mapper仅要求canonical records字段，这些供应商特定不变量不再存在于运行代码。
- 本AU未查询、写入或迁移任何数据库，也未调用供应商。

## 20. AU-025 Cake数据边界

- Cake只产生Catalog/Price/Stock observation；Catalog/Channel/Inventory拥有落库数据，包无表或迁移。
- F-0105可漏掉源商品且无error记录；F-0106造成更新停滞/延迟，未证明覆盖或删除既有数据。
- 本AU未执行SQL、迁移、同步或供应商调用。

## 21. AU-026 Flower数据边界

- Flower包不拥有表或迁移，只产生Catalog/Price/Stock观测；持久数据由Channel、Catalog、Pricing和Inventory模块拥有。
- F-0108可能漏源商品，F-0109可能延迟价格库存，F-0110会让不满足下游价格约束的目录记录失败；固定基线没有证明已覆盖或删除既有记录。
- 本AU未执行SQL、迁移、同步或供应商调用。

## 22. AU-027 Meal数据边界

- Meal包没有表或迁移；Catalog菜单记录进入Channel/Catalog，Price进入Pricing，持久数据由对应Commerce模块拥有。
- Mapper对坏商品返回显式record error，Channel在同一事务写好记录并累计rejected；F-0112/F-0113主要造成运行期失败、延迟或旧价格，不直接删除既有数据。
- OrderDraft不在运行入口，当前没有本地订单写入责任。
- 本AU未执行SQL、迁移、同步或供应商调用。

## 23. AU-028 Book数据边界

- Book包没有表或迁移；Catalog/Price/Inventory/Statement由Channel及对应Commerce模块落库，Fulfillment拥有订单与里程碑状态。
- F-0116发生在外部订单可能已提交、本地已写accepted之后；tracking在读取供应商前失败，本地可能长期没有milestone/completed状态。
- Return/Refund当前无固定caller，未证明已产生退款或逆向单数据。
- 本AU未执行SQL、迁移、同步、下单或供应商调用。

## 24. AU-029 Directcharge数据边界

- Directcharge包没有表或迁移；Catalog/Statement由Channel及对应Commerce模块落库，Fulfillment拥有订单状态，验券/退款的本地数据责任未形成固定caller。
- F-0119在调用万联前拒绝，直接影响是履约失败而非供应商侧半完成；线上重试和失败记录尚未核验。
- 本AU未执行SQL、迁移、同步、直充、退款或供应商调用。
