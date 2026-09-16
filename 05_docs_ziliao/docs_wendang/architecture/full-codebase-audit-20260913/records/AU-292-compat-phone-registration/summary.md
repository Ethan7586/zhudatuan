# AU-292｜Compatibility 手机号注册与验证码身份链

手机号注册先创建五分钟 challenge，以 phone subject、HMAC code hash 和加密手机号传递到 service-role RPC；注册函数锁定未消费 challenge 与 invitation，验证验证码、有效期、手机号约束和 storefront employee 角色后，在同一函数内创建身份、成员、凭据、membership、role、scope 和福利账户，再消费 challenge 与邀请。路由测试验证 debug OTP 不在生产暴露、弱密码不写库和有效邀请返回 201。

challenge 频率、错误次数和 OTP 发送冷却同样会返回 429，归并至既有 F-0234，不新增编号。没有发现 P0–P3 的其他新问题；数据库 migration 未在此审计工作树实际回放。
