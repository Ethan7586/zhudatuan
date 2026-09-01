# 福利商城 MVP 本地 Chrome 验收报告

## 1. 验收结论

`docs/福利商城功能清单.xlsx` 的 `MVP上线功能清单` 中备注严格等于 `OK` 的 14 行已全部完成本地 Chrome 验收。覆盖密码登录、真实短信验证码登录、邀请码登录、活动邀请注册、控制台、集团端、商城端、商城二维码、扫码/新窗口跳转、11 个优先级一 Provider、退出登录；结算流程在提交真实订单和发起支付之前停止。

真实 Chrome 的每一步成功状态均已留存为画面，并按操作顺序合成为四段带普通话讲解的 MP4。成片只包含正常流程，不包含排障、失败页面或异常解决过程；手机号、验证码、密码、邀请码、AccessKey、Secret、Token 和会话证明均未进入成片、讲稿或报告。

## 2. 权威依据与环境

- 功能范围：`docs/福利商城功能清单.xlsx` → `MVP上线功能清单` → `A1:F24` → 备注严格等于 `OK`。
- 后端约束：`docs/architecture/后端架构优化方案.md`。
- 二维码约束：`docs/architecture/商城二维码方案.md`。
- 验收日期：2026-09-01。
- 浏览器：用户真实 Chrome 会话。
- 本地运行时：PostgreSQL、Redis、Commerce API、Jobs、Provider、Auth、Console、Storefront、本地 Secret Store、KMS 与 Object Store。
- 数据库最终目录：284 个迁移、272 个 Operation；完整目标 Schema 回放通过。

## 3. 工作簿逐行覆盖

| 行号 | 层级 / 功能 | 工作簿要求 | Chrome 与自动化证据 |
| ---: | --- | --- | --- |
| 5 | 集团层 / 数据大屏 | 销售、数量、退单、分应用；实时、昨天、近 7 天、近 30 天 | 集团驾驶舱指标、趋势、订单结构及四周期往返均完成 |
| 6 | 集团层 / 应用（商城） | 创建、复制、管理、装修多个应用 | 商城应用列表、筛选、搜索、详情、管理、装修与发布上下文均完成 |
| 8 | 集团层 / 订单管理 | 商品订单、售后订单 | 集团订单列表、详情、商品、支付只读、售后、审计页签均完成 |
| 11 | 集团层 / 数据统计 | 商品、商城、分类、渠道、卡券等销售数据 | 七类报表及四周期切换均完成 |
| 12 | 集团层 / 客服中心 | 分配规则、人员、账号、聊天与历史 | 规则、坐席、账号、SLA、工单、会话、消息与历史均完成 |
| 14 | 商城层面 / 数据 | 销售与退单；四周期 | 商城驾驶舱指标、订单结构及四周期往返均完成 |
| 15 | 商城层面 / 装修 | 商城装修 | 装修列表、编辑器、发布状态，以及每商城独立入口与二维码均完成 |
| 16 | 商城层面 / 商品池 | 整体、渠道、自有、加价商品池及治理操作 | 商品列表、状态筛选、商品池、新建及详情五页签均完成 |
| 17 | 商城层面 / 订单管理 | 商品订单、售后订单 | 商城订单列表、详情、支付只读、售后与审计均完成 |
| 20 | 商城层面 / 数据统计 | 商品、商城、分类、渠道、会员/粉丝、卡券 | 七类商城报表及四周期切换均完成 |
| 21 | 商城层面 / 客服中心 | 设置、聊天、历史 | 商城范围内规则、坐席、账号、SLA、工单、会话、消息与历史均完成 |
| 22 | 商城层面 / 设置 | 管理员、角色、权限、项目、会员、供应商、门店、短信、风控 | 成员、权限、邀请、角色、项目、会员、伙伴、渠道、通知、公告、模板和系统治理均完成 |
| 23 | 其他 / 用户注册登录 | 注册；密码、验证码、邀请码登录 | 四类身份路径均完成，且每条路径最终退出登录 |
| 24 | 优先级一接口 | 优先对接但不单设业务功能 | 京东、京东生鲜、天猫超市、自有供应商、蛋糕、鲜花、图书、虚拟直充、食品提货券、电影、在线点餐共 11 个 Provider 的注册、边界与可执行合同通过 |

## 4. 身份与真实短信验收

完成的真实身份路径如下：

1. 已有控制台管理员通过密码登录，完成高安全等级验证并退出。
2. 在商城 Scope 创建一次性活动邀请；新用户填写真实手机号，阿里云实际发送注册验证码，手机端确认收到，验证码被一次性消费后注册成功。
3. 新注册员工首次使用密码登录商城，商城与会员绑定正确，随后退出。
4. 同一员工再次选择验证码登录；阿里云实际发送登录验证码，手机端确认收到，验证码被一次性消费后登录成功，随后退出。
5. 一次性邀请码登录成功；邀请码消费后不可重放。

短信供应商返回了非空外部回执，注册与登录两条投递状态均为 `sent`、Provider 均为 `aliyun`。报告只记录状态，不记录手机号、验证码、外部回执值或任何密钥。

## 5. 商城二维码验收

