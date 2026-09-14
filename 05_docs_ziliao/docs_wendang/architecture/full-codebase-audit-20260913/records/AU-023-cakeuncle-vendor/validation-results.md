# AU-023 验证结果

## 正式入口

- `npm test -- --reporter=dot`：退出127，`vitest: command not found`。
- `npm run typecheck`：退出127，`tsc: command not found`。
- 未安装依赖；未执行等同typecheck的build。

## 定向只读验证

- 完成16文件及4个直接provider family的静态调用链核对。
- 深度探针：1,000层/6,004字节通过；5,000层/30,004字节、10,000层/60,004字节、20,000层/120,004字节均触发`RangeError: Maximum call stack size exceeded`，支持F-0099。
- 专用Webhook只由测试直接引用且未进入barrel；Foodvoucher生产factory注册的是Provider Core通用Webhook，支持F-0100/DC-0028。

## 未验证

- 线上Foodvoucher是否启用、真实endpoint/协议版本、Cakeuncle回调签名规范、实际内存/栈参数和secret配置均未访问。
- F-0100保持P1候选并进入RV-0016；DC-0028/GX进入RV-0017。
