# AU-020｜微信支付 APIv3 适配器

## 1. 边界与覆盖

- 固定源码基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`；开工检查点 CP-19 `966384e3`。
- 覆盖 `01_core_hexin/extensions/payment/wechat` 18/18 文件、1,873/1,873 行，全部深入审阅；并沿生产调用链复核 Purchase API、Payment Webhook API、Payment Jobs、`WechatGateway`、`PaymentWebhook` 和 provider 时间校验。
- 范围包括配置、密钥导入、请求签名、响应验签、通知验签/解密、模型解析、支付/退款/关闭客户端、测试与包入口。
- 没有读取真实密钥、访问微信接口、安装依赖、构建、修复、删除、推送、合并、部署或改变线上资源。

## 2. 真实架构

[FACT][E-AU-020-002/003] `@shop/wechatpayment` 是随 Commerce 进程编译的私有适配器，不拥有进程、端口、数据库或独立发布单元。Purchase API 创建预支付，Payment Jobs 查询/关闭/退款，Payment Webhook API 对原始通知正文验签解密；三类 runtime 都从节点绑定的 secret ref 读取支付配置，并把回调 host/scope 与 Node Manifest 绑定。

[FACT][E-AU-020-004/005] 出站链对规范方法、URL、正文、时间戳和 nonce 进行 RSA-SHA256 签名；所有成功、错误和空 204 响应均先按平台密钥验签。入站链限制 64 KiB、校验签名时间窗和 KeyID、AES-GCM 解密后再检查商户、应用、金额、付款人摘要、订单/退款引用；数据库层最终以本地意图和事件去重执行状态转换。

[FACT][E-AU-020-006] 退款申请使用稳定退款号；仅查询操作由 Executor 自动重试，退款申请遇到可重试基础设施失败时改为按稳定退款号查询，避免盲目重复写入。这是本模块最值得保留的设计。

## 3. 主要结论

- [P2][E-AU-020-007] 配置加载只用 PEM 外壳正则检查密钥，不导入验证。合成畸形 DER 可通过配置加载，但在首次签名/验签时由 WebCrypto 抛出原始 `DataError`，形成 F-0091；错误晚于启动且绕过模块错误契约。
- [P2][E-AU-020-008] `Transport.send` 只包裹取得响应头之前的 fetch；响应正文流在超时或网络中断时抛出的原始异常不被转换为 `WechatPayProtocolError`。`WechatGateway` 因此把真实基础设施故障判为不可重试、也不计入断路器，形成 F-0092。
- [P3][E-AU-020-009] 公共 prepay/refund 输入允许调用者覆盖 `notifyUrl`，但只验证其它字段并直接写入请求；当前唯一生产 caller 始终传入已验证的 scoped URL，所以这是 API 边界缺口而非已发生的生产回调劫持，形成 F-0093。
- [P3-QUALITY][E-AU-020-010] 现有28个测试用例覆盖签名、验签、金额/身份匹配、重放、密钥轮换和UTF-8截断，但没有畸形PEM、流中断/超时、响应体上限/编码、caller callback override 和畸形provider时间的反事实。该缺口计入 F-0091–F-0093 的验证范围，不另立重复问题。

本AU新增P2 2项、P3 1项；累计P0 0、P1候选10、P2 46、P3 36、NIT 1。没有新增垃圾代码候选，累计G0 2、G1 21、G2 2、G3 0、GX 2。

## 4. 验证与未知

- 正式 `npm test -- --reporter=dot` 与 `npm run typecheck` 均因固定审计工作树缺 `vitest`/`tsc` 在加载源码前以127退出；未安装依赖。
- 合成密钥探针证明私钥/公钥正则均返回true，而 WebCrypto PKCS8/SPKI 导入均以 `DataError: Invalid keyData` 拒绝。
- 本地环回 HTTP 探针证明响应头返回后正文流超时，第二次 `reader.read()` 抛出原始 `TimeoutError`；源码的正文读取位于 fetch catch 之外。
- [UNKNOWN] 线上实际 secret 内容、平台证书轮换状态、真实微信响应/通知分布和当前进程版本；本AU未访问。

