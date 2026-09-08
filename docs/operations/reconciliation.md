# 财务对账运行手册

## 触发症状、用户影响与严重级（Trigger / Impact / Severity）

Statement 导入失败、对账 Watermark 停滞、差异金额未归零、重复匹配、修复审批卡住或 Journal 不平时触发。结算/提现/开票按账期被阻断；账本不平、重复修复或跨 Scope 为 P0。

## Owner 与前置权限

Finance Owner 主责，Payment、Channel、Order、Approval、Database 与 Security 协同。对账输入必须是已发布 Statement 与冻结内部 Watermark；Repair 需要 Maker-Checker、Step-up、证据 Hash、金额/币种/对象版本和一次性 Proof。

## 只读诊断（Diagnosis）

读取 Statement/Line Hash、Period/Currency/Opening/Closing/Total、内部支付/退款/订单/费用快照、匹配规则版本、Batch Watermark、Difference 分类、Repair/Approval、Journal/Entry 和 Outbox。分别识别时间差、金额差、缺失、重复和 Provider Unknown，不手工移动 Watermark。

## 止血（Stop loss）

冻结受影响账期的 Settlement、Withdrawal、Invoice 与 Close，保留其他账期；隔离错误 Statement/规则版本。账本不平立即停止 Finance 写；禁止直接改 Difference、Journal、Entry、Balance 或把差异标已解决。

## 恢复（Recovery）

依赖恢复后复用同一 Batch/Watermark 幂等匹配；Provider Unknown 先查询外部结果。永久差异提交 Repair Proposal，经职责分离审批后追加更正/冲正 Journal 和解决事件；原差异、Statement 与快照保持不可变。失败 Job 从 Checkpoint 继续。

## 数据核对（Data repair / Validation / Escalation / Audit）

Validation 对齐 Statement 与内部快照的行数、金额、Hash、Currency、Watermark，证明每行最多一次匹配、所有解决差异有审批/Proof、所有 Journal 借贷相等。Data repair 仅追加修复/冲正；Escalation 对不平/越权/重复 P0；Audit 保存规则、证据 Hash、决定、分录和 Trace。

## 回滚边界

未发布 Batch 可取消；已发布匹配和 Journal 不删除，错误修复通过新 Repair/Reverse。账期关闭后只按受控 Reopen/Adjustment 策略前向处理。

## 沟通模板

“对账事件 `{incidentId}`，Provider/账期 `{provider}/{period}`，Watermark `{watermark}`，差异 `{count}/{amountMinor}`，阻断范围 `{impact}`，Owner `{owner}`，证据 `{evidenceRef}`。”

## 关闭条件

Statement/快照/Watermark/Hash 核对完成；差异归零或每项有批准结论和 Owner；Journal 不平为 0；相关 Settlement/Invoice 门禁恢复；审计归档。

## 复盘链接（Postmortem）

账本不平、重复修复、跨 Scope、错误关账或差异超 SLA 必须填写 `{postmortemUrl}`。
