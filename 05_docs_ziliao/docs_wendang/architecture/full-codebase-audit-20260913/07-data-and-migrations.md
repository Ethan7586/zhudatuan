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
