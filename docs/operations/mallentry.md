# 商城二维码入口硬切手册

本手册只适用于网络权威生成的 `${PUBLIC_STOREFRONT_ORIGIN}/s/{publicSlug}` 单入口硬切；当前生产示例是 `https://fufu.wang/s/{publicSlug}`，本地是 `http://127.0.0.1:3000/s/{publicSlug}`。禁止旧实例与新 Schema 同时运行，禁止临时 Host Resolver、兼容 View、双写或第二域名。

## 发布前准入

1. 确认候选制品中的 Commerce、Console、Storefront、Auth 来自同一 commit、签名和发布清单，`schemaHead` 为 `20260901016000`。
2. 以不可变 SemVer 设置 `VITE_CLIENT_VERSION` 并运行 `npm run build:clients:production`；该入口必须从生成的 Network Catalog 注入 API、Auth、Console 和 Storefront Origin，制品中不得出现本地 Origin。
3. 完成全量迁移重放、升级重放、PITR 恢复演练；核对 slug 全局大小写不敏感唯一、每个 Mall 最多一个 Application、每个 Application 恰有一个 Mall、每个 Active Release 恰有一个 Pool 和 Active Publication。
4. 确认 Edge、Auth、Console、Storefront、API 的配置 Hash 相同，当前生产 Origin 分别为 `fufu.wang`、`passport.fufu.wang`、`console.fufu.wang`、`api.fufu.wang`。
5. 选定一个经营中且已发布的验收商城，记录 Application、Mall、Pool、Release、Version 和 `publicSlug`；不得记录 Cookie、Token、会员 ID 或手机号。
6. 验证数据库快照可读、PITR 时间点已记录、上一完整制品和上一 Edge 配置可恢复。

## 硬切顺序

严格按下列顺序执行并为每一步保存带时间戳和 SHA-256 的证据：

1. 冻结商城创建、复制、装修、发布、回滚、启停写入。
2. 创建数据库发布前快照并验证可恢复性。
3. 停止旧 API 和 Jobs，等待事务、Outbox 与 Inbox 收敛；不得保留旧实例。
4. 依次执行 `20260901014000_mall_storefront_entry.sql`、`20260901015000_publish_mall_storefront_entry.sql` 与 `20260901016000_publish_stepup_disable_contract.sql`，任何前置检查失败都终止发布，不自动修数据。
5. 部署同一签名制品中的 Commerce API、Jobs、Console、Storefront 和 Auth。
6. 清理全部旧入口命名空间键；新入口键只允许 `storefrontentry` 版本化键。不得删除无关缓存。
7. 将 Edge 的 `/s/*` 深链及 `index.html` 回退切到新 Storefront 制品，同时保持 API、Auth 与 Console Host 不变。
8. 使用验收商城运行 `SHOP_SMOKE_MALL_URL=${PUBLIC_STOREFRONT_ORIGIN}/s/<publicSlug> npm run smoke:mallentry`；必须同时通过页面、Bootstrap、Mall/Pool/Release/Version 绑定和独立二维码解码。
9. 用真实 iOS 与 Android 相机扫描 Console 下载的 1024×1024 PNG，核对地址栏、商城名称、装修版本和商品池；A/B 两个商城各扫一次，禁止串店。
10. 按 1%、10%、50%、100% 恢复流量。每一档观察入口解析、Bootstrap、跨商城拒绝、发布激活、缓存失效、延迟和错误率，全部通过才推进。
11. 解冻写入，创建一次草稿、发布、回滚、停用、重新启用，确认 URL 始终不变且状态即时生效。

## 立即停止条件

- 二维码解码结果不是规范 URL，或复制、下载、打开得到不同 URL。
- A 商城解析到 B 商城的 Mall、Pool、Release 或 Version。
- 已发布商城为 `invalid`，未发布商城可读取草稿，停用商城仍返回旧版本。
- 入口解析失败率五分钟超过 1%，Bootstrap p95 超过 300 ms，或跨商城 Session 拒绝异常上升。
- 发布成功但 `storefrontentry` 精确失效未完成，或数据库出现多个 Active Release/Publication。
- Edge Host、构建配置和服务端 Origin Hash 不一致。

## 回滚

回滚是完整快照恢复，不是运行期兼容：

1. 立即冻结流量和写入并停止全部新实例。
2. 从发布前数据库快照或已验证 PITR 时间点恢复；禁止在新 Schema 上启动旧实例。
3. 恢复上一完整签名制品和与其绑定的 Edge 配置、静态制品指针与缓存命名空间。
4. 运行上一版本的数据库、功能、安全、二维码和真实手机验收。
5. 验收全绿后按流量阶梯恢复；保留失败证据并进入复盘，禁止现场添加兼容代码。

## 证据与监控

发布证据至少包含候选制品 Hash、数据库快照、迁移输出、配置 Hash、Smoke Hash、真实手机验收、四档流量决策和回滚演练。日志只允许 requestId、traceId、operation、entryState、applicationHash、releaseVersion、errorCode、duration；禁止完整 IP、Cookie、Access Token、会员 ID、手机号和完整 Application 名称。