- 每个商城应用在装修列表拥有统一“商城入口”；未发布版本不伪造可扫码状态。
- 地址由服务端按发布版本、商城 Handle 和环境权威配置生成，规范路径为 `/s/{handle}`。
- 本地实测地址为 `http://127.0.0.1:3000/s/zhudatuan-local`；生产权威入口由边缘配置生成 `https://fufu.wang/s/{handle}`。
- 页面地址、复制地址、下载二维码承载地址和独立解码结果逐字一致。
- 二维码为 1024 像素 PNG、M 级纠错、4 模块静区；二维码本身不携带 Token、会话、邀请码或其他秘密。
- 未登录打开商城入口时保留目标商城并进入统一身份入口；登录后只返回原商城，会员会话与商城强绑定。
- 独立二维码解码器恢复了完全相同的本地规范地址。
- 列表、弹窗、复制、下载、游客跳转、登录入口、登录提交及会员首页共 8 个正常画面已进入 `MallQr.mp4`。

## 6. 域名自适应

运行时代码中不再依赖固定 `hbbtzn` 域名：

- 本地唯一权威来源由 `tools/localinfra/src/Prepare.ts` 生成：服务端 `PUBLIC_STOREFRONT_ORIGIN=http://127.0.0.1:3000`，客户端 `VITE_STOREFRONT_ORIGIN=http://127.0.0.1:3000`。
- 生产唯一权威来源为 `infrastructure/network/Edge.yml` 与生成的 Network Catalog：Storefront 使用 `fufu.wang`，API、Auth、Console 使用各自子域。
- 服务端地址值对象只允许 HTTPS；唯一例外是开发环境精确主机 `127.0.0.1` 的 HTTP，不接受普通域名 HTTP。
- Console、Auth 与 Storefront 只读取环境配置；同一业务代码和构建流程适配本地、开发、预发与生产，不含环境名称分支或重复域名配置。

## 7. AccessKey 与 Secret 的环境配置

本地输入的 AccessKey 与 Secret 已与本地 Secret Store 中的值逐项核对一致，并通过阿里云官方接口验证：当前身份可识别为 RAM 用户，短信签名查询成功且签名为已审核状态。密钥值不写入 Git、普通 `.env`、浏览器、视频、报告或日志。

配置位置与运行时链路：

| 环境 | 非秘密选择器 | 凭据来源 | 说明 |
| --- | --- | --- | --- |
| 本地 | 忽略提交的 `services/commerce/.env.local` 中 `NOTIFICATION_CONFIG_REF=shop/local/notification` | 忽略提交且权限为 600 的 `infrastructure/container/local/secrets.local.json` 内引用 `shop/local/notification/sms` | Secret 仅含 `accessKeyId` 与 `accessKeySecret` |
| 开发 | `services/commerce/.env.jobs.example` 示例为 `shop/development/notification/aliyun` | 开发环境 Secret Manager 引用 | 禁止复用本地或生产密钥 |
| 预发 | `shop/staging/notification/aliyun` | 阿里云 RAM 运行时角色 | IMDSv2 获取短期凭据 |
| 生产 | `shop/production/notification/aliyun` | 阿里云 RAM 运行时角色 | 不保存长期 AccessKey |

唯一装配链路为 `CommerceRuntime → DeliveryConfiguration → SmsFactory → SMS Adapter`。详细轮换、最小权限和事故处理规范见 `docs/operations/notification.md`。由于长期密钥曾出现在本次对话中，验收完成后应在阿里云 RAM 立即轮换，并只更新对应环境的 Secret Manager 引用。

## 8. 视频与讲解

| 文件 | 成功画面 | 时长 | 规格 | 内容 |
| --- | ---: | ---: | --- | --- |
| `Authentication.mp4` | 11 | 116.447 秒 | H.264 1512×744；AAC 单声道 | 注册、密码、验证码、邀请码登录与退出 |
| `MallQr.mp4` | 8 | 111.182 秒 | H.264 1512×744；AAC 单声道 | 商城入口、二维码、复制、下载、游客/会员跳转 |
| `Console.mp4` | 110 | 675.690 秒 | H.264 1512×744；AAC 单声道 | 集团端、商城控制台、设置与 Provider |
| `Storefront.mp4` | 32 | 215.330 秒 | H.264 1512×744；AAC 单声道 | 员工商城完整操作；支付前停止；最后退出 |

普通话讲解使用 macOS `Tingting`，语速为 145。每个成功画面的持续时间等于对应讲解音频真实时长再加 0.45 秒停顿，因此音画逐段一一对应。完整文本见 `Transcript.md`，唯一成片定义见 `VideoManifest.json`。

已完成两层视觉核验：一是抽查真实 Chrome 原始成功帧；二是从四个最终 MP4 生成实际视频缩略图并复核。画面清晰、布局统一、二维码完整、无异常页。

## 9. 验收中定位并修复的最小根因

