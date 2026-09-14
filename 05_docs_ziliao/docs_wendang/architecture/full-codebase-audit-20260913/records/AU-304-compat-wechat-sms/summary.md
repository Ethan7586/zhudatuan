# AU-304｜Compatibility 微信注册与阿里云短信链

短信挑战先以 pending 状态落库，阿里云发送成功后才由 `api_record_phone_challenge_delivery` 标记 sent 并记录截断后的 provider message ID；发送失败会原子标记 failed、消费 challenge 并轮换 code hash。生产环境仅允许配置完整的阿里云短信提供方，单次发送禁用 SDK 自动重试，超时固定为三秒，且服务端不会向客户端返回原始供应商详情。调试验证码只在 development/test 返回。

微信注册在单个 database RPC 内依次执行用户名会员创建和微信绑定；绑定失败会使创建事务回滚并返回稳定的 binding-expired 状态。路由随后重新解析 membership runtime 后才签发小程序会话。测试覆盖原子 RPC 边界、微信 code exchange 不泄露 `session_key`、生产环境禁用 debug 短信及提供方错误脱敏。

手机/IP 发送频率阻断和验证码最多五次的尝试次数，延续并扩大了 F-0234 的注册/身份限流冲突；本批次不新增问题编号。除该既有 P2 外，未发现 P0 或新的 P1–P3。因审计工作树缺少 Vitest 依赖，未执行测试；结论基于静态调用链取证。
