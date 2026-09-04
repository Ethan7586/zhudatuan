# 智慧翼多端并行交付标准

版本：1.0
生效日期：2026-08-15
Owner：Ethan

## 1. 硬约束

每项业务能力只有一套服务端真值、一套状态机和一套接口语义。

- 当前强制交付对：Web + 微信小程序。
- 未来正式保留端：鸿蒙、iOS、Android。
- Web 或小程序任一端未完成时，只能写“单端完成”或“实施中”，不得写“业务完成”。
- 平台差异只允许存在于适配器；价格、资格、库存、订单、余额、支付结果和会员码状态不得在客户端各写一套。
- 新能力先确定共享合同和一致性模式，再写页面。

机器可读现状记录在 `packages/api-contract/src/delivery-matrix.json`，由 `npm run check:platform-delivery` 守门。

## 2. 正式分层

```text
Web ─────────────── Browser adapters ─────┐
微信小程序 ──────── WeChat adapters ──────┤
鸿蒙（预留）──────── HarmonyOS adapters ──┤
iOS（预留）───────── iOS adapters ────────┤──► shared API contracts
Android（预留）───── Android adapters ────┘            │
                                                        ▼
                                                 Commerce API
                                                        │
                                              domain state machines
                                                        │
                                                        ▼
                                              PostgreSQL transaction truth
```

客户端适配器只负责：

- 身份凭据获取；
- 调起平台支付；
- 安全存储；
- 分享和复制；
- 导航与生命周期；
- 网络状态与遥测。

正式端口定义在 `packages/api-contract/src/platform.ts`：

- `PlatformIdentityAdapter`
- `PlatformPaymentAdapter`
- `PlatformStorageAdapter`
- `PlatformShareAdapter`
- `PlatformNavigationAdapter`
- `PlatformLifecycleAdapter`
- `PlatformTelemetryAdapter`

## 3. 同步操作

同步不是“客户端立即改成功”，而是服务端在同一请求中给出权威事务结果。

适用于：

- 加入、修改、删除购物车；
- 保存地址；
- 创建订单；
- 修改个人资料；
- 明确可在单事务内完成的账户操作。

规则：

1. 客户端提交幂等键或稳定资源版本。
2. 服务端完成鉴权、资格、价格、库存和事务校验。
3. 成功响应返回权威快照，不由客户端自行推算最终状态。
4. 客户端可做可逆乐观更新；失败必须回滚或以服务端快照覆盖。
5. Web 与小程序使用同一路径、同一字段、同一错误码。

## 4. 异步操作

适用于：

- 微信支付、退款和主动查单；
- 订单中心、物流和外部供应商同步；
- 动态会员码挑战与消费；
- 图片处理、目录发布和缓存刷新；
- 任何依赖外部系统回调的工作。

统一状态：`queued / processing / succeeded / failed / cancelled`。

异步响应必须能提供：

- `operationId`
- 当前 `state`
- `requestId`
- `updatedAt`
- 可选 `retryAfterMs`
- 成功结果或稳定错误码

客户端“调起成功”不等于业务成功。支付只能由服务端验签通知或主动查单收敛；会员码只能由服务端消费结果收敛；缓存发布只能由版本读回验证收敛。

## 5. 数据与缓存一致性

- PostgreSQL 是订单、支付、余额、库存预占和会员码消费的唯一写入真相。
- Tair、CDN、OSS、浏览器缓存和小程序本地快照只保存可重建读模型。
- 每个读模型带版本或更新时间；端内缓存不得跨账号复用私有数据。
- 公开目录允许最终一致；购买前必须回主库重新验证价格、资格和库存。
- 写后读取优先返回本次事务结果，后台再使缓存失效或更新投影。

## 6. 平台差异边界

| 能力 | Web                              | 微信小程序                 | 鸿蒙 / iOS / Android            |
| ---- | -------------------------------- | -------------------------- | ------------------------------- |
| 登录 | Host-only Cookie / Web OAuth     | `wx.login` 换短期 Bearer   | 系统认证或 SDK 换同类服务端会话 |
| 支付 | 浏览器 JSAPI、二维码或跳转适配器 | `wx.requestPayment` 适配器 | 原生支付 SDK 适配器             |
| 存储 | 安全 Cookie、受限 Web Storage    | 微信 Storage               | Keychain / Keystore / HUKS      |
| 分享 | Web Share / Clipboard            | 微信分享能力               | 原生 Share Sheet                |
| 导航 | Router                           | 微信页面栈                 | 原生路由                        |

这些差异不得进入购物车、订单、资格、账户和支付状态机。

## 7. 完成定义

一项跨端能力只有同时满足以下条件才可写“完成”：

1. 共享接口和状态机已冻结。
2. Commerce API、数据库事务和权限验证通过。
3. Web 成功、空、失败、超时、重试状态通过。
4. 微信小程序相同状态通过，并有开发者工具或真机证据。
5. 同一账号在两端看到相同业务事实。
6. 鸿蒙、iOS、Android 所需能力可通过既有适配器端口接入，无需复制业务规则。
7. `check:platform-delivery` 与全量 `quality` 通过。

## 8. 当前购物闭环裁决

- 公开目录：Web + 小程序已同源，达到多端交付。
- 服务端购物车：Web + 小程序已同源，达到多端交付。
- 创建订单：Web + 小程序已走同一服务端事务，达到多端交付。
- 支付确认：**尚未达到多端完成**。小程序已有微信支付调起与服务端轮询；Web 目前只有内部福利/餐卡支付，缺外部支付适配和统一异步确认。
- 动态会员码：**尚未达到多端完成**。不得因小程序已有界面就宣称业务完成。

下一步支付工作必须先补共享支付会话合同，再分别实现 Web 支付适配器和微信小程序适配器，服务端继续作为最终状态唯一裁判。
