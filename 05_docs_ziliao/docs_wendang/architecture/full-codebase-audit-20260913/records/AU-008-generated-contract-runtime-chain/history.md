# AU-008 历史取证

历史只解释固定基线的边界，不替代当前运行代码。

## 1. contract-version 运行时退出

- `57c1177d42bfe3a36777d9e8bbb29d852cb36d8b`（2026-09-13，`refactor(契约): 全局退出旧契约运行时校验`）同时删除了 `ApiClient` 的版本匹配/请求头、成功响应 schema parse，以及 `HttpApp` 的 426 阻断；同提交更新测试，明确缺失或旧版本头仍执行 route。
- 该提交没有修改 `04_tools/scripts/audit/runtimegraph.mjs`。因此 F-0045 不是根据注释猜测，而是同一历史决策只更新运行代码/测试、遗漏架构 checker 的可复核漂移。
- 当前 `RequestContext.contractVersion`、`ApiError.contractResponse` 和 `defineStructuralOperation` 仍保留，说明退出是渐进兼容变化；不能据此直接删除公开符号。

## 2. action proof 与 CORS

- `fe3269c8`（2026-09-04）把 `x-action-proof` 加入 SDK request 构造，同时建立 HttpApp 的固定 preflight allowlist；该 allowlist 当时就没有该头。
- `c289e6647`（2026-09-06）随后为设备预检补 `x-device-id`，仍未加入 `x-action-proof`。
- 固定基线的 Console Finance/Owner tests 和 Browser OperationMock 已按 proof header 工作，生产 allowlist 没有同步；F-0044 因而是从引入时持续存在的接缝，不是本次审计造成的新变化。

## 3. 生成与制品身份

- contractgen 当前把 `events.yml` 投影为只含 type/version/module 的 `events.json`，并单独把 schema 写入 current.sql、handlers 写入 Commerce registry。
- release candidate 对 OpenAPI/Event JSON 原始字节求 `contractHash`，再分别记录客户端目录和 Commerce OCI 哈希。它与 `CONTRACT_CHECKSUM` 是不同算法、不同覆盖面的身份；不能互换。
- `current.sql` 历史上随 contractgen 持续更新，但固定仓库没有 migration/release loader；Git 历史不能证明它当前会被应用。

## 4. Wechat transport

- `WechatTransport` 与 `createWechatCommerce` 在现有历史链中作为 SDK 适配端口保留；固定仓库没有 Miniapp 或其它生产 caller。
- 没有找到后续提交为 success body 的 undefined/序列化异常补测试或恢复分支；因此 F-0046 保持 P3，并把仓外消费者列为 UNKNOWN。
