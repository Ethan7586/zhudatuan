# AU-008 分支与状态记录

## 1. ApiClient 请求状态

| 当前状态 | 条件/输入 | 动作 | 下一状态 | 失败/恢复 |
| --- | --- | --- | --- | --- |
| 未开始 | base URL 非 http(s) | constructor 拒绝 | 终止 | `SDK_BASE_URL_INVALID`，无网络副作用 |
| 校验 | frozen | 传输前拒绝 | 终止 | `SDK_OPERATION_FROZEN` |
| 校验 | 缺 required expectedVersion/idempotency | 传输前拒绝 | 终止 | 稳定 SDK 错误，无网络副作用 |
| 构造 | path 值缺失 | 拒绝 | 终止 | `SDK_PATH_VALUE_MISSING:*` |
| 发送 | 2xx | JSON decode | 完成 | 空 body 返回 undefined；畸形 JSON 抛 SyntaxError |
| 发送 | 4xx/5xx | RetryPolicy 判定 | 重试或终止 | 408/429/5xx 可重试；只有 idempotent 或带幂等键才重试 |
| 发送 | transport error | 检查 deadline 后判定 | 重试或终止 | 总 deadline/调用者 signal 控制；无 per-attempt 新 request 对象 |
| 等待重试 | signal/deadline abort | 清 timer，拒绝 | 终止 | outer finally 释放 deadline |
| 任意终止 | success/error/abort | `deadline.dispose()` | 完成 | 不保留 timer |

## 2. WechatTransport 状态

| 当前状态 | 事件 | 当前实现 | 预期终点 | 审计结论 |
| --- | --- | --- | --- | --- |
| pending | signal 已 abort | abort native task，再 reject | rejected | [FACT] 已测 |
| pending | fail callback | settled=true、detach、reject | rejected | [FACT] 未测 |
| pending | success + string | settled=true、detach、resolve string | fulfilled | [FACT] 未测 |
| pending | success + JSON object | stringify 后 resolve | fulfilled | [FACT] 未测 |
| pending | success + undefined | stringify 得 undefined | fulfilled 但 body 非 string | [FACT] F-0046；下游 `body.length` 失败 |
| pending | success + BigInt/cycle | settled=true、detach 后 stringify 抛错 | Promise 不 resolve/reject | [FACT/INFERENCE] F-0046；语言级抛错确定，微信实际数据形态 UNKNOWN |
| settled | 后续 callback/abort | 回调因 settled return，listener已移除 | 不变 | 正常重复回调受抑制；序列化抛错分支因 settled 已真无法恢复 |

## 3. HTTP/CORS 分支

| 顺序 | 条件 | 行为 | proof-bearing 浏览器请求结果 |
| ---: | --- | --- | --- |
| 1 | Origin 不在 allowlist | 403 | 终止 |
| 2 | OPTIONS | 进入 `preflight`，早于 route/CSRF/handler | 只看固定 method/header allowlist |
| 3 | `Access-Control-Request-Headers` 含 `x-action-proof` | 生产响应未列该头 | 浏览器禁止发送真实请求；F-0044 |
| 4 | 非 OPTIONS 且 route 匹配 | CSRF → node context → body → gate → handler | 只有预检通过才能到达 |
| 5 | Browser OperationMock | mock allowlist 含 `x-action-proof` | 测试可继续，形成生产/测试差异 |

## 4. 生成与发布状态

| 对象 | 生成/加载状态 | 当前消费者 | 发布身份 | 失败路径 |
| --- | --- | --- | --- | --- |
| OpenAPI | tracked generated | package export、两个检查器、candidate | `contractHash` 输入 | 漂移 check 依赖 contractgen/TS |
| events.json | tracked generated，只有 type/version/module | package export、candidate | `contractHash` 输入 | schema/handlers 变化不旋转该字段，关联 F-0039 |
| SDK operation files | tracked generated | Console/Storefront/测试 | Web client directory hash | 运行统一落到 ApiClient |
| Controller/Handler | tracked generated | Commerce composition | Commerce OCI hash | 缺 handler/route 在启动 freeze 前后拒绝 |
| Event registry | tracked generated Map | modules duplicate check、publisher | Commerce OCI hash | unknown type/version 在 DB transaction 前拒绝 |
| current.sql | tracked generated snapshot | contract test；无运行 loader | 不进 candidate | 误作迁移会产生未审执行风险，当前无入口证据 |
| Miniapp domain files | tracked generated | 仅 candidate 整目录复制；运行 import 为 0 | Miniapp directory hash | 外部完整工程 UNKNOWN，关联 F-0006 |

## 5. runtimegraph 状态冲突

1. 正式入口为 `npm run check:runtimegraph`，并串入 `audit:architecture` 和 `quality:canonical-hard-cut`。
2. 固定基线的业务决策是“不发送/不强制旧 contract version”；ApiClient/HttpApp 源码和测试一致。
3. checker 仍要求 SDK 版本头、Miniapp 版本头和 HTTP 426。
4. checker 对不存在的 Miniapp 文件直接 `readFileSync`，会在统一 `report` 前抛 ENOENT。
5. 本环境更早因 `typescript` 缺失退出；静态逐 token 复算得到 1 个缺文件和 3 个缺 token。正式结果记为环境阻塞，逻辑冲突记为代码事实。
