# AU-291｜Compatibility 用户名注册身份链

用户名注册由 `handleUsernameRegistration` 显式开关后调用 service-role RPC；数据库函数只接受 active storefront employee 邀请，创建 user/member/alias/credential/membership/role/self scope/welfare account 与审计记录，唯一冲突回滚为 account_exists。路由 fixture 覆盖成功、无效用户名/弱密码的提前拒绝、生产开关和 RPC 参数。

发现 **F-0234 / P2**：入口和 migration 对同一 IP 实施一小时注册限流，测试固定 429 路径；这与本项目明确“不增加或保留登录失败锁定、限流、冷却”的决定冲突。审计不修改该行为。该 migration 的 phone 身份基础依赖链已结构性核对，逐逻辑深审留后续独立单元。
