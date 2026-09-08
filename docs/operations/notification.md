# 通知投递运行手册

## 触发症状、用户影响与严重级（Trigger / Impact / Severity）

站内、短信、邮件或微信通道积压、模板发布错误、Provider 拒绝/熔断、Delivery Receipt 丢失、用户偏好违规或 Deadletter 时触发。交易事实继续提交；OTP/高风险通知中断为 P0/P1，普通通知延迟为 P2，错误收件人或 PII/Secret 泄露为 P0。

## Owner 与前置权限

Notification Owner 主责，Identity、Support、Extension、Security 与具体业务 Owner 协同。模板预览/发布/恢复使用版本化 Schema、ExpectedVersion 与权限；生产凭据由 `NOTIFICATION_CONFIG_REF` 指向 Secret Store/工作负载角色，应用只获取短时租约。禁止环境名分支、长期 AccessKey、明文收件人或 OTP 进入配置/日志。

## 只读诊断（Diagnosis）

按 `{dispatchId}`、`{channel}` 读取业务事件、TemplateVersion/Locale、Preference/Opt-out、Destination Hash、Dispatch、Provider Attempt、外部 ID、Receipt、Outbox/Inbox、Job Lease/Checkpoint、Circuit/Bulkhead 与积压。确认强制安全通知和可退订营销通知使用不同 Purpose，持久历史可回读。

## 止血（Stop loss）

只禁用失败 Endpoint/Channel/TemplateVersion，保留其他通道和站内历史；OTP 故障限制新挑战并提供安全恢复路径。错收件人/Secret/PII 立即撤销链接、轮换凭据并进入安全事件。禁止把失败标 sent、绕过偏好、全局重发或在工单粘贴正文。

## 恢复（Recovery）

修复 Template/Connection 后以原 DispatchId/Idempotency Key 重放 unsent/retryable Attempt；已有成功 Receipt 只回读。通道不可用时按 Purpose/用户同意的版本化降级策略选择备用通道，不能擅自改变收件人。模板恢复复制历史版本为新版本并重新预览/发布，不改历史。未知 Provider 结果先查询。

## 数据核对（Data repair / Validation / Escalation / Audit）

Validation 对齐事件、TemplateVersion、Preference、Dispatch、Attempt、外部 ID、Receipt 和持久历史，证明每通道/幂等键最多一次成功、积压追平、退订生效、日志无 Secret/PII。Data repair 追加更正 Dispatch；Escalation OTP/错收件/泄露 P0；Audit 保存模板/目的/收件人 Hash/Receipt/Replay Actor。

## 回滚边界

未发送 Dispatch 可取消；已发送通知不可收回，通过更正通知补救。已撤销凭据和签名 URL 不恢复；模板历史不改写。

## 沟通模板

“通知事件 `{incidentId}`，Channel/Template `{channel}/{templateVersion}`，积压 `{depth}`，用户影响 `{impact}`，降级 `{degradation}`，Receipt 状态 `{state}`，Owner `{owner}`，证据 `{evidenceRef}`。”

## 关闭条件

各通道健康或有批准降级；积压/Deadletter 处理完成；Receipt/偏好/持久历史核对通过；重复、错收件、Secret/PII 泄露为 0；告警恢复。

## 复盘链接（Postmortem）

OTP 中断、错收件、偏好违规、凭据泄露、重复投递或积压越过 SLO 必须填写 `{postmortemUrl}`。
