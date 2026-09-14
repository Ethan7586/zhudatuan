# AU-098｜Identity WeChat 网关与 return-target 签名边界深审

ReturnTargetSigner 只接受无用户名、密码、query、fragment 的 HTTPS return URL，并为其生成一分钟有效的 HMAC proof。

WechatIdentityGateway 使用配置目录提供唯一 appId；仅允许 miniapp/jsapi 两个场景。OAuth callback 必须是公开 HTTPS 的固定 /wechat/callback 路径。JSSDK token/ticket 由 jsapi 应用获取，缓存并合并并发请求，签名使用去掉 fragment 的实际页面 URL。

结论：未发现 P0–P3 新问题。Vitest 未安装，未执行。
