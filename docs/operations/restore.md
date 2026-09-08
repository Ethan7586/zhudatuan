# 恢复运行手册

## 触发症状、用户影响与严重级

数据库损坏、误操作、区域恢复、发布回退验证、月度恢复演练或法务要求触发。生产事实不可读、账务/支付/库存不一致为 P0；演练或单一派生投影恢复为 P1/P2。严禁在唯一生产库上原地覆盖恢复。

## Owner 与前置权限

Incident Commander 授权，Reliability 执行，Database、Security、各领域 Owner 复核。必须有恢复工单、目标时间 `{recoveryPoint}`、新隔离环境 `{restoreEnvironment}`、备份清单 Hash、KMS Key 元数据和切流审批。Breakglass 使用独立身份、MFA、30 分钟租约和完整语句审计。

## 只读诊断

确认故障边界、最后可信恢复点、WAL 连续性、对象复制水位、配置/Manifest 版本和 Key 可用性。读取发布、迁移与业务不变量证据，确定恢复是否会丢失已确认支付、核销、退款、发券或审批事实。禁止先切流后核对。

## 止血

隔离损坏写入口，暂停相关消费者和外部回调确认；保留原环境只读快照、日志、Outbox/Inbox 位点与 Provider 游标。支付 Unknown、库存预占和账务期间进入领域规定的安全状态，不伪造成功、不清空队列。

## 恢复

在全新隔离集群按顺序恢复 Key 元数据和访问身份、PostgreSQL 全量与 WAL、对象版本、版本化配置和 Extension Manifest。应用追加迁移到目标 Schema Head，重建可派生缓存/搜索/报表，随后按保存的 Inbox/Outbox/任务 Checkpoint 重放。全程只读开放给验证角色，不连接公网 Provider。

## 数据核对

核对 Schema Head、316 个冻结迁移 Hash 及所有追加迁移、Role/Grant/RLS、对象摘要与 WORM、配置/合同/Extension Hash。运行十项发布不变量；将恢复点之后的外部支付与回调通过 Provider Query 补录为领域事实，确认重复消费不产生重复效果。

## 回滚边界

切流前可销毁失败的隔离恢复并重来；切流后原环境保持只读，直到观察窗结束。支付、核销、退款、分录、发放和审批决定不得通过快照回退，只能补偿或冲正。Retire 后数据库只允许前向修复。

## 沟通模板

“恢复事件 `{incidentId}`，目标恢复点 `{recoveryPoint}`，预计数据缺口 `{gap}`，新环境 `{restoreEnvironment}`，当前阶段 `{stage}`，业务只读/暂停范围 `{impact}`，下一决策点 `{decisionAt}`，证据 `{evidenceRef}`。”

## 关闭条件

隔离恢复全部 Hash 和不变量通过；只读验收与六端 Smoke 通过；Provider 外部事实补齐；切流按 1/10/50/100 门禁完成；旧环境受控保留；RPO/RTO、审批、通信和不可变证据完整。

## 复盘链接

所有生产恢复及未达到 RPO/RTO 的演练都必须填写 `{postmortemUrl}`，包含时间线、缺失事实、重放效果、Key/权限使用、切流决策和预防措施。
