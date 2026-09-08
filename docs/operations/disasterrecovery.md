# 灾难恢复运行手册

## 触发症状、用户影响与严重级

区域不可达、主数据库与同步备同时失效、Redis/队列大面积丢失、对象存储区域故障、CDN/边缘失效、Secret/KMS 不可用或多个 Provider 同时中断时触发。核心交易不可用或事实完整性未知为 P0；可安全降级的非核心能力为 P1。

## Owner 与前置权限

Incident Commander 统一决策，Reliability 负责区域编排，Database、Security、Edge、Object、Provider 及领域 Owner 执行各自检查。启用灾备区、Breakglass、DNS 切换、Key 恢复和 Provider 暂停均须双人审批、短时权限与不可变审计。

## 只读诊断

按层确认：边缘 DNS/TLS/源站、Api/Jobs/Provider/Migration、PostgreSQL 同步点、Redis 与队列、对象复制点、Secret/KMS 健康、Telemetry 可达性、11 Provider 状态。记录最后一致事务、Outbox/Inbox 位点、任务租约、CDN Head 和每个数据面的恢复点，不把 Redis 或缓存当权威事实。

## 止血

优先停止不确定写和重复外呼；保持查询或切只读。按顺序关闭低价值实时统计、延迟导出/同步、把受影响 Provider 商品切只读、限制新营销。不得关闭授权、幂等、库存预占、支付确认、凭证 Hold 或账本平衡。隔离受损区域并冻结 DNS、配置、Secret 和迁移变更。

## 恢复

1. Secret/KMS：确认 Key 版本和工作负载身份，禁止导出 Key 值。
2. PostgreSQL：在温备区提升已核对节点，或按 `restore.md` 新建恢复；确认 fencing 阻止旧主写。
3. 对象：切到已复制版本，缺失对象保持不可下载并排队重建。
4. Redis/队列：从 PostgreSQL 权威任务、Outbox 和会话策略重建；旧租约全部失效。
5. Api/Jobs/Provider：先 Api 只读，再 Jobs，最后按 Provider 单独 Canary；Extension 凭据重新租赁。
6. CDN/Edge：发布同 releaseId 的已签名六端制品并原子切 Head；DNS 分级切换。

## 数据核对

运行订单、库存、支付、账本、凭证、福利、Scope、Outbox/Inbox、报表和审计十项不变量；核对对象版本、配置/Manifest Hash、任务 fencing、Provider 游标和迟到回调。每阶段证据通过后才扩大流量。

## 回滚边界

灾备区未承接写前可回原区域；承接写后必须以 fencing 确保单写主，禁止双主合并。已确认领域事实只能补偿/冲正。对象或 CDN 可回指旧签名版本；数据库 Retire 后只前向修复。

## 沟通模板

“灾备事件 `{incidentId}`，严重级 P0，故障层 `{layers}`，当前权威区域 `{region}`，安全模式 `{readonlyOrPaused}`，数据恢复点 `{recoveryPoint}`，预计 RTO `{rto}`，下一流量门 `{gate}`，负责人 `{owner}`。”

## 关闭条件

单写主和 fencing 已证明；六端与四进程健康；十项不变量、Provider 对账和对象 Hash 全部通过；流量 100% 且观察窗无燃尽告警；RPO 0/RTO 15 分钟结果、审批、通信和证据完成归档。

## 复盘链接

每次灾备启用或季度演练建立 `{postmortemUrl}`，记录各层恢复耗时、未达目标原因、人工步骤、证据缺口和自动化改进。
