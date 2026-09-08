# Provider 商品同步运行手册

## 触发症状、用户影响与严重级（Trigger / Impact / Severity）

Catalog Sync 水位停滞、重复/乱序商品、Schema/资格映射失败或单 Provider 熔断时触发。受影响 Provider 商品保持上一合法版本并可只读；错误商品跨 Scope 或不合格商品可售为 P0。

## Owner 与前置权限

Catalog/Channel Owner 主责，Qualification 与具体 Provider Owner 协同。连接健康、凭据、熔断、回放与隔离统一遵循 `providerhealth.md`；同步只使用签名 Manifest 声明的 Catalog capability。

## 只读诊断（Diagnosis）

核对 Provider Cursor、阶段 Checkpoint、源商品版本/Hash、映射版本、Product/Sku/Listing 归属、资格和 Tombstone；区分拉取、规范化、提交、发布事件阶段，Cursor 只应在阶段提交后推进。

## 止血（Stop loss）

暂停该连接 Catalog Sync，受影响 Listing 保持旧合法版本或按过期策略下架；其他连接继续。禁止跳 Cursor、覆盖本地主数据或自动发布未校验 Listing。

## 恢复（Recovery）

从最后阶段 Checkpoint 以稳定 Provider Product Key 增量重放；重复版本只回读，乱序旧版本忽略并记录。映射修复使用新版本后重跑失败范围，发布仍走 Catalog 聚合与资格/价格/库存门禁。

## 数据核对（Data repair / Validation / Escalation / Audit）

Validation 核对源/本地数量、版本/Hash、删除标记、Owner/Scope、可售链和 Cursor，无遗漏/重复发布。Data repair 仅 Catalog Command；Escalation 越权/错误可售 P0；Audit 保存阶段、Mapping 和 Trace。

## 回滚边界

Cursor 未提交阶段可重来；已提交商品通过新版本更正/下架，不删除历史。外部已下单事实不受商品同步回退影响。

## 沟通模板

“商品同步 `{jobId}`，Provider `{provider}`，阶段/水位 `{phase}/{cursor}`，商品影响 `{impact}`，Circuit `{state}`，Owner `{owner}`，证据 `{evidenceRef}`。”

## 关闭条件

水位追平；源/本地 Hash 和数量一致；可售链通过；其他 Provider 健康；积压/告警恢复，证据归档。

## 复盘链接（Postmortem）

错售、跨 Scope、Cursor 丢失或重复发布必须填写 `{postmortemUrl}`。
