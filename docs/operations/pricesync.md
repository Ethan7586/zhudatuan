# Provider 价格同步运行手册

## 触发症状、用户影响与严重级（Trigger / Impact / Severity）

Price Sync 水位停滞、币种/舍入/有效期异常、价格越界、乱序版本或单 Provider 熔断时触发。受影响 Offer 可按策略变为不可售；低价误售、跨 Scope 或客户端金额成为权威为 P0。

## Owner 与前置权限

Pricing/Channel Owner 主责，Catalog、Risk 与 Provider Owner 协同。连接机制遵循 `providerhealth.md`；同步配置绑定价格 Schema、Currency、舍入和异常阈值版本。

## 只读诊断（Diagnosis）

核对源 Price Version/Hash、Currency、Minor Amount、Tax/Fee、有效期、Listing/Offer、规则版本、阶段 Checkpoint/Cursor 和异常 Review；比较 Checkout 服务端 Quote，不读取客户端计算值作为事实。

## 止血（Stop loss）

暂停该连接 Price Sync，对无可信有效价格的 Listing 只读/下架，保留其他 Provider。异常低价进入 Risk Review，禁止直接覆盖 Offer 或跳过舍入/有效期。

## 恢复（Recovery）

从已提交 Checkpoint 按稳定 Offer Key 重放；旧/重复版本忽略，合法新版本经 Pricing 聚合发布并精确失效缓存。映射错误以新规则版本修复，不修改历史 Quote。

## 数据核对（Data repair / Validation / Escalation / Audit）

Validation 核对源/Offer Hash、币种、金额、舍入、有效期、Listing 关联、Checkout Quote 与 Cursor；低价误售为 0。Data repair 用新 Offer/补偿；Escalation 金额事故 P0；Audit 保存规则/源版本与 Trace。

## 回滚边界

未提交阶段可重跑；已发布价格用新版本替代，已确认订单/Quote 不回写。误售订单按 Order/Finance 规则补偿。

## 沟通模板

“价格同步 `{jobId}`，Provider `{provider}`，水位 `{cursor}`，异常 Offer `{count}`，交易影响 `{impact}`，Owner `{owner}`，证据 `{evidenceRef}`。”

## 关闭条件

水位追平，源/Offer/Currency/舍入/缓存核对通过，异常 Review 有结论，其他 Provider 正常，告警恢复。

## 复盘链接（Postmortem）

低价误售、币种/舍入错误、Cursor 丢失或跨 Scope 必须填写 `{postmortemUrl}`。
