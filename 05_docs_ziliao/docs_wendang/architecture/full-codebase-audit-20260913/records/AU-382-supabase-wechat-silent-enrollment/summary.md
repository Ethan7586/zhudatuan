# AU-382｜Supabase 微信静默建档

`20260815180000_wechat_silent_enrollment.sql` 有意将早期“不自动绑定”规则收窄为：经过服务端微信 code 交换确认的 AppID + OpenID，可在服务端选择的 active public mall 中创建一名基础 Storefront 会员。它不接收小程序提交的 tenant 范围，不合并既有成员，也不把 UnionID 当作授权键。

函数以 AppID/OpenID advisory lock 串行化首次建档，先锁定身份行；已绑定的 active membership 直接复用，冲突或失效身份拒绝。新建成员仅获得公开目录、下单和订单读取权限；企业资格和手机认证仍由后续业务入口判断。身份、会员、scope、角色、零余额账户和审计记录在同一事务创建，任何 unique 冲突都返回 identity_conflict 而不猜测归属。

`wechatAuthRoutes` 的已注册会话入口先向微信服务换取 code，再查询身份；缺失身份才调用本 RPC，随后重新解析 Storefront membership 并签发会话。该迁移是当前微信进入商城的直接运行链，归 G0。未发现新增 P0–P3 或删除候选；未执行微信登录、数据库写入、测试或线上检查。
