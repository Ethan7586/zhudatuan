# Provider 扩展健康运行手册

## 触发症状、用户影响与严重级（Trigger / Impact / Severity）

jdproduct、jdfresh、tmall、supplier、cake、flower、book、charge、foodvoucher、movie、meal 任一 required Provider 的健康探测、能力调用、同步、Webhook、限速、熔断、凭据租约或排空异常时触发。单连接降级为 P1；重复外呼、签名绕过、Secret 暴露或拖垮全局线程池为 P0。

## Owner 与前置权限

Extension Owner 负责框架，Channel/Payment/Notification 能力 Owner 与具体连接 Owner 负责业务结果，Security 管理 Secret/KMS。诊断用 Manifest/配置/健康/指标只读权限；启停、轮换和回放需要 Step-up、ExpectedVersion、审计原因。Secret 仅由 SecretRef 和短时租约注入 Provider Worker。

## 只读诊断（Diagnosis）

按 `{provider}`、`{connection}`、`{capability}` 读取签名 Manifest、版本/依赖、配置 Schema、Endpoint allowlist、Secret KeyVersion 元数据、Health、Circuit、Bulkhead、限速、超时、重试、In-flight、Job/Checkpoint、Webhook Inbox 和业务 Receipt。确认故障只在该连接，其他 Provider 以及商品/订单/财务总入口仍可用。

## 止血（Stop loss）

打开单连接 Circuit，拒绝新外呼并排空运行中任务；读能力按规则切只读/隐藏不可售项，写能力显示明确不可用。保留其他 Provider 和核心入口。签名/回放/Secret 异常撤销租约并进入安全事件；禁止全局关 Worker、无限重试或回退无签名扩展。

## 恢复（Recovery）

修复配置/依赖后先用相同 Manifest 执行 Health 与 Sandbox，逐 capability Canary，再关闭 Circuit。凭据轮换先部署新 KeyVersion、验证并排空旧租约再撤销旧版。Webhook 以签名、Nonce、时间窗和 Inbox 防重回放；同步从阶段 Checkpoint 恢复；运行中禁用等待 In-flight 清零并取消未开始任务。

## 数据核对（Data repair / Validation / Escalation / Audit）

Validation 覆盖安装/启用/禁用、Schema、轮换、Health、Circuit、限速、超时、重试、重复/乱序回调、Unknown 恢复、排空、取消、中文错误、脱敏和 Trace，并核对 Provider/本地订单、库存、价格、Statement 与 Receipt。Data repair 走领域补偿；Escalation P0；Audit 保存 Manifest/Config Hash、KeyVersion、状态和证据。

## 回滚边界

可禁用单扩展或恢复上一签名 Manifest/配置版本；已发生的外部下单、退款、支付、发券不能因禁用回滚，只能查询并补偿。旧 Secret 撤销后不得恢复。

## 沟通模板

“Provider 事件 `{incidentId}`，Provider/Connection `{provider}/{connection}`，Capability `{capability}`，Circuit `{state}`，业务影响 `{impact}`，处置 `{containment}`，Owner `{owner}`，证据 `{evidenceRef}`。”

## 关闭条件

Health/Sandbox/Canary 通过；Circuit/Bulkhead/限速正常；积压与 In-flight 清零；外部/本地事实对账；其他 Provider 未受影响；Secret/日志安全；告警恢复。

## 复盘链接（Postmortem）

全局拖垮、重复外部效果、签名/Secret、安全边界或单 Provider 反复熔断必须填写 `{postmortemUrl}`。
