# AU-107｜Identity WeChat session 与公开 HTTP 入口深审

Wechat wrapper 只拦截 WeChat session/bind operation；JSSDK、authorize 与 exchange 场景严格分开。Exchange 先按 host、target、application 解析 realm，再对 provider/application/realm/subject 写入加密 federated identity；union 只在同 realm 内把已活跃绑定迁移到同一 identity。

绑定身份仅在 active membership、account、realm 与 storefront target 匹配时创建 session/ticket。若已认证请求的 account 与 WeChat identity 不同，只发十分钟 account-confirmation grant，不创建 session。revoked identity 与下游会话失败由 identity transaction 回滚；已登录 bind 使用 current realm account。

结论：未发现 P0–P3 新问题。Vitest 未安装，未执行。
