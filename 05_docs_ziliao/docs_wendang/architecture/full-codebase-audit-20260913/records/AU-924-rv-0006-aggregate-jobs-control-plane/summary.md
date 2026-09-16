# RV-0006｜聚合 Jobs 控制面独立复核

- 复核日期：2026-09-15
- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 对应候选：GX-0001
- 结论：**维持 GX，禁止删除；未发现新的 P0。**
- 方法：从聚合进程入口重追registry、outbox发布、周期调度及部署目标；不改变任何运行单元。

## 唯一职责

`JobsMain`与`FullJobsMain`都启动全模块Jobs registry，并且是当前源码中唯一同时构造`OutboxRelay(RuntimeEventPublisher)`与`RuntimeScheduler`的入口。Relay将持久outbox事件经inbox去重转换为`runtime.job`；Scheduler以租约执行券/权益到期、清理等周期任务。两者都不是重复的空壳。

## 运行与部署证据

聚合入口检查已注册Jobs与`JOB_CATALOG`一致，再启动各worker、relay和scheduler。正式部署只提供catalog/payment/identity notification等专用Jobs目标；staging的full-jobs unit被`ExecCondition=/usr/bin/false`明确阻断。该接线缺口已由F-0022/RV-0004单独记录，不把它误认成无用代码证据。

## 裁决

这些文件承载持久事件投递、inbox去重、队列化、周期任务、租约与恢复语义。删除会破坏唯一的恢复与异步契约，不能列为G3或任何可删除候选。后续只能在最新主线以专门的Jobs控制面设计批次处理运行目标接线；审计分支不修复、不删除。
