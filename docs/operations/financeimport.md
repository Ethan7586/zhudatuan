# 财务账单导入运行手册

## 触发症状、用户影响与严重级（Trigger / Impact / Severity）

Provider/供应商 Statement 预检或发布停滞、外部引用重复、币种/期间/期初期末/总额不守恒、账单 Hash 不一致时触发。未完成批次不可见且不能结算；错误 Statement 污染对账、Journal 不平或跨 Scope 为 P0。

## Owner 与前置权限

Finance Owner 主责，Channel、Payment、Runtime 与 Security 协同。统一文件、任务、Checkpoint、取消与重试只遵循 `import.md`，本手册不复制其技术步骤。确认需要财务权限、Step-up、目标账期 ExpectedVersion 和职责分离。

## 只读诊断（Diagnosis）

核对 Statement 外部唯一键、Provider、Account、Scope、Period、Currency、Opening/Closing/Total、行 Hash 与冻结 Watermark；确认暂存行、失败行和对账批次。账单导入只能创建 Statement，不得直接写 Journal/Entry/Balance；不下载敏感源正文。

## 止血（Stop loss）

隔离对象和账期，阻断该 Statement 的 Reconciliation、Settlement、Withdrawal、Invoice 与 Close；其他账期继续。发现账务不平或引用冲突，保留源 Hash/Trace 并停止相关 Finance 写入。禁止手工插入 Statement/Journal/Entry。

## 恢复（Recovery）

Runtime 按 `import.md` 恢复未完成分片；只有所有有效行和总额守恒才在一个事务发布 Statement、明细与 Reconciliation Batch。永久错误修正源文件后新建任务；已发布错误账单通过审批修复批次和冲正处理，不改历史。

## 数据核对（Data repair / Validation / Escalation / Audit）

Validation 对齐对象 Hash、行 Hash、行数、金额、Currency、Period、Watermark、Statement 与对账批次，证明 Journal 借贷仍平、跨 Scope/重复来源为 0。Data repair 只用审批后的 Reconciliation Repair/Reverse；Escalation 对资金不平或泄露 P0；Audit 保存授权快照、摘要、审批和 Trace。

## 回滚边界

未发布批次可取消；已发布 Statement 不删除，以新修订/冲正并保留原 Watermark。Journal 永不由 Import 回退；技术边界见 `import.md`。

## 沟通模板

“账单导入 `{importId}`，Provider/账期 `{provider}/{period}`，金额 `{amountMinor} {currency}`，阶段 `{phase}`，对账/结算影响 `{impact}`，Owner `{owner}`，证据 `{evidenceRef}`。”

## 关闭条件

统一 Import 条件通过；Statement/行/金额/Hash/Watermark 一致；对账批次状态明确；Journal 不平为 0；职责分离和审计证据完成。

## 复盘链接（Postmortem）

资金不平、重复 Statement、跨 Scope、敏感泄露或账期契约失效必须填写 `{postmortemUrl}`。
