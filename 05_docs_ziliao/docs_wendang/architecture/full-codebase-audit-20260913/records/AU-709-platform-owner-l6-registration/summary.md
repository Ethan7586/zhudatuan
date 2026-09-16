# AU-709｜平台 Owner L6 注册边界

- 审阅范围：`20260904010000_allow_platform_owner_l6_registration.sql`、现行 `20260911190000_bind_operator_registration_to_realm_console.sql` 覆盖后的 trigger、RegistrationOperations 与 L6 registration tests。
- 审阅方式：深入审阅 protected-owner trigger 的 storefront例外、L6 registration phone-proof条件、当前 HTTP registration写入上下文与后续 trigger替代；同构 owner trigger注册仅作结构性审阅。

## 审计结论

- **G0：保留。** 0401是历史身份安全演进节点：它保留 protected L0 Owner membership，并只对 transaction-local target Mall的新增 Storefront membership开放窄例外；后续 111900 取代了 registration write trigger以绑定 Realm/console operator契约。
- [FACT][E-AU-709-001] 现行 HTTP self-registration从可信 storefront registration解析 Mall，再设置 `app.registration_mall_id`；L6 direct registration不消费 invitation，并由真实 test覆盖正常 OTP path。
- **F-0289：P2。** HTTP入口仍接受 `phoneVerification='checkout'`，据此跳过 `consumeChallenge`并设置 `app.registration_phone_verification=checkout`；但当前 111900 replacement trigger已不再读取该 setting，registration_allowed只承认本 transaction已消耗的 OTP。该请求模式会在 membership/role/scope写入时触发 registration boundary拒绝。

## 未验证项

- 定向 Vitest未运行：固定基线缺少 `vitest` executable；未安装依赖。
- 未读取生产请求、phoneVerification客户端使用率、真正错误码映射或旧 trigger上线顺序；未断言已发生用户失败。

## 结论等级

- 新增问题：F-0289（P2，高置信度，需要独立复核）。无 P0。
- 垃圾代码：G0 1 组；不新增 G1/G2/G3/GX。
- 二次复核：是；以完整 current migration head和 Identity API role分别执行普通 OTP、checkout-deferred、operator invitation与Owner storefront registration，验证预期的allow/deny及用户可识别错误回执。
