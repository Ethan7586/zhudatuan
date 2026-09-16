# AU-021 验证结果

## 正式入口

- `npm test -- --reporter=dot`：退出码127，`vitest: command not found`；源码未加载。
- `npm run typecheck`：退出码127，`tsc: command not found`；源码未进入类型检查。
- 未安装依赖，未执行build。

## 只读反事实

1. 合成固定timestamp/body和测试HMAC key，分别标记event:A与event:B。两者签名完全相同，因为实现签名材料只有`timestamp.body`。
2. 生产`ProviderWebhookRequest`不含event ID；ApplyWebhook另从`x-provider-event-id`读取并交给`channel.accept_webhook`。
3. 数据库唯一键和inbox ID只基于`connection + external ID`；改写ID会插入新行、排新job，job再按新inbox ID写独立outbox。
4. 当前单测构造的是`src/Webhook.ts`包装器，Verifier收到含externalId的另一种request；该包装器没有生产实例化路径。

未访问线上provider、secret、数据库或日志；F-0094保持P1候选并进入RV-0013，不升级P0。

