# RV-0011｜遥测与审计脱敏独立复核

- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`。从 production telemetry writer、Operation audit writer 和 client-error buffer 重新追到 Redactor；未读取线上日志、审计表或真实凭据。

1. `commerceTelemetry()` 将 `@shop/telemetry` record JSON 写到 stdout；`createTelemetry`、Logger、metrics/tracer、ClientErrorBuffer 均使用 Redactor。`appendOperationAudit` 也对 request/result/reason 调用同一 Redactor 后持久 audit record。
2. `Redactor.ts:1-19` 仅按敏感键名、Bearer、手机号、email 和 OTP 字符串模式置换；并不识别字符串内的 `password=...`、Cookie、Basic auth、卡号或大多数证件号码，且对象循环会递归抛错。
3. 现有 `Redactor.test.ts` 只覆盖敏感键名及几种已实现的字符串模式，不能证明 message/stack/reason 等自由文本安全；ClientErrorBuffer 将 `message`、`stack`、`componentStack` 的已脱敏结果保存在内存并外发 writer。

**F-0065 确认 P1，高置信度。** 正式 stdout 遥测和持久操作审计均可接收自由字符串，而它们依赖的唯一 redaction boundary 会保留多类认证材料和身份信息；具有日志/审计读取能力的主体可能看到这些值。未读取真实输出或证明持续泄漏，故不是 P0。

后续仅在最新主线创建单目的脱敏批次：以合成攻击字符串矩阵覆盖 message/stack/reason、循环/异常值、stdout 和 audit sink；定义失败受控语义，绝不以真实秘密作为 fixture，也不修改历史审计数据。
