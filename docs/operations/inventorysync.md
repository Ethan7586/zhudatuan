# Provider 库存同步运行手册

## 触发症状、用户影响与严重级（Trigger / Impact / Severity）

Inventory Sync 水位停滞、库存版本乱序、负量、重复 Movement、Provider 熔断或可售库存陈旧时触发。受影响 Listing 只读/不可售；已接受超卖、Reservation 被覆盖或跨 Scope 为 P0。

## Owner 与前置权限

Inventory/Channel Owner 主责，Order、Catalog 与 Provider Owner 协同。连接机制遵循 `providerhealth.md`；同步只能以 Provider 库存能力更新外部观察，不覆盖本地活动 Reservation。

## 只读诊断（Diagnosis）

核对 Provider SKU/Location、源版本/Hash/Onhand、StockItem、Safety、Reservation、Movement、阶段 Checkpoint/Cursor、锁与 Listing 可售状态；计算 `available = onhand - reserved - safety`。

## 止血（Stop loss）

暂停该连接同步并把陈旧/无可信库存 Listing 切不可售，其他连接继续；命令时仍锁定和重检。禁止跳 Cursor、直改计数、释放 Reservation 或接受负可用量。

## 恢复（Recovery）

从 Checkpoint 按稳定 SKU/Location/Version 重放，锁定 StockItem 后重读 Reservation并追加幂等 Movement；旧版本忽略、冲突重读。恢复后再逐 Listing 打开可售。

## 数据核对（Data repair / Validation / Escalation / Audit）

Validation 对齐源版本/Hash、Movement、Onhand/Reserved/Safety/Available、Cursor 和 Listing，证明超卖/重复 Movement 为 0。Data repair 只追加库存调整；Escalation 超卖 P0；Audit 保存数量摘要和 Trace。

## 回滚边界

未提交阶段可重跑；Movement 不删除，用反向调整修复。订单 Reservation/扣减不能由同步回滚。

## 沟通模板

“库存同步 `{jobId}`，Provider `{provider}`，Location `{location}`，水位 `{cursor}`，不可售影响 `{impact}`，Owner `{owner}`，证据 `{evidenceRef}`。”

## 关闭条件

水位追平；库存公式/Movement/Reservation/Listing 一致；超卖为 0；其他 Provider 正常；告警恢复。

## 复盘链接（Postmortem）

超卖、Reservation 覆盖、版本乱序或跨 Scope 必须填写 `{postmortemUrl}`。
