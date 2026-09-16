# AU-020 验证结果

## 正式入口

- `npm test -- --reporter=dot`：退出码127，`vitest: command not found`；测试源码未加载。
- `npm run typecheck`：退出码127，`tsc: command not found`；源码未进入类型检查。
- 未安装依赖，未执行会写入 `dist` 的 build。

## 只读反事实

1. 使用不含真实凭据的 `AAAA` 合成DER分别包裹为PKCS8/SPKI PEM。`Config.ts`同构正则接受两者，Node WebCrypto导入均返回`DataError: Invalid keyData`，证明F-0091。
2. 本地环回HTTP先返回响应头和一个正文块，再延迟后续正文；同一fetch signal超时后第二次`reader.read()`抛原始`TimeoutError`。`Transport.send`的catch只覆盖fetch调用，证明F-0092传播路径。
3. 全仓追踪 `createJsapiPrepay`/`applyWechatPayRefund`：生产 `WechatGateway` 传入 `resolveWechatPayNotifyUrl`，三个runtime再绑定Manifest host/scope；因此F-0093没有被扩大为已证实生产事故。

所有结论均固定在基线SHA；没有访问微信、数据库、secret store或线上进程。

