# AU-002｜关键分支与状态表

## Console 启动

| 状态/条件 | 动作 | 下一状态 | 失败结果 | 清理/恢复 |
| --- | --- | --- | --- | --- |
| root 缺失 | 抛 `APP_ROOT_MISSING` | 无 | bootstrap 同步失败 | 无 |
| runtime 有效 | 启动 document prefetch，动态 import providers | render pending | import/runtime reject | 进入失败分支 |
| dynamic import 符合恢复条件 | 记录一次并 reload | 浏览器重载 | 60 秒窗口内再次失败 | 显示错误页 |
| providers 成功 | 清恢复标记，setTimeout render StrictMode | ConsoleApp | React 后续错误由边界处理 | Query/Router 自有生命周期 |

## Console 路由/session

| 输入 | true/命中 | false/不命中 | 默认/失败 | 资源清理 |
| --- | --- | --- | --- | --- |
| `/` landing | 读取 session，选第一个可用 scope/module | 无可见业务 operation 时个人中心 | session 错误进入 RouteError/身份入口 | landing handoff 5 秒后过期 |
| 同一 scope 内导航 | `scopeShouldRevalidate=false` | scope key 改变则重新 loader | URL 无 scope key 则重验证 | request AbortSignal |
| document prefetch 1.5 秒内完成 | 经同一 parser 接纳 | 超时/invalid 回退 SDK | request abort 立即抛 AbortError | listener/timer finally 清除并 abort document prefetch |
| profile 403 | 保留授权 workspace，用 session profile fallback | 401 不可吞掉 | 其它错误按当前实现传播/回退 | 无长期资源 |

## Auth 启动与页面分流

| 条件 | 页面/动作 | 失败结果 | 状态更新 |
| --- | --- | --- | --- |
| build registry 已知当前 host | runtime 请求未完成前 render App | configured node 读取异常被启动 try 吞并等待 runtime | `renderedFromBuild=true` 防重复 render |
| runtime 404 或非 JSON | `load...` 返回 false，仍调用 renderApp | build registry 缺失时 React render 行为待专项 | runtimeRegistry 不变 |
| runtime schema/host 合法 | 安装 runtimeRegistry | 非 2xx/shape/host mismatch → 错误页 | 模块级 registry 替换一次 |
| query application+target 精确等于 node consumer | ConsumerIdentityPage | 任一不等进入后续 operator/invalid 判断 | App state 初始固定 |
| operating_mall 且无 consumer intent，target/client/admin_origin 不冲突 | OperatorIdentityPage | 非 operating_mall 或冲突 → invalid | audience switch 用 replaceState+setEntry |

## Storefront Worker

| 顺序 | 条件 | 结果 | 是否继续 |
| ---: | --- | --- | --- |
| 1 | labs host 的 API health/v1 path | 404 no-store | 否 |
| 2 | host 与 APP_ENV/AUTH_MODE 不兼容 | 503 no-store | 否 |
| 3 | showcase path 且 host 不允许 | 404 no-store | 否 |
| 4 | Compatibility publicRouter 返回 Response | 原样返回 | 否 |
| 5 | publicRouter 返回 null | 调 vinext handler | 是 |
| 任一步 reject | Worker 自身无 catch | exception 向运行平台传播 | 否 |

## Storefront device 页面

| path | server 首屏 | hydration 后 | 加载模块 | HTTP status |
| --- | --- | --- | --- | --- |
| desktop-1920/laptop-web | 同一 aria-busy shell | StorefrontWebFrame | lazy laptop frame | 未运行验证 |
| mini-program/android-app | 同一 shell | MobileFrame | lazy mobile frame | 未运行验证 |
| tablet-app | 同一 shell | TabletFrame | lazy tablet frame | 未运行验证 |
| unknown one-segment | 同一 shell | “该展示入口不存在” | 不加载 frame | [UNKNOWN] dynamic route 未调用 notFound |

## Auth 成功响应 Schema

| 当前步骤 | 有效响应 | 无效响应 | 当前控制流 | 恢复 |
| --- | --- | --- | --- | --- |
| `safeParse(response)` | 返回 success/data | 返回 success=false/error，不抛 | 两种结果都被 `void` 丢弃，原 response 被类型断言 | 无 fail-closed；后续属性访问/请求决定首个失败点 |

## Miniapp 机器规则

| 规则 | 最小要求 | 当前结果 |
| --- | --- | --- |
| check:tests | app.js 存在 | 通过 |
| candidate | miniprogram 目录存在 | 可复制 9 文件片段 |
| check:navigation | app.json + page 三件套 + actions.js | app.json ENOENT |
| check:runtimegraph | api/client.js 含 contract header | 文件不存在；命令本次先被缺 TypeScript 依赖阻塞 |
| delivery matrix | wechat-miniapp 多能力 implemented | evidence 指向 retired/不存在目录 |
