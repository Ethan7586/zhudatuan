# AU-099｜Identity 模块装配与 FullIdentity operation 入口深审

FullIdentityOperations 为 core identity operation 加装 WeChat operation wrapper，依赖 command pool、KMS、audit、secret keys、WeChat token 和 AuthTicket signer。完整 Commerce 运行单元始终使用 IdentityModule。

IdentityRegistrationApiMain 根据 runtime.wechatIdentityEnabled 选择带 WeChat operation 的 registration selected module 或 core-only module；选择集由不同 operation ID 常量明确限制。Identity manifest/公开 index 声明与静态测试一致。

结论：未发现 P0–P3 新问题。Vitest 未安装，未执行。