1. 邀请接收人和验证码挑战曾使用不同手机号规范化边界，导致同一号码的国内格式与 `+86` 格式哈希不一致；统一复用身份域的规范化值对象后再哈希。
2. 四个订单展示分支曾把缺失图片映射为空字符串后仍渲染图片标签；统一复用 `ProductMedia`，空地址只呈现受控空态。
3. 报表行键遗漏事实表自然主键中的周期开始值；统一以指标、版本、Scope、周期开始与维度构造稳定键。
4. 成片工具曾把可再生音频写入受治理工作树；调整为系统临时目录，结束后自动清理。
5. 阿里云 Dysmsapi 使用 RPC 风格参数，但自研 ACS3 请求曾按 JSON Body 签名；改为规范 Query、空 Body、空载荷 SHA-256 与官方百分号编码，签名向量与官方 SDK 逐字一致。
6. 绑定新手机号的挑战曾在验证当前账号之前产生外部短信副作用；将 `identity.mobile.challenges.create` 提升为 MFA 保障级别，先验证当前账号再投递新号码挑战。
7. 集团 Scope 的邀请弹窗曾显示只允许商城 Scope 使用的“活动邀请”；UI 依据 `ConsoleScopeKind` 隐藏不适用类型并清理陈旧选择，后端授权拒绝仍保持不变。
8. `identity.stepup.disable` 已存在实现但未进入数据库 Operation 目录；新增单向发布迁移并更新权威契约目录，完整回放后达到 284 个迁移、272 个 Operation。
9. 首次全量质量执行未注入强制集成测试 PostgreSQL/Redis 端点，仓储测试按设计失败关闭；根因是验收命令环境缺失，不是业务代码。随后从验收容器安全提取临时连接环境并重新执行完整质量链，未降低或跳过任何门禁。
10. Auth 的 Provider Bootstrap 请求虽做了并发去重，却错误继承首个 React 消费者的 AbortSignal；StrictMode 首轮 Effect 清理会取消共享 Promise，第二轮 Effect 复用后无法加载返回目标。现将共享网络请求生命周期与单个消费者取消解耦：底层只发一次请求，每个消费者独立响应取消；新增并发回归测试后，20 项五 Worker E2E 全部通过。

## 10. 质量证据

- `npm run quality`：使用隔离的验收 PostgreSQL 与 Redis 端点执行完整链，最终退出码 0，未跳过任何步骤。
- 架构门禁：命名、模块边界、Schema 所有权、重复逻辑、调用图、分页、性能、事务、前端边界、Operation、事件、Provider、扩展、Job、导航、依赖、需求图、运行时图均为 0 违规。
- 调用完整性：`scripts/check/calls.mjs` 通过，调用点断裂 0。
- 重复逻辑与配置：`scripts/check/duplicates.mjs` 通过，违规 0。
- 拓扑：272 个 Handler、92 个 Repository、22 个 MVP、11 个 Provider、3 个客户端均可追踪。
- 数据一致性：284 个迁移全量目标 Schema 回放通过；MVP、支付和财务内核通过；RLS、Inbox 幂等与 Job 排他租约在真实 PostgreSQL 上验证。
- 契约：1096 项 Commerce 契约测试通过；二维码独立解码与工作簿优先级一 Provider 合同通过。
- 浏览器 E2E：20 项、5 Worker 全部通过；包含二维码独立解码、320/768/1366/1440 响应式可访问性，以及扫码受保护深链登录后原商城路径恢复。
- 主测试集：Auth 20 项、Console 92 项、Storefront 54 项、Commerce 376 项全部通过；Journey 181 项、安全 21 项、性能 9 项全部通过。
- 供应链：713 项许可证策略通过，Secret 扫描 0 项发现。
- 构建与包体：Auth、Console、Storefront、Commerce 以及全部 Workspace 构建和 Bundle 策略通过。
- 本地运行时复核：`npm run local:verify` 通过，数据库 284 个迁移、272 个 Operation，公开权限越界为 0。

## 11. 文件完整性

```text
ea7877cbf975d00c48cab957d8d10937adb0c07e49ef988c952981cda2d95400  Authentication.mp4
53ce65dbfd3234aba0e94dfda8e71eb03d05d423a47b5380febd81513ab6b859  MallQr.mp4
ee3aa8d0c6a39b8874b6dc00619fee0b96a7f43d910e8e35b06746a9e6f63db2  Console.mp4
c285e36d4c7d99acf8610c007103eb585001dec5086af95d3a1ed9786eb33403  Storefront.mp4
```

## 12. 可复现性与隐私

- `VideoManifest.json` 是唯一成片清单；`BuildNarratedVideo.swift` 只消费真实 Chrome 成功帧并生成讲解、讲稿和 MP4。
- 临时语音及中间视频仅存在于系统临时目录，生成结束自动删除。
- 最终文本产物经模式扫描，未发现 AccessKey、手机号或已知 Secret；视频画面中的个人数据使用掩码或本地合成验收身份。
- 支付被明确跳过；没有提交真实订单、没有发起支付、没有修改外部供应商数据。
- 隔离验收 API、Jobs、Provider、前端、本地支撑服务及两个临时容器均已停止；临时容器随停止自动删除。用户原有 `zhudatuan-local-postgres-1` 与 `zhudatuan-local-redis-1` 已恢复，健康检查分别为 accepting connections 与 PONG。
