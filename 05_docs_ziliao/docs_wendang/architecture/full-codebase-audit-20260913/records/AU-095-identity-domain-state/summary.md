# AU-095｜Identity 授权交易、身份主体与密码策略深审

AuthTransaction 对 state、nonce、ticket 和 PKCE verifier/challenge 执行格式与长度校验；PgAuthTicket 的消费语句同时比较 ticket/state/nonce/challenge/session hash。

IdentitySubject 将中国手机号归一为 +86 E.164，并保留兼容查询变体；其它用户名做 trim/lowercase。PasswordPolicy 复用共享 password policy，以固定参数 scrypt、随机 salt 与 timing-safe 比较实现验证；空 credential 仍执行同等 KDF。

结论：未发现 P0–P3 新问题。Vitest 未安装，未执行。
