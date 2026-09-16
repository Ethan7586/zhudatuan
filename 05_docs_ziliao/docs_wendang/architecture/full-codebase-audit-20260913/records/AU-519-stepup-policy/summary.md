# AU-519｜StepupPolicy 敏感操作时间门

- 审阅范围：`01_core_hexin/services/commerce/src/foundation/security/StepupPolicy.ts`（10 行）；定向追踪 AccessPipeline 与 MobileWechatOperations 使用点。
- 审阅方式：逐段人工阅读与静态调用追踪；未运行身份验证或时钟边界测试。

## 审计结论

- **G0**：required permission 只有 assurance level 至少 3、存在 verified time 且验证时间不在未来、年龄不超过 900 秒时才通过；未要求 step-up 的权限明确放行。该策略由全局 AccessPipeline 和移动身份变更共同使用。
- age 的下界检查拒绝 future verification timestamp，避免时钟异常将 future credential 无限视为新鲜。没有 static bypass 或默认敏感权限放行证据。

## 未验证项

- 本文件没有专属单测；900 秒边界、时钟偏差、注入非默认 maximumAgeSeconds、实际 step-up 签发和撤销需在身份/AccessPipeline 集成中验证。
