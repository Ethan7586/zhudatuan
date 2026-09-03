# Auth

统一身份认证前端。它与 Storefront 服从相同的宏观架构规则，但保留认证域专用的状态机、PKCE、秘密生命周期和一次性票据模型。

## 架构与依赖

```text
main → app → route → feature/ui → feature/application → feature/model + feature/public
                     app/Dependencies → feature/infrastructure → shared/api → @shop/sdk → @shop/contract
                     UI → @shop/presentation → @shop/contract
                     shell/UI → @shop/design
```

- `app` 是组合根和运行时编排层；只在 `Dependencies.ts` 组装端口实现。
- `route` 声明路由并净化公开参数，不推测 HttpOnly 会话状态。
- `feature` 按 bootstrap、login、challenge、invitation、federation、membership、recovery、link 划分；UI 不直接联网，application 不使用浏览器 API。
- `shared/api` 只持有 Auth 所需的窄 SDK 操作及请求上下文；没有巨型 Identity facade。
- `shared/security` 管理 PKCE、设备绑定、秘密和返回地址；不得保存业务会话真相。
- `@shop/presentation` 把结构化 Failure 转为安全、统一的 FailureView；UI 不解析或展示任意 Error.message。

## 路由

| 路由 | 责任 | 公开参数 |
|---|---|---|
| `/` | 密码、验证码和邀请码登录主流程 | `target`、`returntarget`、`returnpath` |
| `/invitation` | 预选邀请码方式；邀请码仍只走请求体 | 同登录入口 |
| `/membership` | 服务端一次性身份选择上下文 | `target`、`state` |
| `/callback` | 第三方认证回调状态说明 | `target` |
| `/link` | 明确的账号关联提示，不自动合并 | `target`、`code` |
| `*` | 安全未找到页 | 无 |

Guard 拒绝未知、重复、超长、含控制字符或非白名单 target 的参数。内部页面使用 React Router；跨应用跳转必须通过 `approvedDestination`，生产环境仅允许配置的 HTTPS origin，HTTP 只允许 loopback 本地开发。

## 状态机

`LoginMachine` 是纯 reducer。状态覆盖 Bootstrapping、Ready、ChallengePending、Submitting、ResolvingInvitation、ExchangingTicket、Enrollment、Proof、MembershipSelection、Redirecting、RecoverableFailure、TerminalFailure 和 Cancelled。每个异步命令都带单调递增的 command；过期响应被忽略，运行中拒绝重复提交，target 变化会使旧命令失效，Redirecting 和 TerminalFailure 不再接受敏感表单事件。

密码、验证码、邀请码、PKCE verifier 和票据不进入 reducer、context、URL、localStorage 或 telemetry。组件使用 `Secret` 缩短 JS 字符串和 DOM 引用的生命周期；JavaScript 无法保证物理清零，因此服务端仍必须实施限时、限次、摘要存储、单次消费和审计。

## 配置与数据权威

- 浏览器公开环境只在 `config/Environment.ts` 读取，由 `@shop/config` 校验。
- 登录方式、密码政策、OTP 时长、法律文本和 bootstrap 到期时间来自 `identity.bootstrap.read`。
- Provider 列表由独立 operation 读取，失败只降级第三方登录区，不阻断密码、验证码、邀请码三条 MVP 主链路。
- PostgreSQL 是身份、凭据、membership、challenge、invitation、selection 和 ticket 的事实源；前端按钮禁用不代替服务端事务、幂等和条件更新。

## 错误流

```text
errors.yml → contract Api/Transport/Client code → operation errorUnion
→ SDK typed error → @shop/presentation FailureView → Alert/Dialog/字段问题
```

字段校验是 `FieldIssue`，取消是控制流；两者不是公开 API 错误码。服务端私有异常只能在模块边界翻译，不能进入响应。不可恢复的合同或客户端失败清除敏感流程并重新 bootstrap；可恢复的失败显示统一动作和可复制 requestId。

## 性能与可访问性

入口只加载可访问的安全初始化态；应用组合根、协议、注册、找回和对话框按需拆包。仓库门禁要求 Auth 初始 gzip 不超过 90KB，任一懒加载分支不超过 100KB。全部交互必须支持键盘、可见焦点、44px 触控目标、屏幕阅读器名称、reduced motion、forced colors 和窄屏安全区。

## 本地验证

```bash
npm --workspace @shop/auth run lint
npm --workspace @shop/auth run test
npm --workspace @shop/auth run test:component
npm --workspace @shop/auth run build
npm run check:errors
npm run check:frontend
npm run check:visuals
npm run check:naming
npm run check:boundaries
npm run check:dependencies
npm run check:calls
npm run check:duplicates
npm run check:bundles
```

正式发布还必须运行仓库 `npm run quality`，完成浏览器、可访问性、安全、数据库、并发、性能与需求证据验收；在此之前 `MVPIDENTITY` 保持 `Designed`，不得手工伪造 release evidence。
