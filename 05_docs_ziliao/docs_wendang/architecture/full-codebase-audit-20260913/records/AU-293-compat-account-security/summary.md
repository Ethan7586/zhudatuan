# AU-293｜Compatibility 账户安全中心与会话恢复链

该 migration 建立服务端可撤销 session、credential version 和密码/换号 RPC。密码变更递增 credential version、撤销其它 session 并保留当前 session；密码重置撤销全部 session；换号要求当前密码、有效 phone-change challenge，并撤销其它 session。`securityCenterRoutes` 的 handler/test 覆盖当前密码验证、生产无短信提供方失败关闭、换号须登录和撤销其它设备。

安全 challenge 的五分钟/十分钟生命周期、错误次数与请求频率限制继续归并 F-0234；无其它 P0–P3 新问题。migration 内的命名 test roster 是测试身份哈希，未被视为生产凭据；本轮没有迁移回放或外部短信验证。
