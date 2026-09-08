# Provider 账单同步运行手册

## 触发症状、用户影响与严重级（Trigger / Impact / Severity）

Statement Sync 水位停滞、外部引用重复、期间/币种/总额/Hash 不一致、Provider 熔断或对账延迟时触发。受影响账期不结算；错误 Statement 或账务不平为 P0。

## Owner 与前置权限

Finance/Channel Owner 主责，Payment、Reconciliation 与 Provider Owner 协同。连接机制遵循 `providerhealth.md`；同步只创建版本化 Statement 输入，不能写 Journal 或 Balance。

## 只读诊断（Diagnosis）

核对 Provider Cursor、Statement 外部键、Period/Currency、Opening/Closing/Total、Line Hash、阶段 Checkpoint、已有 Statement/Reconciliation Batch 和重复判定。确认 Cursor 在整份 Statement 事务发布后才推进。

## 止血（Stop loss）

暂停该连接账单同步并冻结对应账期的对账、结算、提现和发票；其他 Provider/账期继续。禁止跳 Cursor、合并冲突 Statement 或手工写 Journal。

## 恢复（Recovery）

从 Checkpoint 重拉冻结区间，相同外部键/Hash 回读；同键不同 Hash 隔离并人工确认。所有行与总额守恒后原子发布 Statement 并推进 Cursor，再启动 Reconciliation。

## 数据核对（Data repair / Validation / Escalation / Audit）

Validation 对齐 Provider/本地行数、金额、Currency、Hash、Period、Watermark 与 Reconciliation，Journal 仍平衡。Data repair 通过新 Statement 修订/对账修复；Escalation 资金异常 P0；Audit 保存源 Hash/水位/Trace。

## 回滚边界

未发布阶段可重跑；已发布 Statement 不删除，以新修订和冲正修复；Journal 不由同步回滚。

## 沟通模板

“账单同步 `{jobId}`，Provider/账期 `{provider}/{period}`，水位 `{cursor}`，差异 `{count}/{amountMinor}`，结算影响 `{impact}`，Owner `{owner}`，证据 `{evidenceRef}`。”

## 关闭条件

水位追平；Statement 行/金额/Hash/Period 一致；Reconciliation 已创建；Journal 不平为 0；其他 Provider 正常；告警恢复。

## 复盘链接（Postmortem）

重复/篡改 Statement、Cursor 丢失、资金不平或跨 Scope 必须填写 `{postmortemUrl}`。
