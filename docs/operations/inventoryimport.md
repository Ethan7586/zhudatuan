# 库存导入运行手册

## 触发症状、用户影响与严重级（Trigger / Impact / Severity）

库存导入 Lease/Checkpoint 停滞、行错误越界、对象 Hash 异常、负可用量、重复 Movement 或 Deadletter 时触发。现有库存与 Reservation 继续以账本为准；负库存或已接受超卖为 P0。

## Owner 与前置权限

Inventory Owner 主责，Supplier、Order、Database 与 Security 协同。先遵循 `import.md`；操作人还需目标 Location/Scope 的库存调整权限，不能用导入替代订单预占或释放命令。

## 只读诊断（Diagnosis）

除统一证据外，核对 `sku`、`location`、非负整数 `onhand`，可选 `safety` 与 `active/blocked` 状态；读取 StockItem 版本、活动 Reservation、Movement 幂等键、可用量公式和锁等待。对比导入前后账本，不只看投影计数。

## 止血（Stop loss）

暂停该 Scope 导入与受影响 Listing 新销售，命令时库存检查继续 fail-closed；保留现有 Reservation。禁止直改 `onhand`、可用量、Reservation、Movement、Cursor 或错误行。

## 恢复（Recovery）

通用重试从已提交 Checkpoint 继续。每行锁定 StockItem、重读活动 Reservation、追加一个稳定幂等 Movement 后更新聚合；版本冲突重新读取而不覆盖。永久数据错误修正文件后新建任务。

## 数据核对（Data repair / Validation / Escalation / Audit）

Validation 证明 `available = onhand - reserved - safety >= 0`、每个成功行恰有一个 Movement、Reservation 无丢失、总行数/Hash/Checkpoint 守恒、跨 Scope 为 0。Data repair 只能追加经审批 Movement；Escalation 对负库存/超卖/重复移动立即 P0；Audit 记录前后版本和数量摘要。

## 回滚边界

已追加 Movement 不删除，以相反且有原因的库存调整补偿；已完成订单 Reservation 不由导入回退。通用边界见 `import.md`。

## 沟通模板

“库存导入 `{importId}`，Location/Scope `{scope}`，进度 `{completed}/{total}`，冲突 `{conflicts}`，可售影响 `{impact}`，Owner `{owner}`，证据 `{evidenceRef}`。”

## 关闭条件

统一 Import 条件通过；可用量非负、超卖为 0、Movement/Reservation/投影一致、受影响 Listing 可售状态重新核验、告警恢复。

## 复盘链接（Postmortem）

负库存、超卖、重复 Movement、跨 Scope 或锁风暴必须填写 `{postmortemUrl}`。
