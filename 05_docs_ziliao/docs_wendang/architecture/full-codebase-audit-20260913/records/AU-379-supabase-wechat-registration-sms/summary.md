# AU-379｜Supabase 微信注册与短信投递

`20260815123000_wechat_registration_aliyun_sms.sql` 把短信挑战的投递状态、服务商消息 ID 和失败码纳入数据库记录。服务商失败时挑战被消费并替换 code hash，避免未送达验证码继续被使用；成功与失败均只允许更新仍为 pending 且未消费的 challenge。`otpDelivery` 已实际调用该记录 RPC，注册和账户安全挑战均由 service-role 发起。

微信注册入口受显式开关、微信配置、用户名/密码/邀请信息和条款同意控制。`api_register_and_bind_wechat_member` 将邀请驱动的用户名成员创建与一次性微信 challenge 绑定置于同一事务；绑定失败返回 binding_expired，不留下半创建的绑定结果。微信 OpenID 不是企业 membership 的独立依据，企业成员仍由邀请注册流程决定。

本迁移的注册与安全 challenge 均保留手机号十五分钟五次、IP 一小时二十次的累计门槛，微信注册路由另调用用户名注册一小时累计器。此结论与既有 F-0234 完全一致，AU-379 重新核实了短信投递、微信注册和数据库 challenge 三段调用链；未新增问题。该迁移归 G0，不是删除候选。

未执行短信发送、注册、测试、数据库写入或线上检查。
