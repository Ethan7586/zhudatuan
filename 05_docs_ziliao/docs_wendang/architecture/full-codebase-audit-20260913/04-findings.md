# 全代码库系统审计｜04 问题清单

## 1. 计数口径

本文件只收录已经形成最小证据链的问题。AU-042 结束时累计：P0 0、P1 候选 19、P2 60、P3 57、NIT 1。P1 项尚未完成第二轮独立复核，因此不会写成最终定级。

## F-0147｜Checkout 报价创建关键事实链缺少专用行为测试

| 字段 | 记录 |
| --- | --- |
| 模块 | checkout / Commerce 与 Purchase API 报价创建 |
| 类型 | 高价值事务、签名与运行时边界的测试缺口 |
| 严重级别 | **P2** |
| 置信度 | 高（测试文件集合、正式入口与实现链均直接核验） |
| 文件和精确位置 | `01_core_hexin/services/commerce/src/modules/checkout_jiesuan/05_interface_jieru/http/CheckoutOperations.ts:14-61`；`.../modules/purchase/PurchaseOperations.ts:41-72,224-255`；`.../modules/checkout_jiesuan/06_tests_ceshi/` |
| 当前/预期 | 现有 oracle 覆盖 manifest、地址默认、跨 Mall 历史与单一 stale-version 不变量，但没有直接执行两个 quote handler 的签名、quote/session/evidence/outbox 原子写入、幂等重放、expectedVersion、15 分钟失效与 Purchase voucher 禁用链。预期为这些可观察契约至少有隔离的 handler/integration 行为验证。 |
| 影响 | 后续变更可能让报价与会话/事件失去原子性、签名/失效语义漂移或让 Purchase 运行时越过其 tender 边界，而现有模块测试未必报警。当前线上是否发生此类故障未验证。 |
| 根因 | 结算事实链复用通用报价模型，却只留下对内部适配器和全局 policy 的局部 mock oracle，未为两个真实运行入口建立端到端契约。 |
| 验证/回滚 | 后续独立测试批次使用隔离 PostgreSQL，分别覆盖完整与 Purchase handler 的成功、同幂等键重放、版本冲突、过期、签名篡改、写入失败回滚及 voucher 输入；修复必须从当时最新主线独立分支进行，回滚为撤回该测试/实现批次。 |
| 独立复核 | 否 |

## F-0148｜售后指定明细未绑定目标订单，缺省退款金额不具行级语义

| 字段 | 记录 |
| --- | --- |
| 模块 | order aftersales / payment refund / supplier fulfillment |
| 类型 | 数据归属与退款正确性 |
| 严重级别 | **P2** |
| 置信度 | 高 |
| 文件和精确位置 | `01_core_hexin/services/commerce/src/modules/order_dingdan/03_application_yingyong/services_fuwu/OrderOperations.ts:79-98`；`.../modules/payment_zhifu/05_interface_jieru/jobs_renwu/PaymentJobs.ts:221-246`；`.../modules/payment_zhifu/03_application_yingyong/services_fuwu/RefundPlanner.ts:45-112` |
| 当前/预期 | `body.line` 只由单列 FK 接受，申请 SQL 不要求该 line 属于 path order；line 级申请省略 `amountMinor` 时，退款 worker 使用订单整笔已收未退余额而非 line payable。跨订单 line 会留下空 route/supplier facts；多行订单的缺省金额会在 supplier allocation 超过行额度而失败。预期为 line 必须属于目标订单，且 line 级缺省退款应从该 line 的可退余额推导或被明确拒绝。 |
| 影响 | 已批准申请可能进入 paymentrefund 重试/死信，订单售后状态停在 processing；异常输入还会将售后记录关联到不属于订单的 line。未核验线上是否已发生。 |
| 根因 | 售后写入从 order 行锁后以常量 `select` 插入，line 相关子查询只决定 snapshot，未成为行归属前置条件；退款创建以 payment 余额为默认值。 |
| 验证/回滚 | 后续独立修复分支在隔离 PostgreSQL 覆盖：同订单 line、另一订单 line、未知 line、null line、单/多行订单省略/给定 amount、审批、refund job、supplier allocation 和 deadletter。回滚为撤回该独立修复提交。 |
| 独立复核 | 否 |

## F-0001｜fufu Auth、Console 公网入口与发布制品指针分裂

| 字段 | 记录 |
| --- | --- |
| 模块 | 发布与运行 / Auth、Console 静态制品 |
| 类型 | 运行配置漂移、可用性、发布事实源分裂 |
| 严重级别 | **P1**；RV-0001 已于 2026-09-15 从公网入口、manifest、发布 pointer、Caddy root 与验收逻辑重新取证确认 |
| 置信度 | 高：两个公网状态、active Caddy、两个 pointer/index 和成功发布回执均直接核验；影响人数和持续时间未知 |
| 文件和精确位置 | `02_platform_pingtai/infrastructure/release/zdt-next.release.json:584-611`；`02_platform_pingtai/infrastructure/zhudatuan/aliyun/Caddyfile:65-115`；线上 `/etc/caddy/Caddyfile:66,115`（2026-09-13 只读观察） |
| 当前行为 | [FACT][E-AU-001-020][E-AU-001-021][E-AU-004-010][E-AU-004-019] 线上 Caddy 分别指向 runtime-recovery current 下的 Auth/Console dist，两处都无 index；正式 release target current 的两份 static/index.html 都存在；对应 Direct run 曾返回 success，而两个公网根均返回 404 |
| 预期行为 | [FACT][E-AU-001-017][E-AU-004-002] release manifest 对 Console 只允许 200；Auth/Console 制品都应由正式发布器声明并实际更新的 pointer root 对外提供 |
| 直接证据 | E-AU-001-017、E-AU-001-020、E-AU-001-021、E-AU-004-002、E-AU-004-010、E-AU-004-019；RS-AU-004-001 |
| 调用链或运行入口 | workflow/release build → `/opt/zhudatuan/targets/{auth-web,console}/current/static`；浏览器 → active Caddy → `/opt/sfl/nodes/zhudatuan-l0/current/.../{auth-web,console}/dist` |
| 用户影响 | [INFERENCE] 直接访问 fufu Auth 的登录用户和 Console 的运营用户无法加载页面；是否存在替代域名/路径、影响人数和起始时间未知 |
| 数据影响 | 未发现直接数据写入或数据损坏证据 |
| 安全影响 | 未发现直接安全暴露证据 |
| 根因 | [CONFLICT][E-AU-004-007][E-AU-004-010] release pointer、runtime-recovery pointer 与主机本地 Caddy 权威并存；active Caddy 不等于仓库历史中的任一 blob，具体哪次外部安装引入仍 UNKNOWN |
| 建议方向 | 后续独立修复批次只统一“被 release 更新的 pointer”和“Caddy 实际读取的 pointer”，先确认权威路径；本审计分支不实施 |
| 预计修改范围 | [UNKNOWN] 可能涉及 Caddy 配置、release target/policy 或激活流程中的一处或数处；复核前不得猜定 |
| 验证方式 | 第二审计者重新核对实例身份、Caddy active config、两个 current 指针、制品版本和直连 SNI；穷举 200/404/5xx/连接失败，并检查其它域名无变化 |
| 回滚方式 | 修复批次保留原 Caddy 与原 pointer，按当时正式发布流程回切；本次未执行 |
| 是否需要独立复核 | 已完成 RV-0001；未来修复变更仍须独立变更后复核 |

为什么不是 P0：当前证明两个前端入口 404，但没有证据证明正在发生严重数据损失、安全事故或全系统中断，也未独立确认影响规模。按用户定义，不能为了谨慎而把证据不足的 P1 候选升级为 P0。

**RV-0001（二次独立复核，2026-09-15）：确认 P1。** 新一轮只读 GET 再次取得 `accounts.fufu.wang/` 与 `console.fufu.wang/` 的 404；固定基线的 node manifest 明确将两者作为 identity/console surface，发布 policy 写入 `/opt/zhudatuan/targets/{auth-web,console}/current/static`，而 fufu Caddy 仍从 `/opt/zhudatuan/current/.../dist` 提供同一前端。Direct 发布跳过外部验收，Auth 无单目标公网验收。详见 `records/AU-907-rv-0001-auth-console-release-pointer/summary.md`；没有实施修复。

## F-0002｜正式 Playwright 入口引用四个不存在的 workspace

| 字段 | 记录 |
| --- | --- |
| 模块 | 测试入口 / 浏览器 E2E |
| 类型 | 测试启动配置漂移 |
| 严重级别 | P2 |
| 置信度 | 高 |
| 文件和精确位置 | `playwright.config.ts:7-15,37`；实际 workspace 名来自各 app package.json 与 package-lock |
| 当前行为 | [FACT][E-AU-001-003][E-AU-001-004][E-AU-001-005] 5 个 webServer 中只有 `@shop/console` 存在；`@shop/auth` 的同形命令直接退出 1 并报告 No workspaces found |
| 预期行为 | 根 `npm run test:e2e` 能启动配置声明的全部必要 Web Server，再执行 browser specs |
| 直接证据 | E-AU-001-003、E-AU-001-004、E-AU-001-005 |
| 调用链或运行入口 | `npm run test:e2e` → Playwright config → webServer command → npm workspace lookup |
| 用户影响 | E2E 套件不能通过正式入口到达页面测试；产品运行本身不由此直接中断 |
| 数据影响 | 无直接数据影响证据 |
| 安全影响 | 安全/权限浏览器旅程可能因入口失败而未被验证 |
| 根因 | 配置中的 workspace 名没有与现有 `@smart-wing/auth-web`、`@smart-wing/storefront-web` 及已不存在的 store/supplier 工作区对齐 |
| 建议方向 | 独立测试配置批次先重新确定 E2E 必需应用集合，再逐个更新启动项；不能只做字符串替换而保留不存在的产品 |
| 预计修改范围 | Playwright 配置及必要 E2E 说明/夹具；具体由测试专项确定 |
| 验证方式 | 先逐个运行五个正式启动命令，再运行一个最小 browser smoke；最终才运行完整 E2E |
| 回滚方式 | 回退独立测试配置提交 |
| 是否需要独立复核 | 否；若影响安全发布判据则在测试专项升级复核 |

## F-0003｜ESLint 的前端 glob 未覆盖 auth-web 与 storefront-web

| 字段 | 记录 |
| --- | --- |
| 模块 | 静态质量 / 前端 |
| 类型 | 质量覆盖缺口 |
| 严重级别 | P2 |
| 置信度 | 高（路径匹配）；当前历史问题数量未验证 |
| 文件和精确位置 | `eslint.config.mjs:8-24,49-82` |
| 当前行为 | [FACT][E-AU-001-025] typed、React Hooks 和 JSX accessibility 配置使用 `apps/{auth,console,store,supplier,storefront}`；实际应用目录是 auth-web、console、miniapp、storefront-web，因此两个现行 React 应用不匹配这些规则块 |
| 预期行为 | 正式 lint 对现行 React 应用执行声明的 typed correctness、Hooks 与 accessibility 规则 |
| 直接证据 | E-AU-001-003、E-AU-001-025 |
| 调用链或运行入口 | `npm run lint` → ESLint flat config → files glob → rule blocks |
| 用户影响 | 缺陷不会由配置本身直接触发线上故障，但两个应用可能绕过预期静态检查 |
| 数据影响 | 无直接证据 |
| 安全影响 | 无直接证据；权限 UI 的静态错误可能少一道检测，但不能据此推导漏洞 |
| 根因 | 目录重组或命名确定后 lint glob 未同步；Git 历史未发现这些旧目录曾受控 |
| 建议方向 | 独立质量配置批次按当前应用目录和各应用 tsconfig 重建明确集合，并先打印实际匹配文件 |
| 预计修改范围 | ESLint 配置与相关质量验证；不涉及生产逻辑 |
| 验证方式 | `eslint --print-config`/匹配文件清单 + 在临时验证中破坏一条 Hooks/typed 规则确认会失败 |
| 回滚方式 | 回退独立质量配置提交 |
| 是否需要独立复核 | 否；修复后需做反事实测试 |

## F-0004｜线上存在基线无法重建的活跃 systemd unit

| 字段 | 记录 |
| --- | --- |
| 模块 | 发布与运维 / 运行单元库存 |
| 类型 | 配置可追溯性与恢复风险 |
| 严重级别 | P3 |
| 置信度 | 高（存在性）；是否应入库未知 |
| 文件和精确位置 | 基线 `02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/` 与线上 `/etc/systemd/system` 对比 |
| 当前行为 | [FACT][E-AU-001-019][E-AU-001-022] `sfl-autonode-c1-parent-runtime.service` 和 `zhudatuan-finance-preview.service` 正在运行，但基线没有同名 unit 文件 |
| 预期行为 | 若这些单元属于当前系统，恢复与发布资料应能解释其来源；若是刻意主机本地化，应有明确所有权与备份证据 |
| 直接证据 | E-AU-001-019、E-AU-001-022 |
| 调用链或运行入口 | systemd → 各自 WorkingDirectory → InternalRuntimeMain 或 FinancePreviewServer |
| 用户影响 | 主机重建、故障恢复或人员交接时可能漏恢复这些能力；当前未观察到直接功能失败 |
| 数据影响 | UNKNOWN；未审其运行逻辑 |
| 安全影响 | UNKNOWN；未读取环境变量内容或凭据 |
| 根因 | [UNKNOWN] 可能是外部生成、临时运维或未回写仓库，不能私自选择解释 |
| 建议方向 | 运维专项先追踪 unit 创建者、源制品、版本和恢复 runbook；仅在确认权威后决定是否纳入配置管理 |
| 预计修改范围 | UNKNOWN；可能仅补运行档案，也可能涉及生成器/配置仓库 |
| 验证方式 | 对 unit FragmentPath、WorkingDirectory、源 SHA、安装日志和恢复演练做只读交叉核对 |
| 回滚方式 | 不适用审计；任何治理批次需保留主机现状与 unit 备份 |
| 是否需要独立复核 | 否；若发现其承担关键数据写入则升级 |

## 2. AU-001 未定级事项

- [UNKNOWN] Cloudflare h5/mini wrangler 配置无仓库内发布调用者。缺少外部平台证据，不能写成“未部署”或垃圾代码。
- [UNKNOWN] release workspace resolver 不处理通配 export 的规则是否会影响未来/外部服务构建；当前目标图没有证明故障，不列问题。
- [CONFLICT] README、DEPLOYMENT、SOURCE-MANIFEST 与当前 release/域名配置存在漂移；统一文档专项再决定是 P3 还是历史归档职责。
- [UNKNOWN] 非 target 白名单的 Main 入口是否承担本地、staging、恢复或兼容职责；不进入死代码清单。

## F-0005｜Auth owner-approved 机器清单与实际页面入口漂移

| 字段 | 记录 |
| --- | --- |
| 模块 | Auth Web / UI 审批与运行入口 |
| 类型 | 机器契约漂移、页面可达性、质量门禁 |
| 严重级别 | P2 |
| 置信度 | 高：运行 import 图、锁定哈希和正式命令均为直接证据；哪套 UI 应为权威仍未知 |
| 文件和精确位置 | `01_core_hexin/apps/auth-web/src/App.tsx:6-49`；`02_platform_pingtai/config/owner-approved-ui.json:69-99`；`04_tools/scripts/check/owner-approved-ui.mjs:41-49,53-58`；`SOURCE-MANIFEST.md:23` |
| 当前行为 | [FACT][E-AU-002-009][E-AU-002-010] App 只挂载 ConsumerIdentityPage、OperatorIdentityPage 或 invalid 页；LoginPage 没有生产源码消费者。机器清单仍把 LoginPage 标为 approvedComponent，并锁定 App/HTML/manifest；正式 `check:approved-ui` 在 App 哈希处失败，全量只读核对显示 3 个 accounts 锁文件漂移 |
| 预期行为 | owner-approved 机器清单应与同一固定基线的真实入口和锁文件一致，并能证明用户实际看到的是经批准界面 |
| 直接证据 | E-AU-002-009、E-AU-002-010、E-AU-002-024 |
| 调用链或运行入口 | Auth HTML → main.tsx → App → Consumer/Operator；并行治理链为 quality → check:approved-ui → owner-approved-ui.json lockedFiles |
| 用户影响 | [UNKNOWN] 当前页面可能是 Ethan 后续批准的新界面，也可能绕开原批准 LoginPage；没有当前产品裁定，不能选择哪套为错 |
| 数据影响 | 未发现直接数据写入或数据损坏证据 |
| 安全影响 | 登录 UI 变化可能影响身份流程，但没有证据证明 API 授权被绕过 |
| 根因 | [FACT] owner 清单最近变更早于 3 个文件的后续变更；checker 只验证 workspace/entrypoint/output 和 lockedFiles，不验证 approvedComponent 是否被入口加载。产品层根因仍 UNKNOWN |
| 建议方向 | 后续独立治理批次先由 Ethan 指定当前批准页面，再只校准一套入口/锁/验收事实；不得在审计分支把 LoginPage 删除或重新挂载 |
| 预计修改范围 | 取决于产品裁定：可能仅机器清单/证据，也可能是 Auth 入口；不能在本报告预选 |
| 验证方式 | import/bundle 可达图 + 全锁 SHA + `check:approved-ui` + 指定域真实视觉/登录验收 |
| 回滚方式 | 独立批次保留旧清单与入口提交，可单提交回退；本次未实施 |
| 是否需要独立复核 | 否（P2）；治理前需要 Owner 产品裁定，不等同代码复核 |

## F-0006｜Miniapp 当前制品声明与可启动拓扑互相冲突

| 字段 | 记录 |
| --- | --- |
| 模块 | Miniapp / 客户端发布与质量拓扑 |
| 类型 | 运行入口缺失、机器契约冲突、测试假阳性 |
| 严重级别 | P2 |
| 置信度 | 高（仓库内冲突）；外部完整工程与线上状态未知 |
| 文件和精确位置 | `01_core_hexin/apps/miniapp/miniprogram/app.js:1-9`；`miniprogram/domain/deeplink.js`；`miniprogram/domain/experience.js`；`04_tools/scripts/build-miniapp-contract.mjs`；`04_tools/scripts/audit/navigation.mjs:13-46`；`04_tools/scripts/audit/runtimegraph.mjs:17-24`；`04_tools/scripts/check/tests.mjs:39-50`；`04_tools/scripts/release/candidate.mjs:19-34`；`01_core_hexin/packages/api-contract/src/delivery-matrix.json:1-65`；`04_tools/scripts/audit/regression.mjs:6-18` |
| 当前行为 | [FACT][E-AU-002-018/019/020][E-AU-008-014] 目录只有9个文件；两个生成domain模块存在但Miniapp运行引用为0，contractgen预留的`miniprogram/api/client.js`不存在，且无app.json/pages/navigation/actions。navigation正式命令必现ENOENT；test topology只见app.js就通过；candidate无条件复制全部9文件；delivery matrix又把已被regression标为retired、当前不存在的wechat-miniapp路径作为四项implemented能力证据 |
| 预期行为 | 若 Miniapp 是 required/current client，构建、测试、导航、runtime compatibility、candidate 和 delivery matrix 应共享同一最小可启动拓扑；若已外置或下线，机器契约应明确指向真实所有者/制品 |
| 直接证据 | E-AU-002-018、E-AU-002-019、E-AU-002-020、E-AU-008-014、T-AU-002-003/005/009 |
| 调用链或运行入口 | build-miniapp-contract/contractgen条件输出 → 当前2个domain模块与缺失api client；微信runtime → app.js；quality → navigation/runtimegraph/tests；release → candidate clients/miniapp；contract → delivery matrix |
| 用户影响 | [UNKNOWN] 本仓库无法重建/导航一个完整 Miniapp；是否有外部工程持续供给线上小程序未验证 |
| 数据影响 | [UNKNOWN] delivery matrix 声称 cart/order/payment 能力 implemented，但当前证据文件不存在；不能推导线上写入是否缺失 |
| 安全影响 | [UNKNOWN] 缺 API client 无法审阅身份/header/权限边界，但不等于已存在漏洞 |
| 根因 | 多个门禁各自采用不同的“Miniapp 存在”判据，且 delivery matrix 保留 retired 路径；外部工程/产品迁移决定未入当前事实源 |
| 建议方向 | 独立产品/发布治理批次先确认唯一 Miniapp 所有者、源码位置和当前发布状态，再统一机器清单；不得凭当前缺失自动补工程或删片段 |
| 预计修改范围 | UNKNOWN；可能涉及外部仓库链接、delivery matrix、candidate、检查脚本或正式客户端，但必须拆批 |
| 验证方式 | 微信开发者工具/CI 的真实构建与导航；candidate 内容；API header；外部工程 SHA/发布记录；再重跑四类 check |
| 回滚方式 | 机器清单与构建/发布规则分提交回退；现有 9 文件在事实确认前保留 |
| 是否需要独立复核 | 否（P2）；若后续拟删除/判 GX/G3，则必须第二轮独立复核 |

[AU-018补强][E-AU-018-003/004/008/009] 逐一核对9个文件后，唯一运行引用仍是`app.js → Environment.js`；其它7个生成输出零片段内caller。`audit/navigation`因app.json直接ENOENT，而`check/tests`只检查app.js并返回通过；candidate仍复制9文件。外部完整工程继续UNKNOWN，F-0006等级不变。

## F-0007｜Auth 九处成功响应 Schema 校验结果被丢弃

| 字段 | 记录 |
| --- | --- |
| 模块 | Auth Web / Canonical Identity 与 Registration 客户端 |
| 类型 | 正确性、API 契约、失败后继续执行 |
| 严重级别 | P2 |
| 置信度 | 高：代码与第三方 API 契约直接；畸形响应发生概率未知 |
| 文件和精确位置 | `canonicalIdentity.ts:143,222,235,329,342`；`canonicalRegistration.ts:135,159,185,225` |
| 当前行为 | [FACT][E-AU-002-011][E-AU-002-012] 每处执行 `void Schema.safeParse(response)`，不读取 success/data/error，随后把原 response 强制断言为 Schema 类型并继续访问字段或发起下一请求 |
| 预期行为 | 任何成功 HTTP 响应都应在字段消费前由对应 Schema 接纳，并使用解析后的 data；无效 2xx 应 fail closed，不能继续登录/注册状态机 |
| 直接证据 | E-AU-002-011、E-AU-002-012；引入 diff `7d94f2aa` 还证明此前使用 `Schema.parse(...)` 的反事实 |
| 调用链或运行入口 | Consumer/OperatorIdentityPage → canonical identity/registration service → fetch 2xx JSON → Schema → UI/下一 identity request |
| 用户影响 | 畸形或漂移 2xx 可晚至字段访问、跳转或下一请求才失败，错误位置与文案偏离真实根因 |
| 数据影响 | [INFERENCE] 注册 membership 成功写入后若回执畸形，客户端可能表现为失败/重试，形成半完成体验；后端事务和幂等尚未审，不能写成数据重复事实 |
| 安全影响 | 未证明服务端授权可绕过；客户端 fail-closed 契约被削弱是事实 |
| 根因 | `7d94f2aa` 将抛错并返回解析数据的 parse 改为 safeParse，但没有消费其判别联合结果，类型断言掩盖了运行数据未校验 |
| 建议方向 | 独立 Auth 契约修复批次逐 Schema 恢复显式接纳/拒绝，并先补畸形成功 2xx 反事实；不要在本审计分支修 |
| 预计修改范围 | 两个 service 文件及其定向 tests；后端不应与客户端修复混在同一批，除非反事实证明契约也错 |
| 验证方式 | 对 9 个调用点分别输入缺字段、错类型、额外字段/transform 场景，确认无第二请求、无 redirect、错误稳定；再跑现有成功/HTTP 错误用例 |
| 回滚方式 | 回退独立小提交；保留原请求和错误映射路径 |
| 是否需要独立复核 | 否（P2）；若身份专项发现授权/凭据影响则升级并独立复核 |

## F-0008｜前端边界正式门禁在固定基线上报告 13 个新增项

| 字段 | 记录 |
| --- | --- |
| 模块 | 前端质量 / CSS 与设计 token |
| 类型 | 质量门禁漂移、发布可验证性 |
| 严重级别 | P2 |
| 置信度 | 高 |
| 文件和精确位置 | `04_tools/scripts/check/frontend.mjs:7-16,52-94`；13 个命令输出所列 Console/Storefront CSS |
| 当前行为 | [FACT][E-AU-002-021] `npm run check:frontend` 退出 1，报告 `13 new, 33 known`；新项均为 DESIGN_TOKEN_BYPASS，包含生产根 `app/globals.css` 和多个当前模块样式 |
| 预期行为 | 固定主线基线应满足它自己声明在 `quality:canonical-hard-cut` → `audit:architecture` 中的前端边界门禁，或明确记录经批准债务 |
| 直接证据 | E-AU-002-021、T-AU-002-006；`package.json:111,123` |
| 调用链或运行入口 | quality:canonical-hard-cut → audit:architecture → check:frontend → apps 源文件扫描 → regressions |
| 用户影响 | 不直接证明页面视觉错误，但 canonical hard-cut 无法到达后续验证，发布/审计证据不闭合 |
| 数据影响 | 无直接证据 |
| 安全影响 | 无直接证据 |
| 根因 | 静态 knownDebt 最近更新早于后续样式变化；每项究竟应改为 token 还是经批准保留尚未逐页视觉裁定 |
| 建议方向 | 独立 UI 质量批次逐项核对真实页面和 VI，再分别修样式或登记债务；禁止为了让门禁变绿批量改色/扩大 allowlist |
| 预计修改范围 | check 配置和/或 13 个样式文件，但必须按页面拆小批 |
| 验证方式 | 每项反事实 + 真实页面对照 + `check:frontend`；最后仅一次受影响 build |
| 回滚方式 | 每页面提交独立回退；保留原视觉截图/值 |
| 是否需要独立复核 | 否（P2）；涉及 Owner-approved 视觉时需产品验收 |

## F-0009｜前端文件证据清单与固定基线大幅漂移

| 字段 | 记录 |
| --- | --- |
| 模块 | 前端证据与供应链 |
| 类型 | 生成证据漂移、质量门禁 |
| 严重级别 | P2 |
| 置信度 | 高 |
| 文件和精确位置 | `04_tools/scripts/evidence/frontendmanifest.mjs:7-50`；`05_docs_ziliao/docs_wendang/evidence/frontend/files.json` |
| 当前行为 | [FACT][E-AU-002-022] 正式 `check:frontendmanifest` 退出 1；按同一 roots/exclusions/path/hash/size/mode 在内存重算，记录 786 项而当前 958 项：新增 174、删除 2、变化 295 |
| 预期行为 | 被 canonical hard-cut 使用的前端文件证据应精确描述同一提交的受控前端树 |
| 直接证据 | E-AU-002-022、E-AU-002-024、T-AU-002-007/008 |
| 调用链或运行入口 | quality:canonical-hard-cut → audit:architecture → check:frontendmanifest → 11 source roots → files.json byte equality |
| 用户影响 | 不直接改变运行页面；但现有文件清单不能支持“审核/发布的就是当前前端树”的证明 |
| 数据影响 | 无业务数据影响证据 |
| 安全影响 | 供应链/审计证据遗漏新文件，但不能据此推导恶意代码或漏洞 |
| 根因 | files.json 最近更新于 2026-09-07，之后前端树持续变化而证据没有随同更新 |
| 建议方向 | 在独立证据治理批次先审差集，再由正式生成器重建；不能只刷新快照而不解释新增/删除及反事实 |
| 预计修改范围 | 一个生成证据文件及必要审计说明；若差集发现问题，另开对应代码批次 |
| 验证方式 | 重新生成到临时位置比较；review 174/2/295 分类；正式 check 通过；源码无夹带变化 |
| 回滚方式 | 回退证据清单提交；不会触及生产逻辑 |
| 是否需要独立复核 | 否（P2）；若清单用于签名发布，应由发布专项复核 |

## F-0010｜Console 路由测试名称仍写 32，断言与实际均为 34

| 字段 | 记录 |
| --- | --- |
| 模块 | Console route tests |
| 类型 | NIT / 测试可读性与文档漂移 |
| 严重级别 | NIT |
| 置信度 | 高 |
| 文件和精确位置 | `01_core_hexin/apps/console/src/route/ConsoleModuleRegistry.test.ts:98-108` |
| 当前行为 | [FACT][E-AU-002-026] `it` 标题声称 32 lazy routes；测试体断言 0 redirect 和 34 条非 redirect；15 个 manifest 实际枚举也是 34 |
| 预期行为 | 测试名称与它验证的当前行为一致，避免评审者把标题误当事实 |
| 直接证据 | E-AU-002-004、E-AU-002-026 |
| 调用链或运行入口 | test:unit → Console Vitest → registered Console modules suite |
| 用户影响 | 无运行影响；降低审计和失败信息可读性 |
| 数据影响 | 无 |
| 安全影响 | 无 |
| 根因 | 路由数量增加后断言已更新，测试标题未同步 |
| 建议方向 | 后续 Console 测试小批次只校准名称，或避免在名称硬编码易漂移计数；本审计不修改测试 |
| 预计修改范围 | 单一测试描述字符串 |
| 验证方式 | 路由静态计数 + 定向测试 |
| 回滚方式 | 回退单行测试提交 |
| 是否需要独立复核 | 否 |


## 3. AU-002 新增未定级事项

- [UNKNOWN][E-AU-002-016] Storefront `app/[device]/page.tsx` 会接住未知单段路径，组件在 hydration 后显示“该展示入口不存在”，但未验证真实 HTTP status；不登记为缺陷事实。
- [UNKNOWN][E-AU-002-025] 六个无文件名消费者的 CSS 均有替代、选择器、组件、测试或生成责任线索；未做视觉对照，不进入垃圾代码清单。
- [UNKNOWN] Auth LoginPage 没有当前生产源码消费者，但仍被 owner-approved 清单锁定并保存唯一历史 UI/兼容逻辑；禁止按零引用删除。

## F-0011｜CreateMall 生产实现被 affected-target 发布规划排除

| 字段 | 记录 |
| --- | --- |
| 模块 | 发布影响分析 / Mall Provisioning |
| 类型 | 制品选择遗漏、代码与发布边界不一致 |
| 严重级别 | P2 |
| 置信度 | 高：静态生产调用链与 planner 直接执行结果一致 |
| 文件和精确位置 | .github/workflows/deploy.yml:14-16,62-79；zdt-next.release.json:473-477,552-557；planner.mjs:59-92；MallProvisioningApiMain.ts:7-22；MallProvisioningModule.ts:1-8；ProvisioningOperations.ts:7,16,25-36 |
| 当前行为 | [FACT][E-AU-003-017][E-AU-003-018] CreateMall.ts 是 mall-provisioning-api 的静态生产依赖；但规则 mall-provisioning-isolation 给它 targets: []，同时 commerce-shared 明确排除该文件。对单文件变更调用真实 classifyChanges 得到 targets=[]、validations=[]、dynamicImpact=[]、impact=validation-only |
| 预期行为 | 默认 affected-target 规划应为所有可达生产实现选择其实际制品消费者，至少选择 mall-provisioning-api 或执行能证明无需发布的专门验证 |
| 直接证据 | E-AU-003-003、E-AU-003-017、E-AU-003-018；RS-AU-003-001 |
| 调用链或运行入口 | deploy.yml 空 release_target → HEAD^..HEAD affected plan → release rule → 零 target；运行链反向为 Mall Main → selected module → provisioning operation → CreateMall |
| 用户影响 | 单独修改该文件时，正式默认发布入口会报告没有可部署 target；若与其它改动一起发布，Mall 制品仍可能不被选择，线上继续执行旧实现 |
| 数据影响 | CreateMall 负责组织、目录池、应用和 owner 创建；当前证据证明的是“新实现不进入制品”，未证明既有线上实现已写错数据 |
| 安全影响 | 未发现直接安全影响 |
| 根因 | 为依赖隔离建立的路径特例把真实运行依赖从通用动态 impact 排除，却没有把其现有宿主 mall-provisioning-api 回填到 target |
| 建议方向 | 独立发布规则修复批次先新增该单文件反事实，再让影响图选择真实宿主；不要与 CreateMall 业务重构混批 |
| 预计修改范围 | release rule/planner 定向测试；通常不需要改生产业务代码，最终以修复时最新主线重查为准 |
| 验证方式 | 真实 adapter 对 CreateMall-only diff 必须选择 Mall target、只产生预期 artifact/deployment；再验证显式 target 和混合 diff 不扩散到无关服务 |
| 回滚方式 | 回退独立 release-rule 提交；显式指定 mall-provisioning-api 仍可作为临时人工发布路径，但不视为修复 |
| 是否需要独立复核 | 否（P2）；若影响分析专项拟扩大到多 target，再单独评审边界 |

## F-0012｜Jobs 空轮询正常完成后持续保留 AbortSignal listener

| 字段 | 记录 |
| --- | --- |
| 模块 | Jobs 基础设施 / 轮询与停止 |
| 类型 | 资源泄漏、常驻进程稳定性 |
| 严重级别 | P2 |
| 置信度 | 高：源码控制流和最小运行反事实直接证明；线上影响程度未知 |
| 文件和精确位置 | JobRunner.ts:47-75,143-148；OutboxRelay.ts:32-45；RuntimeScheduler.ts:24-30,45-50；专用 poll 配置见 IdentityNotificationJobsRuntime.ts:77-91、CatalogJobsRuntime.ts:150-218、PaymentJobsRuntime.ts:83-155 |
| 当前行为 | [FACT][E-AU-003-010][E-AU-003-011] 三个 wait helper 在 abort 时清 timer，但 timer 正常 resolve 时不移除 abort listener。与源码同形函数对同一 signal 完成 12 次正常 timeout 后，getEventListeners 返回 12；专用 Jobs 以 1 秒 poll 长期复用同一 signal |
| 预期行为 | timer 与 abort 两条完成路径都应互相注销对方的资源；空队列长期运行时 listener 数应保持常数 |
| 直接证据 | E-AU-003-009、E-AU-003-010、E-AU-003-011；RS-AU-003-002 |
| 调用链或运行入口 | systemd Jobs Main → 一个 AbortController → 一个或多个 QueueJob → JobRunner.run 空 claim → delay；Full Jobs 另有 OutboxRelay/RuntimeScheduler 同形 wait |
| 用户影响 | [INFERENCE] listener 闭包按空轮询次数增长，增加常驻 worker 内存与最终 stop fan-out；当前未观察到用户请求失败或 worker 崩溃 |
| 数据影响 | 未证明已丢任务；若长期资源压力导致进程重启，任务依赖 lease 重取，processor 幂等风险留 Jobs 专项 |
| 安全影响 | 无直接安全影响证据 |
| 根因 | once: true 只保证事件触发后移除；正常 timer 分支从未触发 abort 事件，也没有显式 removeEventListener。同一 helper 被复制三次 |
| 建议方向 | 独立 Jobs 基础设施批次建立双向 cleanup helper，并先写 listener-count/abort-race 反事实；不要同时改 processor、重试参数或队列 schema |
| 预计修改范围 | 三个 wait helper 及定向基础设施测试；是否统一工具函数由修复评审决定 |
| 验证方式 | 正常 timeout、先 abort、timer/abort 竞争、零/长 timeout；每轮后 listener 数回到基线；再运行一个专用 job 空队列短测 |
| 回滚方式 | 回退独立 helper 提交并重启受影响 worker；数据库 queue 状态不应由该批次改动 |
| 是否需要独立复核 | 否（P2）；若压力测试证明会快速 OOM，再升级严重度并独立复核 |

## F-0013｜迁移 SQL 提交与 ledger 登记之间存在非原子窗口

| 字段 | 记录 |
| --- | --- |
| 模块 | 数据与迁移 / 正式 release executor、RegistrationMigrationRunner |
| 类型 | 事务边界、失败恢复、迁移可重复性 |
| 严重级别 | P2 |
| 置信度 | 高：query 顺序和迁移事务包装直接；窗口发生概率与具体数据影响未知 |
| 文件和精确位置 | MigrationRunner.ts:51-78；RegistrationMigrationRunner.ts:89-113；database-migration-executor.mjs:22-46；zdt-next.remote-policy.json:57；remote/agent.mjs:499-529,580-613,840-857 |
| 当前行为 | [FACT][E-AU-003-012][E-AU-003-013][E-AU-244-002] 两个runner都先执行SQL、后单独INSERT schema_migrations；RegistrationMigrationRunner还为每条新migration写registration-specific ledger metadata。300 个主迁移 SQL 中207个现代文件自含BEGIN/COMMIT；registration plan同样允许original/transformed SQL自提交。因此SQL内COMMIT成功后到ledger INSERT成功前均存在进程、连接或ledger写失败窗口。93个无显式事务主历史文件属于冻结历史，不是本结论的主要触发面。 |
| 预期行为 | 对每个迁移，数据库可观察效果与“已应用”记录应具有同一恢复语义；任一失败点都不能让自动重试无法判断是否应再次执行 SQL |
| 直接证据 | E-AU-003-012、E-AU-003-013、E-AU-003-014；RS-AU-003-003 |
| 调用链或运行入口 | GitHub deploy → database-migration target → remote agent → DatabaseMigrationExecutor → MigrationRunner → SQL 自提交 → ledger INSERT → target schema check；registration-only entry → RegistrationMigrationRunner → SQL/transform → registration ledger INSERT → runtime target check |
| 用户影响 | [INFERENCE] 窗口命中后发布失败；下一次自动执行会把缺 ledger 的同一 SQL 再运行，可能持续阻断发布，需要人工判断已发生的数据库效果 |
| 数据影响 | [INFERENCE] 取决于具体 SQL 的可重复性，可能只是再次失败，也可能重复 DML；本单元没有故障注入或逐迁移证明，不写成已发生数据损坏 |
| 安全影响 | 无直接安全影响；迁移 owner 权限使错误影响面较大，但当前角色校验是明确门禁 |
| 根因 | 事务所有权分裂：迁移文件自行提交业务 DDL/DML，runner 在文件事务之外维护 ledger；advisory lock 只解决并发，不解决提交原子性 |
| 建议方向 | 数据专项先定义受管的单迁移 commit/ledger 协议和已提交未登记恢复流程；不得通过伪造 ledger 或改历史文件快速掩盖 |
| 预计修改范围 | MigrationRunner、迁移编写契约、故障注入测试和 runbook；是否需要新 forward migration 由当时状态决定 |
| 验证方式 | 临时数据库在 SQL commit 后、ledger insert 前故障注入；验证重启能确定性恢复且历史哈希、target head、forward-only receipt 仍成立 |
| 回滚方式 | 该类修复必须 forward-safe；代码提交可回退，但已执行数据库效果不可依赖代码回退，需预先定义恢复 migration/备份路径 |
| 是否需要独立复核 | 否（当前 P2）；任何实际 ledger 分裂、数据修复或迁移协议变更应按 P1/GX 级别双人复核 |

## F-0223｜RegistrationMigrationRunner 没有数据库边界与故障恢复直接测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce / registration migration Runner；P2；高 |
| 类型 | 测试覆盖缺口、迁移恢复/数据隔离 |
| 位置 | `01_core_hexin/services/commerce/src/foundation/infrastructure/RegistrationMigrationRunner.ts:70-302` |
| 当前/预期 | Runner承担独立数据库验证、锁、history/ledger、受控marker recovery、secret backfill和target断言。预期每一类数据库状态与SQL/ledger故障窗口有受控fake client或临时数据库fixture。 |
| 直接证据 | 仓内仅有RegistrationMigrationPlan.test，未找到Runner direct fixture或`REGISTRATION_MIGRATION_DATABASE_BOUNDARY_INVALID`、`...LEDGER_DRIFT`、`...TARGET_INVALID`、`...AUTONODE_LEDGER_RECOVERY_INVALID`、`...L0_PUBLIC_DOMAIN_LEDGER_RECOVERY_INVALID`的测试断言。 |
| 调用链/影响 | RegistrationMigrationMain → RegistrationMigrationRunner → registration database。边界/恢复回归会在初始化或受控修复时阻断注册数据库迁移，或在错误状态尝试推进migration；实际线上执行状态未验证。 |
| 建议方向 | 从修复时最新`zdt-next`建立isolated fake-PoolClient或临时registration DB测试批，覆盖独立边界、空/受管库、ledger drift、两类marker recovery、secret rollback、target验证及SQL成功/ledger失败故障注入；该测试批不改历史migration。 |
| 验证/回滚 | 断言每个稳定错误码、lock/unlock与release、执行SQL/ledger顺序及失败后重跑语义；回滚为revert测试提交。 |
| 独立复核 | 否；P2。 |

## F-0224｜Identity runtime 的数据库边界例外没有直接测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce / bootstrap LiveDatabaseBoundary；P2；高 |
| 类型 | 测试覆盖缺口、身份运行时数据库边界 |
| 位置 | `01_core_hexin/services/commerce/src/bootstrap/LiveDatabaseBoundary.ts:35-65`；`.../LiveDatabaseBoundary.test.ts:20-49` |
| 当前/预期 | identity API/job调用identity专用assertion，刻意不要求business/retired role digest，但仍要求运行role、registration DB、单Owner、migration/runtime/boundary role、retired memberships和各owner一致。预期该宽松例外及其保留不变量有direct fixture。 |
| 直接证据 | fixture只调用`assertLiveDatabaseBoundary`；未导入/调用`assertIdentityRuntimeDatabaseBoundary`，也未验证identity runtime接受business/retired false而拒绝其余任一关键字段drift。 |
| 调用链/影响 | IdentityRegistrationApiRuntime/IdentityNotificationJobsRuntime → assertIdentityRuntimeDatabaseBoundary → deployment runtime oracle。分支回归可能使identity runtime错误启动/拒绝，或错误放宽非identity数据库边界；线上影响未验证。 |
| 建议方向 | 从修复时最新`zdt-next`建立仅测试批，覆盖identity API/job role的acceptance、business/retired digest例外、每个仍强制的字段拒绝及strict path不变；回滚为撤回测试提交。 |
| 验证/回滚 | 用当前fake pool断言两种assertion的accept/reject差异和稳定错误码；回滚为revert提交。 |
| 独立复核 | 否；P2。 |

## F-0225｜Identity registration API runtime factory 未经直接执行验证

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce / bootstrap IdentityRegistrationApiRuntime；P2；高 |
| 类型 | 测试覆盖缺口、独立身份API启动与资源释放 |
| 位置 | `01_core_hexin/services/commerce/src/bootstrap/IdentityRegistrationApiRuntime.ts:66-159`；`.../IdentityRegistrationApiRuntime.test.ts:11-78` |
| 当前/预期 | factory在启动期读取多个secret、创建pool/objects、执行兼容性与probe，并在失败时关闭pool；随后按feature绑定容器依赖。预期以受控fake实现直接覆盖factory成功、probe失败释放、可选WeChat和configure/close语义。 |
| 直接证据 | 该fixture仅调用`assertIdentityRegistrationNodeManifest`和`assertIdentityRegistrationRuntimeCompatibility`；没有导入/调用`createIdentityRegistrationApiRuntime`。entrypoint fixture手工构造所有container binding，不能证明factory真实组装。 |
| 调用链/影响 | systemd IdentityRegistrationApiMain → createIdentityRegistrationApiRuntime → bootstrapApi/listen。secret/probe/依赖装配或失败释放回归可能使独立身份API无法启动、漏关连接或错误暴露/遗漏身份能力；线上影响未验证。 |
| 建议方向 | 从修复时最新`zdt-next`建立factory fixture批，以mockable secret/pool/object adapters或受控local endpoints覆盖成功绑定、WeChat开关、任一probe失败的pool end、close顺序和稳定错误码；不改变生产行为。 |
| 验证/回滚 | 断言secret读取集合、object probe、compatibility顺序、pool end次数和container token；回滚为revert测试提交。 |
| 独立复核 | 否；P2。 |

## F-0226｜Identity node runtime loader 的来源与一致性拒绝路径没有直接测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce / bootstrap IdentityNodeManifestRuntime；P2；高 |
| 类型 | 测试覆盖缺口、身份节点运行定义/启动一致性 |
| 位置 | `01_core_hexin/services/commerce/src/bootstrap/IdentityNodeManifestRuntime.ts:45-63,175-187`；`.../IdentityNodeManifestRuntime.test.ts:11-61` |
| 当前/预期 | loader可读取可选runtime文件或使用生产registry，并要求唯一node与manifest的profile、归属和域名一致。预期固定schema、unknown/duplicate node及每类manifest/registry drift有direct fixture。 |
| 直接证据 | fixture只导入projection和database assertion；未导入/调用`loadIdentityNodeRuntimeDefinition`，也未构造runtime file或触发`IDENTITY_NODE_RUNTIME_INVALID`、`...NODE_UNKNOWN`、`...MANIFEST_MISMATCH`。 |
| 调用链/影响 | IdentityRegistrationApiMain → createIdentityRegistrationApiRuntime → loadIdentityNodeRuntimeDefinition → scoped database parity。运行定义变更或部署环境文件drift可能令身份API错误拒绝、错误投影realm/target或在启动期失败；线上影响未验证。 |
| 建议方向 | 从修复时最新`zdt-next`建立loader fixture批，使用临时受控JSON覆盖schema/parse、唯一性、每个profile/ownership/host mismatch及默认生产registry选择；回滚为revert测试提交。 |
| 验证/回滚 | 断言成功node和稳定错误码，并检查不合法文件无法到达数据库检查；回滚为revert提交。 |
| 独立复核 | 否；P2。 |

## F-0227｜已否决：Mall provisioning runtime contract 非阻断

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce / bootstrap MallProvisioningApiRuntime；NIT/已否决；高 |
| 类型 | 正确性、启动兼容性门禁 |
| 位置 | `01_core_hexin/services/commerce/src/bootstrap/MallProvisioningApiRuntime.ts:121-189`；`.../MallProvisioningApiRuntime.test.ts:10-47` |
| 当前/预期 | compatibility query计算`contract`（目标runtime schema版本与checksum），但最终拒绝条件未包含`!state.contract`。预期任一contract marker缺失或checksum不匹配时启动失败。 |
| 直接证据 | 查询结果接口含`readonly contract: boolean`；SQL别名为`contract`（约第128行）；最终条件只检查`schema`后紧接`provisioning`（约第187行）。现有fixture的healthy contract为true，未传入false。 |
| 调用链/影响 | MallProvisioningApiMain → createMallProvisioningApiRuntime → assertMallProvisioningRuntimeCompatibility → bootstrap API/listen。contract drift后仍可启动并提供开通操作，可能在调用侧/数据库契约不一致时产生业务失败或错误写入；当前线上状态未验证。 |
| 建议方向 | 在独立修复分支先做第二轮调用链复核；确认后以最小补丁将`!state.contract`纳入predicate，并加入contract false direct fixture，不混入权限或迁移变更。 |
| 验证/回滚 | fake pool以`contract:false`应抛稳定错误；运行既有开通API定向测试。回滚为revert代码/测试小提交；不触及数据库。 |
| 独立复核 | 是；AU-249已从query、predicate、生产入口三处复核，结论一致。 |

## F-0228｜Mall provisioning runtime factory 未经直接执行验证

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce / bootstrap MallProvisioningApiRuntime；P2；高 |
| 类型 | 测试覆盖缺口、独立API启动与资源释放 |
| 位置 | `01_core_hexin/services/commerce/src/bootstrap/MallProvisioningApiRuntime.ts:62-111`；`.../MallProvisioningApiRuntime.test.ts:10-47` |
| 当前/预期 | factory读取secret、建立pool、在兼容性失败时关闭pool，并绑定访问/decision/audit依赖。预期成功、失败释放、configure和close有direct fixture。 |
| 直接证据 | fixture只调用`assertMallProvisioningRuntimeCompatibility`，未导入/调用`createMallProvisioningApiRuntime`。 |
| 调用链/影响 | MallProvisioningApiMain → factory → bootstrapApi/listen。启动资源或依赖组装回归可能导致开通API不可用或泄漏连接；线上影响未验证。 |
| 建议方向 | 从修复时最新`zdt-next`建立factory fixture批，以可控secret/pool注入覆盖成功、失败释放、token binding和close顺序；回滚为revert测试提交。 |
| 验证/回滚 | 断言secret读取、pool end、container token及extensions停止顺序；回滚为revert提交。 |
| 独立复核 | 否；P2。 |

## F-0229｜已否决：Console support runtime contract 非阻断

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce / bootstrap ConsoleSupportRuntime；NIT/已否决；高 |
| 类型 | 正确性、启动兼容性门禁 |
| 位置 | `01_core_hexin/services/commerce/src/bootstrap/ConsoleSupportRuntime.ts:110-159`；`.../ConsoleSupportRuntime.test.ts:9-38` |
| 当前/预期 | SQL计算精确runtime contract marker为`contract`，但最终reject predicate未读取该字段。预期marker缺失或checksum不匹配时Console support API拒绝启动。 |
| 直接证据 | 结果接口声明`contract`；查询以`version=$2 and checksum=$3`赋值`contract`；predicate从`!state.schema`直接跳到`!state.support`。fixture仅使用`contract:true`。 |
| 调用链/影响 | ConsoleSupportMain → createConsoleSupportRuntime → assertConsoleSupportRuntimeCompatibility → bootstrap/listen。contract drift后support API仍可能提供操作，与共享runtime contract不一致；当前线上状态未验证。 |
| 建议方向 | 先以独立轮重新核验entry、query/predicate和有无替代gate；确认后在最新`zdt-next`的最小修复分支补`!state.contract`和contract-false fixture，不混批。 |
| 验证/回滚 | fake pool的contract false须抛稳定错误；运行console support定向测试。回滚为revert小提交，无数据库变更。 |
| 独立复核 | 是；AU-252已从query、predicate、生产入口三处复核，结论一致。 |

## F-0230｜Console support runtime factory 与metrics生命周期未经直接执行验证

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce / bootstrap ConsoleSupportRuntime；P2；高 |
| 类型 | 测试覆盖缺口、API启动/资源释放/可观测性 |
| 位置 | `01_core_hexin/services/commerce/src/bootstrap/ConsoleSupportRuntime.ts:50-106`；`.../ConsoleSupportRuntime.test.ts:9-38` |
| 当前/预期 | factory创建metrics/pool并在预检失败释放pool，随后绑定metrics/telemetry与服务依赖。预期成功、失败、configure/close及metrics绑定有direct fixture。 |
| 直接证据 | 现有fixture仅调用compatibility assertion，未导入factory或验证`QUERY_METRICS`/`TELEMETRY`/pool释放。 |
| 调用链/影响 | ConsoleSupportMain → factory → bootstrap API/listen。资源、可观测性或依赖装配回归可能令support API不可用、泄漏连接或失去query指标；线上影响未验证。 |
| 建议方向 | 从修复时最新`zdt-next`建立factory fixture批，覆盖secret/pool、失败pool end、container tokens、close与metrics snapshot；回滚为revert测试提交。 |
| 验证/回滚 | 断言创建/关闭顺序、token值和metrics实例；回滚为revert提交。 |
| 独立复核 | 否；P2。 |

## F-0231｜已否决：Payment Jobs runtime contract 非阻断

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce / PaymentJobsRuntime；NIT/已否决；高 |
| 位置/证据 | `PaymentJobsRuntime.ts:97-160`投影`contract`但predicate未读取；测试只使用true。 |
| 影响 | Payment Jobs启动后可能在contract drift下处理支付查询/退款；线上状态未验证。 |
| 建议/验证 | 独立复核后在最新主线最小补`!state.contract`与false fixture；fake pool断言拒绝，可revert。 |
| 独立复核 | 是；AU-254确认入口无替代gate，结论一致。 |

## F-0232｜已否决：Payment Webhook runtime contract 非阻断

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce / PaymentWebhookApiRuntime；NIT/已否决；高 |
| 位置/证据 | `PaymentWebhookApiRuntime.ts:133-190`计算`contract`但predicate遗漏；fixture只用true。 |
| 影响 | webhook API可在contract drift下接收支付回调；线上状态未验证。 |
| 验证 | 独立复核入口后以false fixture确认；最小修复仅补predicate/fixture。 |
| 独立复核 | 是；AU-256确认生产入口无替代gate，结论一致。 |

## F-0233｜已否决：runtime contract marker 不属于启动阻断条件

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce bootstrap；NIT/已否决；高 |
| 直接证据 | `RuntimeCompatibility.ts:27-66`把contract作为状态输出，但`healthy`刻意不依赖它；`RuntimeCompatibility.test.ts:25-49`直接断言contract false时healthy仍为true，测试名称明确为“不赋予runtime阻断权”。 |
| 结论 | 各专用runtime的同样模式与共享契约一致，不能作为P1缺陷或修复依据。此前AU-248至AU-262的P1初判以本证据撤回，保留记录作为审计更正链。 |
| 后续 | 不建议修改predicate；仅在业务方另行改变“legacy contract”政策时重新评估。 |

## F-0014｜Catalog API Ready 未探测已启动的 HTTP 进程

| 字段 | 记录 |
| --- | --- |
| 模块 | Catalog API / systemd readiness |
| 类型 | 健康探针覆盖缺口、发布验收 |
| 严重级别 | P2 |
| 置信度 | 高（探针对象）；当前线上可用性未知且生产快照只证明 active |
| 文件和精确位置 | CatalogOperatorApiMain.ts:14-42；CatalogOperatorApiReadyMain.ts:4-15；CatalogOperatorRuntimeOperations.ts:8-45；sfl-catalog-api@.service:18-23；zdt-next.remote-policy.json:53 |
| 当前行为 | [FACT][E-AU-003-019] Main 创建 runtime、注册 /health/ready 并调用 NodeServer.listen；ExecStartPost 的 ReadyMain 却创建第二个独立 runtime，读取 manifest 后关闭，不向 Main 端口发送请求。release health 仅运行 systemctl is-active |
| 预期行为 | API readiness 至少证明 systemd 所启动 Main 的监听端口、路由注册和 target runtime compatibility 能共同返回预期健康证据 |
| 直接证据 | E-AU-003-005、E-AU-003-008、E-AU-003-019；RS-AU-003-004 |
| 调用链或运行入口 | systemd ExecStart Main → target runtime/bootstrap/listen；随后由独立 ExecStartPost 进程创建第二个 runtime/close → success；release → systemctl active |
| 用户影响 | [INFERENCE] Main 若保持进程但端口、路由或 HttpApp 路径异常，启动与发布检查仍可能通过，Catalog 调用随后失败；未证明当前正在发生 |
| 数据影响 | 无直接数据损坏证据；不可用时 Catalog 写入/读取请求会失败 |
| 安全影响 | 无直接安全影响 |
| 根因 | Ready 复用了 runtime dependency preflight 模式，但该模式适合 Jobs 的 ExecStartPre，不足以覆盖 API 的已启动 serving path |
| 建议方向 | 独立 Catalog readiness 批次复用现有 /health/ready，同时核对 manifest/node/scope 字段；不要与 Catalog 业务变更混批 |
| 预计修改范围 | Catalog ReadyMain 及定向入口/systemd 测试；无需改变业务 operation |
| 验证方式 | Main 真实端口成功、连接拒绝、错误 route、503 dependency、manifest mismatch 五类反事实；release health 仍只接受正确进程 |
| 回滚方式 | 回退 ReadyMain 小提交并恢复旧制品；不触及数据库 |
| 是否需要独立复核 | 否（P2）；若后续证明发布已接受不可用进程，再评估 P1 |

## 4. AU-003 新增未定级事项

- [CONFLICT][E-AU-003-022] staging 制品清单称 FullJobsMain.ts 不生成独立 artifact，但全量 build 按文件名会生成；staging unit 又固定阻断。保留历史/兼容分歧，不作删除结论。
- [UNKNOWN] JobsEntrypoint.ts 有 profile dispatcher 和测试，但不被当前全量 Main 发现或正式 service target 构建；外部消费者和历史发布责任未验证。
- [UNKNOWN] 生产观察的 12 个进程并非固定基线制品；只用于核对进程名称和 systemd 启动关系，不能把时点日志直接归因到基线。

## F-0015｜正式生产 workflow 固定使用 Direct，成功回执跳过可用性验收与健康回滚

| 字段 | 记录 |
| --- | --- |
| 模块 | 发布与运行 / GitHub → release engine → ECS agent |
| 类型 | 发布门禁、失败检测、回滚语义 |
| 严重级别 | **P1**；RV-0002 已于 2026-09-15 从唯一生产 workflow、engine/agent 分支和可执行反事实测试重新取证确认 |
| 置信度 | 高：固定 workflow、两条 agent 分支和反事实测试直接证明；事故频率与全部用户影响未知 |
| 文件和精确位置 | `.github/workflows/deploy.yml:65-109`；`04_tools/release-engine/src/planner.mjs:19-53,189-212`；`04_tools/release-engine/src/engine.mjs:114-119,357-477`；`04_tools/release-engine/remote/agent.mjs:240-305,388-470,472-712`；`04_tools/release-engine/test/remote-agent.test.mjs:64-75` |
| 当前行为 | [FACT][E-AU-004-004][E-AU-004-005][E-AU-004-006][E-AU-004-019] 正式 Deploy 在 plan/deploy 两处固定 `--direct`。Direct 仍校验 source、archive/tree/critical files 并传播 restart 错误，但明确跳过 preflight、tests、typecheck、production approval、candidate checks、capacity、Caddy 语义、目标/受保护进程、readiness、外部域名验收和健康失败自动回滚；真实成功 run 只形成 direct-activated 回执 |
| 预期行为 | 生产成功状态应证明仓库声明的最小可用性与发布后稳定性，或者明确输出未验收状态；已有 guarded 路径不应在唯一正式主入口中被无提示绕过 |
| 直接证据 | E-AU-004-004、E-AU-004-005、E-AU-004-006、E-AU-004-014、E-AU-004-019；RS-AU-004-002；TEST-AU-004-002 |
| 调用链或运行入口 | 人工 workflow_dispatch → Deploy Direct → planner direct → build/package → stage-direct → activate-direct → pointer/restart → direct success receipt |
| 用户影响 | [INFERENCE] 进程能重启但端口、路由、依赖、静态 root 或公网链路不可用时，workflow 仍可成功，故障延续到外部监控或用户报告；F-0001 提供同一时点“成功发布回执与公网 404 并存”的运行证据，但尚未证明 Direct 是该漂移根因 |
| 数据影响 | Direct 不改变 migration 的 forward-only 属性；跳过健康验收可能让依赖错误制品继续接收请求，具体数据风险需按 target 复核，未证明已损坏数据 |
| 安全影响 | 跳过 Caddy 语义和受保护进程对账扩大错误配置未被发布器发现的窗口；未发现正在发生的安全事故 |
| 根因 | [FACT][E-AU-004-014] 历史提交有意把旧 candidate、external baseline 和 production approval 主路径替换成 Direct；guarded 实现仍保留但正式 workflow 不调用 |
| 建议方向 | 后续独立发布治理批次先定义正式成功回执必须覆盖的最小门禁，再只调整 workflow/模式选择；不得与业务代码、Caddy修复或依赖升级混批 |
| 预计修改范围 | Deploy workflow、release mode/receipt 契约和定向 remote-agent tests；具体启用哪些门禁待 Ethan 决定 |
| 验证方式 | 第二审计者重新追踪 workflow→planner→engine→agent；覆盖 restart成功但candidate失败、health失败、Caddy变化、受保护PID变化、外部404、rollback失败的穷举反事实 |
| 回滚方式 | 回退独立 workflow/模式提交即可恢复 Direct；任何已经执行的数据库 migration 仍按 forward-only处理 |
| 是否需要独立复核 | 已完成 RV-0002；未来发布治理变更仍须独立变更后复核 |

为什么不是 P0：未发现正在造成严重数据损失、安全事故或全系统中断的证据；F-0001 的两个 404 也尚未建立到 Direct 的排他因果。当前只能保留 P1 候选。

**RV-0002（二次独立复核，2026-09-15）：确认 P1。** 当前唯一生产 workflow 的 plan/deploy 均固定 `--direct`；该分支跳过 approval、candidate checks、preflight、capacity、Caddy/受保护进程对账、readiness、外部验收和健康失败自动回滚。现有定向反事实测试以失败的 candidate/health command 仍得到 Direct success，已通过。详见 `records/AU-908-rv-0002-production-direct-gates/summary.md`；没有实施修复。

## F-0016｜HBBTZN Console 有两个无共享锁的生产 pointer writer

| 字段 | 记录 |
| --- | --- |
| 模块 | 发布与运行 / Console 静态制品 |
| 类型 | 并发、发布所有权、回滚基线 |
| 严重级别 | P2 |
| 置信度 | 高（两条可执行写链与锁缺口）；真实重叠执行未观察 |
| 文件和精确位置 | `.github/workflows/deploy-oss.yml:15-16,94-114`；`.github/workflows/deploy.yml:30-31`；`04_tools/scripts/release/activate-console-static.sh:15-63`；`04_tools/release-engine/remote/agent.mjs:388-470,1010-1023` |
| 当前行为 | [FACT][E-AU-004-008][E-AU-004-019] release agent 和 OSS activation 都可原子改写 `/opt/sfl/nodes/hbbtzn-l1/targets/console/current`。OSS 自身有 SHA/version/公网验收与失败恢复，但不持有 agent 的项目/节点/target flock；两个 workflow concurrency group 也不同 |
| 预期行为 | 同一生产 pointer 的所有 writer 应共享一个串行化边界和一致的 expected-current/receipt 语义 |
| 直接证据 | E-AU-004-008、E-AU-004-019；RS-AU-004-003；writers-and-locks.csv |
| 调用链或运行入口 | Deploy Direct → agent activate-direct → Console current；或 Deploy Console via Wuhan OSS → SSH stdin script → 同一 Console current |
| 用户影响 | [INFERENCE] 若并发或交错执行，最后写入者获胜，一条路径的成功/回滚回执可能不再描述最终线上版本；未证明当前发生 |
| 数据影响 | 只影响静态制品 pointer，无数据库写入证据 |
| 安全影响 | 无直接安全影响证据 |
| 根因 | OSS 是在正式 release engine之外新增的专用发布器，只复用了 pointer布局，未复用 agent lock和expected-current协议 |
| 建议方向 | 独立 Console 发布所有权批次先确定唯一 writer 或共享锁/expected-current 协议；保留 OSS 的不可变制品与公网版本验收 |
| 预计修改范围 | 两个 workflow 中的一条及 activation/agent 协调层；不应同时改 Console代码 |
| 验证方式 | 两发布器交错、同版本重放、A切换后B失败回滚、B读取过期previous四类并发测试；最终 pointer与两份receipt一致 |
| 回滚方式 | 回退协调提交，按明确 source SHA重新激活权威版本；release目录保留可恢复 |
| 是否需要独立复核 | 否（P2）；若发现真实交错导致生产回退，再升级复核 |

## F-0017｜控制面变更的 affected 规划与实际交付不一致

| 字段 | 记录 |
| --- | --- |
| 模块 | 发布与运行 / Caddy、Cloudflared、systemd |
| 类型 | 发布影响图、配置权威、可观察成功语义 |
| 严重级别 | P2 |
| 置信度 | 高：真实 planner 输出、artifact输入和installer调用点直接证明 |
| 文件和精确位置 | `02_platform_pingtai/infrastructure/release/zdt-next.release.json:422-431,569-590`；`02_platform_pingtai/infrastructure/release/install-ai-delivery-agent.sh:1-253`；`04_tools/release-engine/src/planner.mjs:60-82,162-212`；`.github/workflows/quality.yml:312-324` |
| 当前行为 | [FACT][E-AU-004-003][E-AU-004-007][E-AU-004-010] Caddy 变更会选 14 个非迁移业务 target；Cloudflared unit 因 tunnel规则叠加也选14个；普通 systemd unit、delivery tooling 和 OSS激活脚本为零target。但业务artifact不包含这些控制面文件，正式workflow只安装agent模式，线上active Caddy又不匹配仓库任一历史blob |
| 预期行为 | control-plane变更应由计划明确交付到active配置，或以不支持/需独立流程明确失败；不应重发无关业务制品后报告成功 |
| 直接证据 | E-AU-004-003、E-AU-004-007、E-AU-004-010、E-AU-004-012；RS-AU-004-004、RS-AU-004-005 |
| 调用链或运行入口 | Git diff → release rule → target plan → business artifact → agent；缺失的是触发文件到 `/etc/caddy`、node runtime或systemd unit的正式apply边 |
| 用户影响 | [INFERENCE] 预期修正路由/tunnel/unit的发布可成功但不生效，同时重启或重发14个无关target；故障继续存在 |
| 数据影响 | 无直接数据库写入；无关服务重启可扩大可用性影响，但未观察事故 |
| 安全影响 | active edge配置不受固定仓库制品完整性约束；未发现具体权限泄漏 |
| 根因 | affected-target是业务制品图，control-plane安装由独立runtime mode或AutoNode承担；两者没有正式workflow编排和统一active blob回执 |
| 建议方向 | 独立控制面发布设计批次先明确Caddy/systemd/Cloudflared各自权威writer、计划结果和回滚证据；不与业务target重构混批 |
| 预计修改范围 | release rules、control-plane artifact/apply入口与验收测试；范围需先由架构决策收敛 |
| 验证方式 | 对三类配置各提交无业务改动反事实，计划必须只显示真实交付单元；apply后active blob/semantic/unit hash与source一致，失败能恢复 |
| 回滚方式 | 保留active配置备份、semantic diff和旧unit；独立回退控制面提交，不回滚业务数据库 |
| 是否需要独立复核 | 否（P2）；若控制面设计涉及生产Caddy安装则实施前专项复核 |

## F-0018｜正式 deployment contract check 在固定基线上必然失败且未验证活跃发布链

| 字段 | 记录 |
| --- | --- |
| 模块 | 发布质量 / deployment contract |
| 类型 | 测试可信度、文档漂移、门禁可执行性 |
| 严重级别 | P2 |
| 置信度 | 高：正式npm入口直接执行并在确定token失败 |
| 文件和精确位置 | `package.json:93,123`；`04_tools/scripts/check/deployment.mjs:31-68` |
| 当前行为 | [FACT][E-AU-004-013] `npm run check:deployment --silent` 报 `DEPLOYMENT_CONTRACT_MISSING:SmokeMain.js`。检查把多个历史发布文件拼为文本并要求存在固定token；它不加载release adapter、不追workflow→agent路径，也不核对active运行状态。Direct workflow不要求它 |
| 预期行为 | 正式检查应在固定基线可执行，并直接测量当前发布契约；删除或更名非活跃token不应成为唯一判据 |
| 直接证据 | E-AU-004-013；TEST-AU-004-007 |
| 调用链或运行入口 | `quality:canonical-hard-cut` → `check:deployment` → 文本拼接/token查找；与 Deploy Direct 无前置关系 |
| 用户影响 | 质量总入口无法在基线上通过；团队可能长期绕过它，或把与真实部署无关的token恢复当成修复 |
| 数据影响 | 无直接数据影响 |
| 安全影响 | 无直接安全影响 |
| 根因 | 检查保存旧部署规格的表面词汇，而发布主轴已演进为target/agent/Direct/OSS；两套契约未同步 |
| 建议方向 | 独立测试可信度批次先列出现役发布不变量，再以planner/agent/workflow行为反事实替换或重定向旧token检查；不为让测试绿而补假token |
| 预计修改范围 | 一个检查脚本、对应测试和根script编排；不改生产发布代码 |
| 验证方式 | 当前正确链通过；移除target、跳锁、跳source校验、错误pointer、错误回滚等反事实必须失败；无关注释/token不能使其通过 |
| 回滚方式 | 回退独立检查提交；不影响线上状态 |
| 是否需要独立复核 | 否（P2） |

## F-0019｜三个 SSH workflow 在运行时信任未预先固定的 ssh-keyscan 结果

| 字段 | 记录 |
| --- | --- |
| 模块 | 发布供应链 / GitHub Actions SSH |
| 类型 | 主机身份验证、供应链边界 |
| 严重级别 | P2 |
| 置信度 | 高（当前配置）；利用需要网络或解析路径被干预，未发现实际攻击 |
| 文件和精确位置 | `.github/workflows/deploy.yml:90`；`.github/workflows/quality.yml:213`；`.github/workflows/deploy-oss.yml:102` |
| 当前行为 | [FACT][E-AU-004-015] 每个run把当次 `ssh-keyscan -H 123.57.232.253` 输出直接追加到新known_hosts，仓库内未找到预置fingerprint或独立比较 |
| 预期行为 | 首次SSH信任应有独立于本次网络握手的主机身份依据；具体约束是否实施由Ethan决定 |
| 直接证据 | E-AU-004-015；COM-AU-004-012 |
| 调用链或运行入口 | GitHub runner → ssh-keyscan网络响应 → known_hosts → 随后的ssh/scp |
| 用户影响 | [INFERENCE] 若runner到固定IP的网络路径被干预，同一错误key可被本run接受，发布失败或发送到错误主机；条件较强且未观察 |
| 数据影响 | 无已发生数据影响；发布命令包含生产变更能力 |
| 安全影响 | 条件满足时可能泄露传输内容或执行发布命令到非预期主机；workflow secrets是否可被对端取得取决于命令，未进一步推断 |
| 根因 | known_hosts信任锚与待验证连接来自同一即时通道 |
| 建议方向 | 仅报告；若Ethan决定治理，独立供应链批次选择可审计的主机key/fingerprint来源并定义轮换流程 |
| 预计修改范围 | 三个workflow与运维记录；不涉及应用代码 |
| 验证方式 | 正确key成功、错误key硬失败、合法轮换显式批准；不得再以本次scan结果自证 |
| 回滚方式 | 回退workflow小提交；恢复原scan行为 |
| 是否需要独立复核 | 否（P2）；实施任何供应链约束前由Ethan确认 |

## F-0020｜affected 发布只比较 HEAD^，不能覆盖目标实际部署版本后的累计变化

| 字段 | 记录 |
| --- | --- |
| 模块 | 发布规划 / affected target |
| 类型 | 差异基线、漏发布、版本漂移 |
| 严重级别 | P2 |
| 置信度 | 高：workflow固定base、planner输入语义和不同target source SHA直接；实际漏发事件未确认 |
| 文件和精确位置 | `.github/workflows/deploy.yml:65-78`；`04_tools/release-engine/src/planner.mjs:8-46,60-82` |
| 当前行为 | [FACT][E-AU-004-016] 未显式target时，workflow总以所选commit的 `HEAD^` 作为from。planner不知道每个target current artifact的source SHA。若中间提交未发布或某target此前失败，本次只看到最后一提交，较早累计变化对应target可不入计划 |
| 预期行为 | affected发布应比较每个目标实际已部署source与目标source，或明确拒绝无法形成完整累计差异的请求 |
| 直接证据 | E-AU-004-004、E-AU-004-016；RS-AU-004-007 |
| 调用链或运行入口 | workflow selected ref → base=HEAD^ → changedFiles → release rules → selected targets；target current source只在远端激活阶段出现 |
| 用户影响 | [INFERENCE] workflow可成功，但某些应更新target保留旧版本，形成跨服务/前端契约漂移；显式target是人工绕行，不是affected正确性证明 |
| 数据影响 | 若漏掉database-migration或依赖服务，可产生schema/应用不兼容；当前未证明具体数据错误 |
| 安全影响 | 若较早提交是权限修正，对应target可漏发；没有观察到实际安全缺口 |
| 根因 | Git提交相邻差异被当作部署状态差异；发布状态只在agent端用于expected/current，而未反馈给planner |
| 建议方向 | 独立planner批次先定义多target部署基线来源和落后/领先/未知状态；不与F-0017控制面交付混批 |
| 预计修改范围 | workflow输入、planner状态读取/plan schema和定向测试；可能需要只读汇总target receipt |
| 验证方式 | target已在HEAD~3、HEAD~1、目标SHA、未知SHA、部分失败五种状态；affected集合应等于各自累计差异并显式显示base |
| 回滚方式 | 回退planner/workflow小提交并改用显式target；不改变已部署制品 |
| 是否需要独立复核 | 否（P2）；若引入生产状态聚合服务再专项设计复核 |

## 5. AU-004 新增未定级事项

- [UNKNOWN][E-AU-004-010] active `/etc/caddy/Caddyfile` 不匹配固定基线或仓库历史45个Caddy blob中的任何一个；其创建者、安装时间和完整变更链未取得。
- [UNKNOWN][E-AU-004-012] AutoNode具有完整外部资源控制面，但固定基线没有正式workflow/package执行入口；是否由外部runbook调用尚未验证。
- [UNKNOWN][E-AU-004-009] Cloudflare tunnel、DNS与OSS账户侧策略没有纳入本单元；仓库example和公开HTTP只能证明局部链路。
- [FACT][E-AU-004-018] legacy deploy、零target control-plane文件及AutoNode入口均未满足垃圾代码认定条件，本单元不新增G1–GX候选。

## F-0021｜Secret Store 与 KMS 的生产入口绕过已有工作负载授权

| 字段 | 记录 |
| --- | --- |
| 模块 | 共享状态 / Secret Store、KMS |
| 类型 | 身份验证、资源授权、生产接线与测试对象不一致 |
| 严重级别 | **P1**；RV-0003 已于 2026-09-15 从 production systemd、build/entry map、Main、Handler 与 policy 重新取证确认 |
| 置信度 | 高（build、systemd、Main、Handler、policy和客户端闭环）；未观察真实未授权调用 |
| 文件和精确位置 | `04_tools/tools/localsecrets/src/Main.ts:5-25`、`Handler.ts:8-24`；`04_tools/tools/localkms/src/Main.ts:5-33`、`Handler.ts:9-34`；`04_tools/tools/localinfra/src/WorkloadAccessPolicy.ts:82-147`、`Run.ts:4-30`；`04_tools/scripts/build-commerce.mjs:10-20`；`01_core_hexin/services/commerce/src/foundation/infrastructure/SecretStore.ts:26-45`、`KmsClient.ts:11-47` |
| 当前行为 | [CONFLICT][E-AU-005-006][E-AU-005-016] 客户端始终发送Bearer；授权版Handler会在读取path/body前执行authenticate并对ref/keyRef执行require。实际打包的两个Main自行定义handler，完全不读取authorization header、不调用Handler，也不加载已经由环境解析器返回的workload policy。全仓排除测试和定义后的两个Handler生产引用数均为0 |
| 预期行为 | [FACT] 仓库运行说明及现有授权实现都要求`/health/ready`以外先验证workload Bearer，再限制到精确ref/keyRef |
| 直接证据 | E-AU-005-006、E-AU-005-014、E-AU-005-016；RS-AU-005-001/002；secret-key-ownership.csv |
| 调用链或运行入口 | systemd → `InternalRuntimeMain.js`/`LocalSecretsMain.js` → build map → `Run.ts` → `localsecrets/Main.ts`、`localkms/Main.ts`；staging虽注入policy credential，仍走相同Main |
| 用户影响 | [INFERENCE] 同主机上能连接loopback端口的进程可枚举已知ref读取secret，或对已知keyRef调用加解密；未证明外部网络可直接访问或已有滥用 |
| 数据影响 | 可能暴露数据库/第三方配置secret或解密受KMS保护字段；未读取任何明文、未确认实际暴露记录 |
| 安全影响 | 工作负载隔离和最小资源授权在生产服务端未执行；loopback限制缩小网络面，但不替代进程身份授权 |
| 根因 | 旧Main业务handler与后加的授权Handler/policy并存，构建和运行入口继续指向旧Main组合 |
| 建议方向 | 只有在Ethan授权后，独立修复批次复用现有Handler/policy并对production/staging两种profile做无token、错token、越权ref和正确ref四类反事实；本审计不增加新安全策略 |
| 预计修改范围 | 两个Main的组合入口、必要的policy加载和对应入口测试；不应同时改加密原语或secret目录结构 |
| 验证方式 | 第二审计者重新从unit追到bundle source；隔离环境验证health 200、缺/错Bearer 401、越权403、正确授权成功，并确认日志不含值 |
| 回滚方式 | 修复分支保留原bundle；若接线影响启动，回退单一入口提交，不更换master key或secret值 |
| 是否需要独立复核 | 已完成 RV-0003；未来安全接线变更仍须独立变更后复核 |

**RV-0003（二次独立复核，2026-09-15）：确认 P1。** 正式 `registration-only` runtime 与 secret-store unit 都启动未认证的 Main；Main 不读取 Authorization、不调用已有 Handler、也不加载 workload policy。已存在 Handler/policy 的测试规定了应有的 401/403 行为，但当前 production entry 未接线；full-staging 注入 policy credential 仍不改变这一事实。详见 `records/AU-909-rv-0003-secret-store-kms-authz/summary.md`；未读取或访问任何凭据。

## F-0022｜正式运行目标没有 OutboxRelay 与 RuntimeScheduler

| 字段 | 记录 |
| --- | --- |
| 模块 | 共享状态 / runtime outbox、inbox、job、scheduler |
| 类型 | 异步控制面缺失、注册与部署边界漂移 |
| 严重级别 | **P1**；RV-0004 已于 2026-09-15 从正式 target/worker entry、relay/scheduler 构造点与 staging fail-closed 限制重新取证确认 |
| 置信度 | 高（构造点和正式target图）；live积压与所有producer可达性未验证 |
| 文件和精确位置 | `01_core_hexin/services/commerce/src/entry/JobsMain.ts:11-25`、`FullJobsMain.ts:11-31`；`foundation/infrastructure/OutboxRelay.ts:11-37`、`RuntimeEventPublisher.ts:8-27`、`RuntimeScheduler.ts:11-42`；`app/events.ts:74-142`；`02_platform_pingtai/infrastructure/release/zdt-next.remote-policy.json:20-69` |
| 当前行为 | [CONFLICT][E-AU-005-003][E-AU-005-004] 全仓49个非测试文件包含`runtime.outbox`写入语句，其中34个在commerce运行源码；generated handler表将事件映射到projection、notification、reconciliation、referral等job。唯一构造relay/scheduler的入口是JobsMain/FullJobsMain，但production release/remote policy只部署identity-notification、catalog、payment dedicated Jobs；full-staging聚合Jobs unit又被显式要求保持inactive；未发现DB trigger把该outbox自动转job |
| 预期行为 | 已提交outbox应有唯一、可观察、可恢复的正式发布进程；周期expiry/cleanup也应有明确scheduler owner |
| 直接证据 | E-AU-005-003、E-AU-005-004、E-AU-005-016；RS-AU-005-003/004；queue-crash-matrix.csv |
| 调用链或运行入口 | 正式API/Jobs业务事务 → `runtime.outbox`；预期下游为OutboxRelay → RuntimeEventPublisher → inbox+runtime.job → job processors；实际正式target图在relay前断开 |
| 用户影响 | [INFERENCE] 可达producer产生的通知、投影、对账、推荐/返利等异步结果不会发生；具体业务影响取决于哪类producer当前可达和是否有图外进程 |
| 数据影响 | 业务事实与outbox原子保存，不等于数据丢失；但派生状态/通知可能长期滞后。live backlog未查询 |
| 安全影响 | 无直接权限绕过证据；cleanup缺席可能延长敏感运行记录保留期，未验证实际数据 |
| 根因 | 运行入口从聚合Jobs收敛到专用workers时，没有为通用outbox relay、scheduler和cleanup保留正式发布单元或替代实现 |
| 建议方向 | 独立架构批次先确认唯一异步控制面和当前积压，再决定挂载现有aggregate能力还是拆成专用target；禁止先删outbox/handler或盲目重放 |
| 预计修改范围 | release target、systemd/entry与只读backlog/readiness；不与业务processor修复混批 |
| 验证方式 | 第二审计者从至少三个正式API重追producer；核对正式进程/active unit；经授权只读统计unpublished/oldest age，并用隔离事件验证exactly-once enqueue语义 |
| 回滚方式 | 新控制面应可停用并恢复原target集合；outbox行保留，补偿/重放按event id与inbox事实执行 |
| 是否需要独立复核 | 已完成 RV-0004；未来控制面接线与补偿均须独立变更后复核 |

**RV-0004（二次独立复核，2026-09-15）：确认 P1。** Outbox relay 与 scheduler 仅由 `JobsMain`/`FullJobsMain` 构造；正式 policy 只部署三类不含它们的专用 Jobs，唯一引用聚合 Jobs 的 staging unit 被 `ExecCondition=/usr/bin/false` 固定阻断。多个正式 API 模块仍可写入 outbox。详见 `records/AU-910-rv-0004-outbox-runtime-control-plane/summary.md`；未查询积压、启动 worker 或重放事件。

## F-0023｜生产 PostgreSQL 17 编排与仅接受 PostgreSQL 16 的初始化脚本互斥

| 字段 | 记录 |
| --- | --- |
| 模块 | 共享状态 / PostgreSQL 创建与恢复 |
| 类型 | 版本契约、首次初始化、灾难恢复路径 |
| 严重级别 | **P1**；RV-0005 已于 2026-09-15 从 Compose、init hook、SQL guard、env 与检查 fixture 重新取证确认 |
| 置信度 | 高（显式major条件）；现有非空volume不受首次init路径影响 |
| 文件和精确位置 | `02_platform_pingtai/infrastructure/zhudatuan/aliyun/registration-compose.yml:3-35`；`postgres-init-registration.sh:3-28,54-115`；`postgres.env.example:1-15`；`04_tools/scripts/check/registration-deployment.mjs:5-22,73-118,160-190`；`audit/postgres-init-registration.pg16-fixture.mjs` |
| 当前行为 | [CONFLICT][E-AU-005-010] Compose固定`postgres:17-alpine`并把init脚本挂到`docker-entrypoint-initdb.d`；脚本明确拒绝`server_version_num>=170000`，还要求expected RDS address及预建的`zhudatuanregistrationboundary`。env example不含expected address，Compose也未见空卷脚本前置role creator；检查器只要求PG16 fixture覆盖 |
| 预期行为 | 固定生产镜像、空卷初始化、恢复演练和检查fixture必须接受同一明确major及同一目标类型，能在隔离新卷上从零成功或明确拒绝不支持的拓扑 |
| 直接证据 | E-AU-005-010、E-AU-005-014、E-AU-005-016；RS-AU-005-006；branches-and-states.md |
| 调用链或运行入口 | `zhudatuan-registration-database.service` → Docker Compose PG17 → 空data directory → `10-registration-roles.sh` → version guard首个确定失败 |
| 用户影响 | [INFERENCE] 当前volume丢失、新节点或灾备恢复到空卷时数据库服务无法就绪，所有依赖registration DB的入口不可用 |
| 数据影响 | 不直接修改现有数据；危险在恢复失败和恢复时间不可预测。未执行生产volume或全量重放 |
| 安全影响 | 无直接安全缺口；绕过guard或伪造ledger不是允许的解决方式 |
| 根因 | RDS/PG16初始化契约被挂入本地PG17容器恢复路径，检查脚本只验证token和PG16 fixture，没有交叉验证运行镜像major/目标前置 |
| 建议方向 | 独立恢复设计批次先由Ethan确认权威拓扑与major，再在一次性隔离新卷验证；不得修改已登记迁移、不得拿生产卷试验 |
| 预计修改范围 | Compose/init/env/check/恢复文档中的单一兼容组合；不能与业务迁移变更混批 |
| 验证方式 | 第二审计者在隔离临时volume穷举PG17当前配置、权威major、缺键、错误地址、非空target和成功路径；记录首个失败且不输出secret |
| 回滚方式 | 现有production volume保持不动；未来配置提交可回退，数据库迁移仍按forward-only处理 |
| 是否需要独立复核 | 已完成 RV-0005；未来恢复设计变更仍须独立变更后复核 |

**RV-0005（二次独立复核，2026-09-15）：确认 P1。** Compose 固定 PG17，init guard 却明确拒绝 PG17；空卷路径还缺少脚本要求的预建 boundary role、精确 RDS 地址与 env 契约。详见 `records/AU-911-rv-0005-registration-postgres-recovery/summary.md`；未运行容器或执行 SQL。

## F-0024｜通用 job claim 不回收过期 running，正式 Catalog export 使用该分支

| 字段 | 记录 |
| --- | --- |
| 模块 | 共享状态 / JobRunner、Catalog export |
| 类型 | 崩溃恢复、租约状态机 |
| 严重级别 | P2 |
| 置信度 | 高；线上孤儿job数量未验证 |
| 文件和精确位置 | `foundation/application/JobRunner.ts:47-69,78-106`；`bootstrap/CatalogJobsRuntime.ts:150-206`；`20260821012000_create_runtime_control.sql:167-188`；`modules/runtime/RuntimeJobs.ts:10-26` |
| 当前行为 | [CONFLICT][E-AU-005-005] scoped claim显式接受lease过期的running；通用`runtime.claim_job`只选queued。Catalog import/publication配置有scope，reporting export的独立配置漏scope，因此正式Catalog Jobs的export走通用分支。进程在claim后退出会留下无法被同类worker再领的running job；cleanup能重排但它属于F-0022缺失的aggregate控制面 |
| 预期行为 | 所有带lease的claim路径都应在lease到期后由明确owner安全恢复，或明确使用外部reaper且该reaper正式运行 |
| 直接证据 | E-AU-005-005、RS-AU-005-005；QC-005/QC-006 |
| 调用链或运行入口 | `CatalogJobsMain` → `createCatalogJobs` → export `QueueJob` → `JobRunner.run` generic branch → `runtime.claim_job` |
| 用户影响 | 某次导出在worker异常退出后可永久显示处理中，后续轮询不能完成或下载 |
| 数据影响 | export业务状态和runtime.job漂移；已生成对象/分页进度是否残留取决于崩溃点，留reporting专项 |
| 安全影响 | 无直接安全影响 |
| 根因 | scoped worker引入新的回收SQL时，export配置仍落入旧通用函数；恢复又隐式依赖未部署cleanup |
| 建议方向 | 独立job lease批次统一claim/reaper所有权并对export崩溃点做反事实，不与processor业务重构混批 |
| 预计修改范围 | claim SQL或export runner配置及定向测试；若涉及迁移须新建受管迁移 |
| 验证方式 | 隔离DB创建queued→claim→过期running，重启相同worker应恰好恢复一次；同时验证未过期、不同scope和副作用幂等 |
| 回滚方式 | 回退应用配置；若新增迁移遵守forward-only，以后续迁移恢复旧语义，不改ledger |
| 是否需要独立复核 | 否（P2）；若live存在大量关键任务孤儿则升级复核 |

## F-0025｜Local Objects 给浏览器签发 loopback 下载地址

| 字段 | 记录 |
| --- | --- |
| 模块 | 共享状态 / Local Objects、Reporting、Console |
| 类型 | API契约、客户端/服务端地址边界 |
| 严重级别 | P2 |
| 置信度 | 高（值从Main到anchor无改写）；线上completed export未验证 |
| 文件和精确位置 | `04_tools/tools/localobjects/src/Main.ts:5-12,20-23,58-68`；`LocalObjects.ts:121-140`；`foundation/infrastructure/ObjectStore.ts:80-89`；`modules/reporting/.../GetExport.ts:14-20`；`apps/console/.../OrderExportWorkspace.tsx:94-107,228-234` |
| 当前行为 | [CONFLICT][E-AU-005-007][E-AU-005-017] Main构造`publicEndpoint=https://127.0.0.1:<object-port>`；authorize将其原样返回，API原样放入download，Console anchor直接导航。仓库Caddy/release图未发现`/v1/public`公网反代或URL重写 |
| 预期行为 | 返回给远端浏览器的临时URL应指向浏览器可到达且仍验证签名的公开网关，或下载由API代理 |
| 直接证据 | E-AU-005-007、E-AU-005-017、RS-AU-005-007 |
| 调用链或运行入口 | Console下载 → reporting export read → ObjectStore.authorize → LocalObjects signed URL → browser `127.0.0.1` |
| 用户影响 | 远端运营用户无法下载已经完成的订单导出；浏览器会连接用户自己的机器 |
| 数据影响 | 对象仍在服务器StateDirectory，不是数据删除；访问路径不可用 |
| 安全影响 | 若用户本机恰有该端口服务，URL/query会发送到本机服务；签名短期有效，未观察实际泄露 |
| 根因 | 内部服务监听地址同时被当作浏览器public endpoint |
| 建议方向 | 独立对象下载契约批次确定权威public host/proxy；不同时改对象格式或导出业务 |
| 预计修改范围 | object runtime配置/Main、edge路由或reporting下载代理中的一种权威方案及E2E |
| 验证方式 | 隔离生成completed export，远端浏览器URL host非loopback、签名有效、过期/篡改拒绝，其他对象私有路由仍不可公网访问 |
| 回滚方式 | 回退单一URL接线提交；对象与数据库引用不变 |
| 是否需要独立复核 | 否（P2）；上线前需真实页面网络验收 |

## F-0026｜Local Objects 未扫描内容却把上传结果标记为 clean

| 字段 | 记录 |
| --- | --- |
| 模块 | 共享状态 / Local Objects、Import、Reporting |
| 类型 | 状态真实性、内容信任契约 |
| 严重级别 | P2 |
| 置信度 | 高（直接赋值和全仓scanner负向搜索）；恶意内容影响未验证 |
| 文件和精确位置 | `04_tools/tools/localobjects/src/LocalObjects.ts:67-91`；`foundation/infrastructure/ObjectStore.ts:5-24,43-77,123-131`；`modules/reporting/.../ExportJobRunner.ts:42-48`；ImportFile/ImportOperations消费者 |
| 当前行为 | [CONFLICT][E-AU-005-008] complete只验证分片、size和SHA-256，随后无条件写`scan:'clean'`；仓库LocalObjects链没有scanner、quarantine或scan receipt。多个消费者把`clean`作为继续导入/完成导出的信任条件 |
| 预期行为 | `clean`必须表示可追溯扫描器实际给出的结果；若系统只承诺完整性，应使用不虚构扫描事实的状态契约 |
| 直接证据 | E-AU-005-008、RS-AU-005-008；INV-AU-005-007 |
| 调用链或运行入口 | HttpObjectStore upload → LocalObjects.complete → metadata.clean → inspect → import/reporting gate |
| 用户影响 | 用户可被告知文件已通过安全检查，实际只验证字节完整性；具体解析器可利用性留业务专项 |
| 数据影响 | 未扫描文件可进入持久对象目录和后续数据导入；未证明已有恶意对象 |
| 安全影响 | 信任状态是假阳性；风险大小取决于文件来源和解析器，本AU不夸大为已利用 |
| 根因 | 单一`StoredObject`类型把完整性成功与恶意内容扫描成功合并成固定字面量 |
| 建议方向 | 由Ethan决定是否需要扫描能力；若需要，独立批次定义pending/clean/rejected与可验证receipt；若不需要，独立契约批次移除虚假语义。审计不实施安全约束 |
| 预计修改范围 | ObjectStore契约、LocalObjects adapter及实际消费者/tests；需要先评估兼容字段 |
| 验证方式 | 反事实文件必须在扫描成功前不能得到clean；scanner失败/超时/重试/拒绝均有稳定状态。若选择无扫描语义，则调用方不得把完整性写成clean |
| 回滚方式 | 保留原对象bytes和metadata备份；契约迁移需兼容旧记录，不直接删字段/对象 |
| 是否需要独立复核 | 否（P2）；若确认公网任意上传并由高危解析器执行则重新定级 |

## F-0027｜内容哈希唯一 metadata 会被相同字节的后续上传覆盖

| 字段 | 记录 |
| --- | --- |
| 模块 | 共享状态 / Local Objects |
| 类型 | 数据模型、不变性、并发/重复写 |
| 严重级别 | P2 |
| 置信度 | 高（确定文件键和写顺序）；实际collision频率未知 |
| 文件和精确位置 | `04_tools/tools/localobjects/src/LocalObjects.ts:67-118,149-155`；`LocalObjects.test.ts` |
| 当前行为 | [CONFLICT][E-AU-005-008] reference和metadata文件都只按内容SHA-256；metadata同时包含path/contentType。相同bytes以不同path或contentType再次complete时，后一次覆盖同一metadata JSON；旧path文件仍指同一reference，随后inspect返回后一次path/contentType |
| 预期行为 | 内容寻址bytes可去重，但一个既有reference的可观察metadata应不可变，或path/contentType应按逻辑对象独立保存 |
| 直接证据 | E-AU-005-008、RS-AU-005-008；INV-AU-005-008 |
| 调用链或运行入口 | upload A → digest ref/metadataA/pathA；upload B同bytes → 同ref/metadataB/pathB；find(pathA) → ref → metadataB |
| 用户影响 | 旧对象下载content-type或展示名称/审计path可在无旧调用者写入时变化 |
| 数据影响 | bytes不变，但metadata历史和path归属被覆盖；并发完成时最后写入者获胜 |
| 安全影响 | content-type漂移可能改变浏览器处理方式；未验证公网可利用路径 |
| 根因 | 把内容实体和逻辑path实体压在同一digest metadata记录上，文件系统多写步骤也无事务 |
| 建议方向 | 独立对象模型批次先决定reference不变量和兼容迁移；不得删除现有对象或path索引 |
| 预计修改范围 | LocalObjects metadata/path模型、ObjectStore返回契约、迁移/恢复工具和collision tests |
| 验证方式 | 同bytes同/异path、同/异content-type、并发complete、metadata写中断四组；旧引用观察必须满足定稿不变量 |
| 回滚方式 | 新索引并行写、可逆切读；保留旧digest files直到验证完毕 |
| 是否需要独立复核 | 否（P2）；数据迁移设计实施前需专项复核 |

## F-0028｜Redis 瞬时失败后不会在同一进程内恢复

| 字段 | 记录 |
| --- | --- |
| 模块 | 共享状态 / Redis cache |
| 类型 | 可用性、恢复状态机 |
| 严重级别 | P3 |
| 置信度 | 高（状态机无恢复边）；当前正式dedicated target不消费Redis |
| 文件和精确位置 | `foundation/cache/RedisCache.ts:4-25,27-85`；`bootstrap/CommerceRuntime.ts:62-77`；`packages/config/src/ApiEnvironment.ts`、`JobsEnvironment.ts` |
| 当前行为 | [FACT][E-AU-005-009] client配置`reconnectStrategy:false`；start或get/put/remove异常后进入degraded，destroy/丢弃client。实例没有restart/reconnect方法，后续全部返回miss/false直到整个服务进程重启 |
| 预期行为 | 既然Redis是可降级cache，瞬时故障后应有明确、有界、可观察的恢复策略，或明确要求进程重启并由运行平台执行 |
| 直接证据 | E-AU-005-009、RS-AU-005-009；Redis状态图 |
| 调用链或运行入口 | aggregate createRuntime → RedisCache.start → external Redis；当前formal dedicated API/jobs使用专用runtime，aggregate target不存在 |
| 用户影响 | 在使用该路径的staging/未来aggregate进程中，短暂Redis故障可造成持续cache miss和性能退化；不构成权威数据丢失 |
| 数据影响 | 无，cache被设计为非权威/fail-open |
| 安全影响 | 无直接安全影响 |
| 根因 | 一次性bootstrap连接模型与fail-open状态结合，没有恢复转移 |
| 建议方向 | 若该runtime重新成为正式target，独立cache批次定义有界重连、退避和指标；不与业务cache key重构混批 |
| 预计修改范围 | RedisCache状态机及定向fake-client tests |
| 验证方式 | startup失败后恢复、运行中断连后恢复、持续失败退避、close期间不重连、listener只按状态转移触发 |
| 回滚方式 | 回退cache状态机提交；服务重启恢复原一次性连接语义 |
| 是否需要独立复核 | 否（P3） |

## 6. AU-005 新增未定级事项

- [UNKNOWN][E-AU-005-012] 当前zhudatuan PostgreSQL、L0/L1 Local Objects、secret catalogs和KMS master key的仓库外备份、恢复演练、RPO/RTO和负责人未取得；不能写成“不存在备份”。
- [UNKNOWN] 未读取线上runtime表或对象目录，F-0022/F-0024/F-0025/F-0027的历史数量和用户影响规模均未验证。
- [HYPOTHESIS][QC-009] JobRunner吞掉heartbeat错误后旧processor可能与新lease owner短时并行；是否形成重复副作用必须逐processor审，不在本AU新增编号。

## F-0029｜Console 节点运行地址没有绑定到 Manifest domain

| 字段 | 记录 |
| --- | --- |
| 模块 | 共享配置 / SFL Console Runtime |
| 类型 | 节点边界、配置完整性、敏感请求目的地 |
| 严重级别 | **P1**；RV-0007 已于 2026-09-15 从 manifest、runtime parser/resolver、Console loader 与 SDK request 重新取证确认 |
| 置信度 | 高：parser、resolver、浏览器加载、SDK header和正向producer均已重追；线上runtime值与实际利用未验证 |
| 文件和精确位置 | packages/config/src/SflNodeKernelConsole.ts:220-299,330-399,417-438；apps/console/src/shared/config/RuntimeConfig.ts:32-58；packages/sdk/src/RequestContextFactory.ts:27-38、ApiClient.ts:99-110、FetchTransport.ts:6-15；autonode-engine.mjs:397-414 |
| 当前行为 | [CONFLICT][E-AU-006-005] api_base_url只需为HTTPS origin，identity_entry_url只需HTTPS且无认证/hash；validateNodeRuntimeReferences核对artifact/Manifest digest、resource ref与scope，却不核对两个URL属于Manifest对应surface。resolve直接安装这些URL |
| 预期行为 | 节点运行配置中的API与Identity目标必须由同一已验证Manifest的domain binding ref解析，或至少与对应Manifest domain做exact交叉校验 |
| 直接证据 | E-AU-006-005、RS-AU-006-001、INV-AU-006-005、FM-AU-006-001 |
| 调用链或运行入口 | 浏览器GET /console-runtime.json → parseSflConsoleNodeRuntime → resolveConsoleNodeRuntimeConfig → AppConfig → SDK fetch/window.location.assign |
| 用户影响 | [INFERENCE] 错误配置可把运营页面登录引向错误域，或使Console全部查询/命令指向错误API；表现可为登录失败、伪登录页、错误数据或操作失败 |
| 数据影响 | SDK会把scope、版本、幂等键、CSRF及部分action proof作为header发往配置API；目标若允许CORS可接收请求。是否有真实请求到错误域UNKNOWN |
| 安全影响 | 配置层可改变认证跳转和敏感header目的地，却不破坏当前Manifest/artifact验证；这是跨节点/外域能力边界缺口 |
| 根因 | runtime binding以裸URL承载资源，而完整性检查只绑定resource_binding_set_ref，未把URL映射回Manifest domain binding |
| 建议方向 | 后续独立批次先定稿URL应由binding ref派生还是交叉校验；同时覆盖静态artifact和per-node runtime，不在审计分支实施 |
| 预计修改范围 | SflNodeKernelConsole类型/parser/resolver、registry/AutoNode runtime生成、Console tests与可能的runtime schema兼容 |
| 验证方式 | 第二审计者构造合法Manifest、合法resource ref但外域API/Identity URL；parser/resolve必须拒绝。再覆盖正常L0/L1、激活换Manifest、旧schema兼容和真实浏览器CORS/redirect边界 |
| 回滚方式 | 修复批次保留旧runtime schema/文件备份并可回切原解析提交；节点release pointer按正式流程回退 |
| 是否需要独立复核 | 已完成 RV-0007；未来 runtime schema 变更仍须独立变更后复核 |

**RV-0007（二次独立复核，2026-09-15）：确认 P1。** runtime parser 仅验证 HTTPS URL，不将 API/Identity host 约束到已验证 Manifest domain binding；Console 直接安装并由 SDK 向该 URL 发出带 scope、幂等、CSRF 与 action-proof headers 的请求。详见 `records/AU-912-rv-0007-console-runtime-domain-binding/summary.md`；未读取线上 runtime 或发起业务请求。

为什么不是P0：没有读取线上console-runtime.json，也没有证据证明当前正在错误路由、泄露token或造成事故。现有AutoNode正向producer从同一request.domains生成Manifest与URL，是缓解证据，但不是parser不变量。

## F-0030｜环境所有权门禁与真实读取模型同时出现确定拒绝和漏报

| 字段 | 记录 |
| --- | --- |
| 模块 | 共享配置 / 架构质量门禁 |
| 类型 | 检查器漂移、配置所有权证据失真 |
| 严重级别 | P2 |
| 置信度 | 高：按检查器同一文件选择、正则和report去重做了完整只读复算；正式命令本环境在依赖加载前阻塞 |
| 文件和精确位置 | scripts/audit/environment.mjs:7-40；scripts/check/source.mjs:8-20,46-78；package.json:107,111,123；Commerce/bootstrap/CatalogJobsRuntime.ts:81-115 |
| 当前行为 | [FACT][E-AU-006-003] 复算1,743个生产源码得到85条唯一违规、23文件：undeclared 35、outside owner 49、dynamic 1；DEV/BASE_URL等Vite内建键也被报。declared集合来自config包任意大写字符串，且source=process.env的Catalog Jobs自有parser不被直接属性/下标正则识别 |
| 预期行为 | 正式质量门禁应对当前批准架构给出稳定信号，并以真实环境键声明/允许例外为事实源；所有旁路读取应被一致捕获 |
| 直接证据 | E-AU-006-003；environment-gate-replica.csv；RS-AU-006-003 |
| 调用链或运行入口 | quality:canonical-hard-cut → audit:architecture → check:environment → productionSources/regex/report |
| 用户影响 | 质量流程在依赖完整时会被当前静态状态拒绝，或团队为绕过噪声忽略该门禁；产品运行不由此直接中断 |
| 数据影响 | 无直接数据写入；漏报可让配置所有权继续漂移 |
| 安全影响 | 门禁不能可靠证明secret/env读取只发生在声明owner；不等于已发生secret泄露 |
| 根因 | 用字符串正则近似AST/声明表，并把所有大写字符串当环境键；规则没有Vite内建例外，也不识别source alias/default parameter |
| 建议方向 | 独立门禁批次先确定允许的owner与框架内建键，再从显式环境schema生成检查集合并补alias/AST测试 |
| 预计修改范围 | environment checker、config schema/export、前端/工具/CatalogJobs所有权声明和checker fixtures |
| 验证方式 | 在依赖完整环境执行正式命令；包含owner正例、outside负例、alias、dynamic、Vite built-ins、错误码字符串不算声明六组反事实 |
| 回滚方式 | 回退单一checker提交；保留当前85条基线快照用于对比，不通过删除规则静默清零 |
| 是否需要独立复核 | 否（P2）；若后续把它作为生产发布强制门禁，应在实施批次独立验收 |

## F-0031｜Config 正式测试入口遗漏四个专用 Environment 测试

| 字段 | 记录 |
| --- | --- |
| 模块 | 共享配置 / 测试入口 |
| 类型 | 测试发现、假阳性 |
| 严重级别 | P2 |
| 置信度 | 高 |
| 文件和精确位置 | packages/config/package.json:7-12；根package.json:49-50；MallProvisioningApiEnvironment.test.ts、PurchaseApiEnvironment.test.ts、PaymentWebhookApiEnvironment.test.ts、WebBusinessApiEnvironment.test.ts |
| 当前行为 | [FACT][E-AU-006-004] config包有8个测试文件，scripts.test只显式列4个；根test:unit只执行workspace scripts.test，因此四个专用测试不会运行 |
| 预期行为 | 正式config包与根unit入口应执行全部受维护的专用测试，或明确把排除文件标为非测试/另有正式入口 |
| 直接证据 | E-AU-006-004、T-AU-006-001/005、RS-AU-006-004 |
| 调用链或运行入口 | npm run test:unit → npm test --workspaces → @shop/config scripts.test → 显式四文件 |
| 用户影响 | Purchase、Webhook、Web、Mall Provisioning配置回归可能在config包显示通过时未被断言捕获 |
| 数据影响 | 无直接数据写入；错误启动配置可能间接阻止对应服务 |
| 安全影响 | 遗漏测试含endpoint/ref/profile边界，但本项不证明运行实现已有安全缺陷 |
| 根因 | test脚本维护手写文件列表，新增测试没有同步进入入口 |
| 建议方向 | 独立测试入口批次采用明确可审计的完整发现方式或补齐列表；不与parser行为修复混批 |
| 预计修改范围 | config package test script及必要的test discovery约束 |
| 验证方式 | 先注入每个遗漏文件的反事实失败确认正式入口会失败，再恢复并执行包测试；本次缺vitest未执行 |
| 回滚方式 | 回退测试入口提交，不影响生产制品 |
| 是否需要独立复核 | 否（P2） |

## F-0032｜共享配置权威对象只浅冻结，运行期可被改写

| 字段 | 记录 |
| --- | --- |
| 模块 | 共享配置 / SFL Node Registry、Runtime Catalog、Kernel、canonical Authz目录、兼容Authz与兼容API契约目录 |
| 类型 | 隐式共享可变状态、配置完整性 |
| 严重级别 | P2 |
| 置信度 | 高：隔离Node进程直接观察并改变resolver、共享deadline、Currency和Authz permission scope结果；固定基线未找到现有生产写调用 |
| 文件和精确位置 | packages/config/src/SflNodeRegistry.ts:60-67,88-120,122-176；SflNodeKernel.ts:817-828,1321-1367；RuntimeCatalog.generated.ts:2-109；build-runtime-config.mjs:13-17；`services/commerce/src/app/events.ts`；`RuntimeEventPublisher.ts`；`packages/kernel/src/Currency.ts:1-13`；`packages/authz/src/PermissionCatalog.ts:4-11,198-205`、`ScopeKind.ts:1-2`；`packages/smart-wing-authz/src/index.ts:1-12,19-32`；`packages/api-contract/src/permissions.ts:3-105`、`platform.ts:1-18` |
| 当前行为 | [FACT][E-AU-006-006][E-AU-008-011][E-AU-009-018][E-AU-010-009][E-AU-011-009][E-AU-012-009] Registry与Runtime Catalog只Object.freeze最外层；嵌套对象/数组未冻结。把domain host改为audit.invalid后resolver立即返回新值；把RUNTIME_LIMITS.http.totalDeadlineMilliseconds从15000改为1也成功。生成的`EVENT_HANDLERS`同样导出可变Map singleton。Kernel的`CURRENCIES`运行数组和实例code可改写。canonical Authz的184个definition外壳虽冻结，但80条默认scoped permission共享同一未冻结数组；给一条追加owner后另一条的授权接受集同时变化，导出的SCOPE_KINDS也可变。兼容Authz还公开可变`HIGH_RISK_PERMISSIONS` Set。兼容API契约的`PERMISSIONS`、86条`PERMISSION_CATALOG`对象、`CLIENT_PLATFORM`与两个平台数组同样可改写；隔离进程实际把`order.refund`改名、risk降为low并向required platforms追加android。当前仓库未发现这些mutation的生产调用 |
| 预期行为 | Manifest/Registry/Topology及共享容量/缓存参数作为进程权威，在解析/生成后应不可被消费者改写，或消费者获得隔离副本 |
| 直接证据 | E-AU-006-006、E-AU-008-011、E-AU-009-018、E-AU-010-009、E-AU-011-009、E-AU-012-009、T-AU-006-004、RS-AU-006-002、INV-AU-006-006、INV-AU-009-010、INV-AU-010-011、INV-AU-011-004、INV-AU-012-004、FM-AU-008-005、FM-AU-009-009 |
| 调用链或运行入口 | JSON/YAML/TS module import → exported singleton → Identity/Console/generator/check或HTTP/Pool/cache/SDK/Authz consumers；events.ts Map → RuntimeEventPublisher → inbox/job；permissionDefinition.scopes → AccessPipeline checkScope；`HIGH_RISK_PERMISSIONS` → `requiresStepUp` → `decide` |
| 用户影响 | 若任一同进程消费者意外修改嵌套对象，后续Host/资源ref、timeout/cache/capacity或permission允许的scope kind会随加载顺序漂移 |
| 数据影响 | 不修改仓库或数据库，但会改变进程内配置事实；重启恢复原JSON |
| 安全影响 | 可改变节点/域名和permission scope选择边界；当前未发现生产写入点，故不升级P1 |
| 根因 | TypeScript readonly被当成运行时保护，Object.freeze只应用外壳；生成器也直接输出浅冻结对象 |
| 建议方向 | 独立配置不可变批次选择深冻结、解析时复制或递归生成冻结；先测性能、JSON module与生成物兼容 |
| 预计修改范围 | SflNodeKernel/Registry、Runtime Catalog生成器及输出、Kernel Currency、Authz目录/ScopeKind、Console/Identity/HTTP/Pool/cache/权限消费者和mutation tests；后续仍须按单一子系统拆批 |
| 验证方式 | Object.isFrozen递归断言；push/assign/sort/splice反事实；resolver与limits前后值不变；正常digest/Host/timeout测试保持 |
| 回滚方式 | 回退不可变实现和对应生成物同一提交；进程重启恢复；不改声明JSON/YAML含义 |
| 是否需要独立复核 | 否（P2）；若发现第三方插件可写同一单例则重新定级 |

[AU-018补强][E-AU-018-006] Miniapp生成的CachePolicy同样只冻结顶层。隔离VM探针把`catalog.maximumSeconds`从300改为1，且`Object.isFrozen(cache.catalog) === false`；当前片段没有CachePolicy运行caller，因此只扩展受影响对象，不升级等级。

## F-0033｜Miniapp 源 parser 与生成 parser 的 trim 语义不同

| 字段 | 记录 |
| --- | --- |
| 模块 | 共享配置 / Miniapp生成链 |
| 类型 | 生成实现漂移、边界输入 |
| 严重级别 | P3 |
| 置信度 | 高 |
| 文件和精确位置 | Environment.ts:25-27；MiniappEnvironment.ts:15-22；build-miniapp-environment.mjs:9；miniprogram/config/Environment.js:22-29 |
| 当前行为 | [FACT][E-AU-006-008] TS实现先requiredValue并trim再regex；生成JS直接对原字符串regex。同一合法值外包空白时TS接受并归一化，生产Miniapp实现拒绝 |
| 预期行为 | 共享schema的源实现、生成实现和测试应对相同输入给出相同结果 |
| 直接证据 | E-AU-006-007/008、INV-AU-006-008 |
| 调用链或运行入口 | Miniapp schema → generator → Environment.js → app.js / wx.getExtConfigSync |
| 用户影响 | ext config工具若保留首尾空白，小程序初始化失败；正常无空白值不受影响 |
| 数据影响 | 无 |
| 安全影响 | 无直接影响 |
| 根因 | 生成器复制regex schema但没有复用requiredValue归一化 |
| 建议方向 | 独立生成器批次先定稿trim或严格拒绝，再让TS/JS共享同一语义并加parity test |
| 预计修改范围 | MiniappEnvironment、生成器、生成物及定向测试 |
| 验证方式 | 三字段分别覆盖空白、空值、尾斜杠、非法协议；TS与生成JS结果逐项一致 |
| 回滚方式 | 回退生成器与生成物同一提交；不得只手改生成JS |
| 是否需要独立复核 | 否（P3） |

[AU-018补强][E-AU-018-003/006] `app.js`直接把`wx.getExtConfigSync()`传给生成parser；null输入会在读取`source.apiBaseUrl`时抛原生TypeError而不是Miniapp契约错误码。正常有效输入可完成App注册；trim parity差异仍在，等级不变。

## F-0034｜Web Business 重复 Origin 拒绝分支不可达

| 字段 | 记录 |
| --- | --- |
| 模块 | 共享配置 / API Origin |
| 类型 | 配置正确性、不可达校验 |
| 严重级别 | P3 |
| 置信度 | 高 |
| 文件和精确位置 | ApiEnvironment.ts:49-53；WebBusinessApiEnvironment.ts:83-85 |
| 当前行为 | [FACT][E-AU-006-008] apiAllowedOrigins先返回Set去重数组；Web parser随后比较Set大小，因此重复来源永远不会触发WEB_BUSINESS_API_ORIGINS_INVALID，而是静默折叠 |
| 预期行为 | 若Web parser声明重复为错误，应在去重前拒绝；若允许去重，应删除虚假分支并统一契约 |
| 直接证据 | E-AU-006-008、RS-AU-006-006 |
| 调用链或运行入口 | webBusinessApiEnvironment → apiAllowedOrigins → Set → duplicate check |
| 用户影响 | 错误env不会阻止启动，运维人员可能误以为重复配置已被门禁发现；实际CORS集合不扩大 |
| 数据影响 | 无 |
| 安全影响 | 无直接越权；重复值被折叠 |
| 根因 | 通用helper承担了归一化，专用parser又试图验证已丢失的信息 |
| 建议方向 | 独立parser一致性批次先定稿拒绝或归一化语义，不与其它配置风险混修 |
| 预计修改范围 | ApiEnvironment helper、WebBusiness parser和重复输入测试 |
| 验证方式 | 单个、重复、空段、不同大小写/端口origin表驱动测试 |
| 回滚方式 | 回退parser提交并恢复原去重语义 |
| 是否需要独立复核 | 否（P3） |

## F-0035｜LocalEnvironment 的 HTTPS endpoint 只校验字符串前缀

| 字段 | 记录 |
| --- | --- |
| 模块 | 共享配置 / Local infrastructure |
| 类型 | 启动配置、失败位置 |
| 严重级别 | P3 |
| 置信度 | 高 |
| 文件和精确位置 | packages/config/src/LocalEnvironment.ts:198-208,222-225；同包其它专用secureEndpoint实现 |
| 当前行为 | [FACT][E-AU-006-008] local secureEndpoint只要求startsWith(https://)并去一个尾斜杠；https://等无法构造URL的值会通过配置阶段，晚至客户端/网络初始化才失败 |
| 预期行为 | endpoint parser应确认可解析HTTPS URL及项目定稿的auth/query/hash边界，并在资源初始化前给稳定配置错误 |
| 直接证据 | E-AU-006-008、FN-AU-006-010、FM-AU-006-007 |
| 调用链或运行入口 | localInfrastructureEnvironment → Local Objects/Secret/KMS clients或readiness |
| 用户影响 | local/full-staging启动以晚期网络错误失败，诊断位置不准确；生产专用parser多使用严格URL校验 |
| 数据影响 | 未发现直接写入；部分资源可能在晚失败前已初始化 |
| 安全影响 | 本项不证明可绕过授权或TLS |
| 根因 | Local parser与专用生产parser使用两套endpoint校验强度 |
| 建议方向 | 独立local配置批次统一URL语义和错误码；不顺手扩展权限约束 |
| 预计修改范围 | LocalEnvironment及localinfra/localobjects定向测试 |
| 验证方式 | https://、userinfo、query/hash、http loopback、合法HTTPS、尾斜杠矩阵；核对失败发生在启动资源前 |
| 回滚方式 | 回退单一parser提交；恢复原env后重启本地进程 |
| 是否需要独立复核 | 否（P3） |

## 7. AU-006 新增未定级事项

- [UNKNOWN][E-AU-006-013] SFL relation history拒绝重叠但允许时间间隙和已结束的最后一段；已定位标准未写明必须连续，因此不把间隙写成缺陷。
- [UNKNOWN] 未读取线上env、console-runtime.json或Manifest；F-0029的当前配置状态、F-0030门禁在CI上的最近实际结果均未验证。
- [UNKNOWN] 四个遗漏测试在依赖完整环境中是否通过未验证；本次只证明正式入口遗漏。

## F-0036｜Storefront member 两条写能力由 member.read 授权

| 字段 | 记录 |
| --- | --- |
| 模块 | 契约定义 / Member / Access Pipeline |
| 类型 | 业务授权、读写权限边界、持久数据修改 |
| 严重级别 | **P1**；RV-0008 已于 2026-09-15 从契约/迁移、route authorization、写 handler 与 Console fixture 重新取证确认 |
| 置信度 | 高：定义、生成绑定、前端调用、授权解算、handler 和数据库写入已连通；线上主体与调用记录未验证 |
| 文件和精确位置 | packages/contract/definitions/operations.yml:678-717；contract/src/StorefrontMemberContract.test.ts:28-53；Commerce OperationController.ts:299-323；AccessPipeline.ts:52-99；PgAccessResolvers.ts:145-154；MemberCustomProfileOperations.ts:25-128；Console StorefrontMemberCommand.ts:9-28、StorefrontMemberRoute.test.tsx:305-316；migration 20260911010000:43-47、20260829060000:149-170 |
| 当前行为 | [FACT][E-AU-007-004][E-AU-010-014] `member.storefront.config.manage` 与 `member.storefront.custom.manage` 均声明 `member.read`。Controller 把该 permission 原样交给 AccessPipeline；数据库 capability 解算按 Operation permission 匹配 membership grants。Console 测试上下文只有 `member.read` 仍拥有两 manage capabilities，真实命令调用 PUT；handler 会 INSERT/DELETE 标签、字段和会员资料；AU-010 重新核对 Authz 内核，未发现任何额外写权限判断 |
| 预期行为 | 修改商城会员配置/资料的 Operation 应绑定经产品确认的写权限，或由产品明确记录 `member.read` 包含这些写行为；不能让名称为 read 的能力在无额外写授权时隐式获得持久修改语义 |
| 直接证据 | E-AU-007-004、E-AU-010-014、COM-AU-007-003/004/009、INV-AU-007-003、FM-AU-007-001、RS-AU-007-001 |
| 调用链或运行入口 | Console StorefrontMemberCustomProfile → StorefrontMemberCommand → generated member SDK → OperationController → AccessPipeline/precheck + capability.session_membership_operations → ModuleOperations → MemberCustomProfileOperations → member/access tables |
| 用户影响 | [INFERENCE] 只读客服或审阅类角色若同时获得该 Operation entitlement，可修改全商城标签/字段配置或单会员自定义资料；页面和测试均把该组合当作正常路径 |
| 数据影响 | `saveConfig` 会 upsert 并删除未提交的 tag/field；`saveProfile` 会先删除再重建会员 tag/field values。事务可回滚单次失败，但成功请求会持久改变数据 |
| 安全影响 | 读权限与写能力边界混淆，构成潜在越权写入；未证明线上当前角色/entitlement 已满足或已有滥用 |
| 根因 | 新功能引入时复用了 `member.read`，同时 capability/Console 测试把这一绑定固化；已有 `member.manage` 未用于这两条 Operation |
| 建议方向 | 先由第二审计者与 Ethan 定稿业务权限；后续从当时最新 zdt-next 建单一修复分支，同步 Operation、数据库发布/迁移、角色、Console可见性和正反权限测试；本审计分支不改 |
| 预计修改范围 | operations 定义、生成物、受管迁移/发布绑定、权限/角色 fixtures、Console 和 Commerce 授权测试；不得顺手收窄其它权限 |
| 验证方式 | 构造仅 `member.read`、仅确认写权限、显式deny、无entitlement、不同scope五组端到端请求；确认数据库前后值、审计记录与失败无部分写 |
| 回滚方式 | 修复批次回退单一权限映射提交及对应受管迁移；保留原角色快照和数据备份，禁止在审计分支直接操作 |
| 是否需要独立复核 | 已完成 RV-0008；未来权限变更仍须独立变更后复核 |

**RV-0008（二次独立复核，2026-09-15）：确认 P1。** 两个 PUT manage operation 在契约和受管 migration 都绑定 `member.read`；授权管线无额外写判定，handler 会持久 upsert/delete，Console fixture 明确将仅 `member.read` 视为正常写 capability 来源。详见 `records/AU-913-rv-0008-storefront-member-write-permission/summary.md`；未读取线上角色或数据。

为什么不是 P0：本次没有读取线上角色、entitlement、请求日志或数据变更，不能证明正在发生事故。

## F-0037｜Error contract 门禁扫描旧根目录并给出虚假覆盖信号

| 字段 | 记录 |
| --- | --- |
| 模块 | 契约生成 / Error catalog / 质量门禁 |
| 类型 | 检查器路径漂移、错误码契约、假阳性 |
| 严重级别 | P2 |
| 置信度 | 高：路径事实与 ErrorMapper 控制流确定；缺口数量是保守词法下界，正式 AST 命令本环境未加载 |
| 文件和精确位置 | scripts/check/errors.mjs:6-53；package.json:80,123；Commerce ErrorMapper.ts:13-26 |
| 当前行为 | [FACT][E-AU-007-006][E-AU-009-016] checker 从仓库根扫描 `apps/extensions/packages/scripts/services/tools`；当前前五个业务根不存在，顶层 scripts 无 JS/TS，因此规则不会访问 `01_core_hexin` 或 `04_tools`。修正到当前六个根后，三种与正式规则对应的精确字面量形态得到 1,678 个唯一值/2,256 次出现，其中 899 个未在 errors.yml，至少 294 个属于 Commerce service；Kernel `Retry.ts:24` 的 fallback `RETRY_FAILED` 是新增确认实例，而目录只有 `RETRY_EXHAUSTED` |
| 预期行为 | 正式 `check:errors` 必须扫描当前生产源码根，并对每个可由 ErrorMapper 暴露的稳定错误码执行目录存在性检查 |
| 直接证据 | E-AU-007-006、E-AU-009-016、T-AU-007-048、INV-AU-007-005、FM-AU-007-002、FM-AU-009-008、RS-AU-007-003 |
| 调用链或运行入口 | quality:canonical-hard-cut → check:errors → source traversal → errors.yml；运行时 Error/DomainError → ErrorMapper → generated errorStatus |
| 用户影响 | 未声明业务错误会被 ErrorMapper 统一变为 `INTERNAL_ERROR`/500，客户端失去可恢复的4xx/409等语义；具体触发频率未验证 |
| 数据影响 | 无直接写入；错误分类错误可能让调用方错误重试或无法执行补偿 |
| 安全影响 | 可能把授权/输入错误隐藏成500，但本项不证明权限绕过或信息泄露 |
| 根因 | 目录前缀整合时只更新 catalog 路径，未更新 scanner roots；门禁也没有“至少扫描一个生产文件”的自校验 |
| 建议方向 | 独立门禁批次先修当前 roots 与非空扫描断言，再按模块确认 missing code/status；不要一次把 899 项机械加入目录 |
| 预计修改范围 | errors checker、checker fixtures；后续每业务模块独立更新 errors.yml/生成物/错误契约测试 |
| 验证方式 | 空root必须失败；当前roots AST扫描；known/missing/template/alias/test-exclusion反事实；ErrorMapper对代表性4xx/409/500映射 |
| 回滚方式 | checker修复可回退单一提交；catalog治理按模块独立提交和回滚 |
| 是否需要独立复核 | 否（P2）；若发现线上关键错误被持续误映射，应重新定级 |


## F-0038｜Named Operation schema 与 OpenAPI、SDK、生产 HTTP 的接受集合不一致

| 字段 | 记录 |
| --- | --- |
| 模块 | Contract schema / OpenAPI / SDK / Commerce Controller |
| 类型 | API契约正确性、生成语义、测试可信度 |
| 严重级别 | P2 |
| 置信度 | 高 |
| 文件和精确位置 | contract/src/schema/index.ts:31-115；contractgen/ClientArtifacts.ts:62-86,156-166,208-247；ContractGenerator.ts:384-472；generated OperationController.ts:299-344；SDK ApiClient.ts:25-44,90-117；operations.yml:678-717 |
| 当前行为 | [FACT][E-AU-007-005] OpenAPI 对 79 个有 requestFields 的非GET Operation 标记 requestBody required；`namedOperationInput` 的 body 对全部 Operation 仍是 optional。690个Operation component没有 required 属性，字段都只是 JsonValue。15个 runtime 写 Operation 的 requestFields 为空，OpenAPI因此只允许空对象，包括实际需要 tags/fields 或 custom_tag_ids 的两条 Member写请求。SDK发送前不parse schema；生产 Controller又按明确历史决策把 contractOperationInput变成no-op |
| 预期行为 | 同一 Operation 的文档、TypeScript调用面、可执行schema、生产HTTP入口和handler应拥有兼容的接受集合；若通用目录只保存弱元数据，应明确命名和测试边界，不宣称“named强类型运行契约” |
| 直接证据 | E-AU-007-005/013、T-AU-007-052、INV-AU-007-004、FM-AU-007-003、RS-AU-007-002 |
| 调用链或运行入口 | operations.yml requestFields → CommerceSchemas/OpenAPI → SDK OperationInputFor/ApiClient → OperationController no-op → 各handler专用解析 |
| 用户影响 | 外部或内部客户端可按OpenAPI/类型构造服务器拒绝的请求，或省略实际必需body；表现为集成失败和错误码不稳定 |
| 数据影响 | handler专用schema通常在写入前拒绝，降低部分写风险；尚未逐345项确认所有handler均如此 |
| 安全影响 | 本项不证明绕过授权；弱通用schema不能被当成请求安全边界 |
| 根因 | 目录从 structural 升名为 named 时只加入字段allowlist/名称，生产运行时校验随后被明确移除；OpenAPI required规则、SDK类型和测试没有同步重定义 |
| 建议方向 | AU-008已完成生成物/SDK/运行壳矩阵；后续按单一业务链决定以专用schema生成真正契约，或诚实降级通用目录语义，不能一次批量猜字段类型 |
| 预计修改范围 | definitions/schema generator、OpenAPI、SDK types/runtime、Controller/handler边界及兼容测试；可能跨多个小批次 |
| 验证方式 | 每批选一条Operation执行同一payload矩阵：TypeScript编译、schema.parse、OpenAPI validator、SDK发送、HTTP入口、handler；接受/拒绝集合必须一致 |
| 回滚方式 | 生成器、定义和全部生成物保持同一提交；保留旧OpenAPI/SDK兼容版本，不在审计分支修改 |
| 是否需要独立复核 | P2不强制；若外部已公开依赖错误schema，升级为兼容专项 |

## F-0039｜Event schema 与 handler routing 不参与 Contract checksum

| 字段 | 记录 |
| --- | --- |
| 模块 | Contract identity / Event generation |
| 类型 | 版本兼容、制品身份、异步路由 |
| 严重级别 | P2 |
| 置信度 | 高：投影与反事实确定；线上是否消费checksum未知 |
| 文件和精确位置 | contractgen/ContractGenerator.ts:61-65,275-327；events.yml；generated ContractIdentity、app/events.ts、database/contracts/current.sql；`04_tools/scripts/release/candidate.mjs:19-52`；generated `events.json` |
| 当前行为 | [FACT][E-AU-007-007][E-AU-008-013] checksum的Event部分和公开`events.json`都只含type/version/module；database event row还含schema，runtime registry还含handlers。内存反事实只改schema与handlers后，checksum输入不变而两个输出均变化；release candidate的`contractHash`又只对OpenAPI与这份稀疏events.json原始字节求哈希，因此也不会因单独修改event schema/handlers而旋转。commit与Commerce OCI hash仍提供其它制品溯源 |
| 预期行为 | 能改变事件载荷契约或消费者路由的定义变化必须旋转可追溯身份，或有独立、同等强度的schema/routing版本与校验 |
| 直接证据 | E-AU-007-007/016、E-AU-008-013、INV-AU-007-006、FM-AU-007-004、FM-AU-008-006、RS-AU-007-004 |
| 调用链或运行入口 | events.yml → checksum/events.json/app events/current.sql → RuntimeEventPublisher/数据库发布；openapi.json + events.json → candidate contractHash → stage/promote/validate |
| 用户影响 | 事件定义或handler路由变更可能在相同contract identity下发布，使回滚、兼容诊断和制品对账失真 |
| 数据影响 | 错误handler或schema兼容会影响projection/notification/reconciliation/referral等派生数据；当前无事件变更或live积压证据 |
| 安全影响 | 无直接权限绕过证据 |
| 根因 | eventArtifact为了公共发布只投影三字段，同时被复用于checksum；完整events定义没有单独身份 |
| 建议方向 | 独立版本批次定义checksum覆盖面或拆分event schema/routing digests；先确认旧runtime checksum已退出权威后的真实消费者 |
| 预计修改范围 | contractgen checksum、ContractIdentity、DB发布/制品元数据、兼容检查和反事实测试 |
| 验证方式 | 分别只改type/version/owner/schema/handlers/top-level version，列出每种应否旋转；DB/runtime/SDK消费者做版本兼容测试 |
| 回滚方式 | 回退identity算法和生成物同一提交；保留旧digest识别的过渡映射 |
| 是否需要独立复核 | 否（P2）；若发现当前发布系统依赖该checksum作强兼容门禁，需升级复核 |

## F-0040｜关键写路径由名称启发式推断且测试无法发现漏选

| 字段 | 记录 |
| --- | --- |
| 模块 | Operation definition / ExecutionKernel |
| 类型 | 事务边界、幂等、执行状态、架构边界 |
| 严重级别 | P2 |
| 置信度 | 高（机制与数量）；具体81项是否应升级为统一执行内核为 UNKNOWN |
| 文件和精确位置 | contractgen/ContractGenerator.ts:42,93-141；operations.yml 全目录；Contract.test.ts:17-32；Commerce ModuleOperations.ts:92-116；ExecutionKernel.ts |
| 当前行为 | [FACT][E-AU-007-008] 0/345 Operation显式声明writePath。generator按GET/id后缀、三个特例和11个domain集合推断：none 233、transactional 108、durable 3、provider 1；271个runtime中有81个非GET为none。测试先筛选 `writePath !== none` 再断言元数据，因此不会因某写Operation漏进集合而失败 |
| 预期行为 | 是否需要business number、执行状态、outbox和统一幂等恢复，应由可审计的业务不变量或显式Operation策略决定，并有全量完整性oracle |
| 直接证据 | E-AU-007-008、INV-AU-007-007、FM-AU-007-005、RS-AU-007-005、operations.csv |
| 调用链或运行入口 | Operation ID/method → operationWritePath → CommerceOperations → ModuleOperations → ExecutionKernel或generic write |
| 用户影响 | 若某业务写被错误归为none，它仍走generic事务/幂等路径，但不会获得统一执行内核的business number、execution checkpoint和operation.completed outbox语义 |
| 数据影响 | 可能造成跨系统恢复/审计语义不一致；本AU没有断言81项均错误，也未发现具体线上半完成记录 |
| 安全影响 | 无直接权限绕过；审计可追溯性可能受影响 |
| 根因 | rollout策略以domain和名称编码在generator，而definition与测试没有独立事实源 |
| 建议方向 | 按业务模块逐条确认，不做全局批量升级；每次只改少量Operation并验证事务、重试、outbox和回滚 |
| 预计修改范围 | 每个确认批次涉及operations定义/generator策略或显式字段、生成物、对应Module action与执行测试 |
| 验证方式 | 对每条候选模拟重复请求、进程中断、事务失败和重放；确认generic或ExecutionKernel哪套不变量符合业务 |
| 回滚方式 | 每模块单一目的提交；回退Operation策略与生成物，不在审计分支开发 |
| 是否需要独立复核 | P2不强制；任何拟升级的高价值写入在实施前应专项复核 |

## F-0041｜capabilities.yml 成为残留且部分漂移的影子目录

| 字段 | 记录 |
| --- | --- |
| 模块 | Contract capability definition |
| 类型 | 重复事实源、文档漂移、生成门禁 |
| 严重级别 | P3 |
| 置信度 | 高 |
| 文件和精确位置 | definitions/capabilities.yml:1-951；ContractGenerator.ts:48-54,232-241,286-296；voucher/Operations.md:19 |
| 当前行为 | [FACT][E-AU-007-009] 190条记录全部kind=operation；`runtime.health.read`没有同ID Operation，5条permission与Operation不同，156个Operation无记录。validator只对成功匹配者比较audience；DB capability/binding实际从Operations生成。文档却称文件已删除 |
| 预期行为 | Capability目录要么是完整权威并验证ID/owner/permission/audience，要么正式退出并移除加载关系；不能作为不会拒绝关键漂移的影子输入 |
| 直接证据 | E-AU-007-009、capabilities.csv、COM-AU-007-010、RS-AU-007-006 |
| 调用链或运行入口 | capabilities.yml → contractgen validateCapabilityAudiences；Operations → database capability rows |
| 用户影响 | 当前运行输出不直接采用其permission，但维护者可能误判目录权威，生成检查也会对缺项/permission漂移给出绿灯 |
| 数据影响 | 无当前直接数据写；数据库发布使用Operations避免了当前五处permission漂移传播 |
| 安全影响 | 影子目录中的permission不是运行授权源；本项不单独造成越权 |
| 根因 | 能力发布收口到Operations后，旧文件、局部validator和文档没有同步完成同一生命周期 |
| 建议方向 | 先定稿保留完整目录还是移除；任何删除必须另分支并验证所有外部消费者，本AU按G0保留 |
| 预计修改范围 | definitions、contractgen validator/tests、文档和可能的生成清单 |
| 验证方式 | 完整性、孤儿、owner/permission/audience漂移反事实；全仓/外部消费者复核 |
| 回滚方式 | 回退单一目录治理提交及生成器变化 |
| 是否需要独立复核 | 否；升级删除候选时必须重新复核 |

## F-0042｜Contract generator 缺少跨文件原子性与模板替换断言

| 字段 | 记录 |
| --- | --- |
| 模块 | contractgen |
| 类型 | 生成可靠性、可维护性、测试缺口 |
| 严重级别 | P3 |
| 置信度 | 高（代码路径）；未执行破坏性故障注入 |
| 文件和精确位置 | ContractGenerator.ts:69-83,252-297,379-472；ClientArtifacts.test.ts:1-47；contractgen/package.json:5-12 |
| 当前行为 | [FACT][E-AU-007-010] write模式依次对几十个tracked目标直接writeFile；后段读取template/写入失败不会恢复前序文件。Controller/Handler“加固”由多次字符串/正则replace完成，未断言每次命中。唯一generator测试只有两个SDK文本性质，不加载主Generator |
| 预期行为 | 一次生成应全成或全不成；模板变更导致替换未命中必须立即失败；测试至少覆盖每个输出族和失败路径 |
| 直接证据 | E-AU-007-010、INV-AU-007-008、FM-AU-007-007 |
| 调用链或运行入口 | npm workspace generate/check → ContractGenerator top-level → emit package/SDK/Commerce/DB targets |
| 用户影响 | 开发者可能在失败后留下混合代际工作树，或生成一个缺少预期加固但仍被同一generator视为current的运行壳 |
| 数据影响 | generator本身不执行数据库；错误current.sql若后续被人工应用才会影响数据，应用链未确认 |
| 安全影响 | 无当前漏洞证据；未命中的授权/输入处理替换可能改变边界，因此必须显式检测 |
| 根因 | generator把已存在源码模板当文本协议，没有结构化模板版本或替换计数；输出无临时目录/commit阶段 |
| 建议方向 | 独立工具批次先加replace命中断言和临时目录全量生成，再atomic promote；不与契约语义变更混批 |
| 预计修改范围 | ContractGenerator、fixtures/tests、生成命令；不要求改业务逻辑 |
| 验证方式 | 每个replace故意改锚点、后段目标只读/缺失、并发双生成、--check无写入；确认工作树零部分变化 |
| 回滚方式 | 回退工具提交；生成物保持上一完整集合 |
| 是否需要独立复核 | 否（P3） |

## F-0043｜DeepLink 畸形百分号逃逸契约错误映射

| 字段 | 记录 |
| --- | --- |
| 模块 | Contract / DeepLink |
| 类型 | 边界值、错误契约 |
| 严重级别 | P3 |
| 置信度 | 高；固定仓库生产消费者未见 |
| 文件和精确位置 | contract/src/DeepLinkContract.ts:6-24；DeepLinkContract.test.ts:5-13 |
| 当前行为 | [FACT][E-AU-007-011] id正则允许任意 `%`；`parseDeepLink('/page/productdetail/index?id=%ZZ')`的字符路径可通过，`miniappDeepLink`随后直接decodeURIComponent并抛原生URIError，而非DEEPLINK_INVALID |
| 预期行为 | 被契约接受的DeepLink应能稳定roundtrip；畸形percent encoding应在边界被拒绝并使用稳定契约错误 |
| 直接证据 | E-AU-007-011、T-AU-007-053、FM-AU-007-008、RS-AU-007-007 |
| 调用链或运行入口 | 外部字符串 → parseDeepLink/DeepLinkSchema → miniappDeepLink → decodeURIComponent/encodeURIComponent |
| 用户影响 | 调用者若按DEEPLINK_INVALID处理错误，会漏掉原生URIError；当前仓库只找到Miniapp生成器引用route常量，未找到生产调用这两个函数 |
| 数据影响 | 无 |
| 安全影响 | 无直接影响 |
| 根因 | 字符allowlist把 `%` 当普通字符，没有校验 `%HH` 分组；测试只覆盖合法 `%3A` |
| 建议方向 | 后续小批次统一百分号规范化与错误码，并同步TS/生成Miniapp实现；不在审计分支修复 |
| 预计修改范围 | DeepLinkContract、测试、build-miniapp-contract及生成物 |
| 验证方式 | `%`、`%2`、`%ZZ`、`%25`、双编码、Unicode、255字符边界roundtrip矩阵 |
| 回滚方式 | 回退DeepLink单一提交和对应生成物 |
| 是否需要独立复核 | 否（P3） |

## 8. AU-007 新增未定级事项

- [STALE][E-AU-007-016] 当前生成 checksum 与旧 Release/runtime migration checksum 不同，但历史已明确移除 database.contract 的 runtime 阻断责任；未读取线上数据库前，不把静态差异写成事故。
- [UNKNOWN][E-AU-007-008] 81个runtime非GET/`writePath=none`中每条业务是否应进入统一执行内核，必须按模块不变量确认；本AU不作批量推断。
- [UNKNOWN] 线上Operation/Event/Error发布状态、current.sql应用者、外部SDK/OpenAPI消费者和实际错误/事件数量均未验证。

## F-0044｜SDK proof 请求被生产 CORS 预检阻断

| 字段 | 记录 |
| --- | --- |
| 模块 | SDK / Console / Commerce HTTP |
| 类型 | API契约、浏览器跨域、测试可信度 |
| 严重级别 | P2 |
| 置信度 | 高（固定基线代码链确定）；线上制品与调用频率未知 |
| 文件和精确位置 | `packages/sdk/src/client/ApiClient.ts:99-117`；`apps/console/src/feature/finance/FinancePolicyCommand.ts:224-236`；`apps/console/src/feature/access/OwnerTransferQuery.ts:75-145,219-233`；`services/commerce/src/foundation/interface/HttpApp.ts:167-173`；`quality/tests/browser/OperationMock.ts:125-133`；`HttpApp.test.ts:168-175` |
| 当前行为 | [CONFLICT][E-AU-008-005/006] SDK把调用者提供的proof发送为`x-action-proof`；Finance policy和Owner transfer真实Console链会提供该值。Console与API由SFL声明为不同origin，但生产preflight的allow-headers没有该头，浏览器因此不会发送真实命令。OperationMock反而允许该头，HttpApp测试只断言access/device头 |
| 预期行为 | 生产CORS、客户端SDK、浏览器mock和HTTP测试应共享同一可审计请求头契约，所有真实浏览器命令应能通过预检后再由服务端身份/授权链裁决 |
| 直接证据 | E-AU-008-005、E-AU-008-006、INV-AU-008-002、FM-AU-008-001 |
| 调用链或运行入口 | Console finance/owner command → generated SDK client → ApiClient → FetchTransport → browser OPTIONS → HttpApp.preflight；当前在真实请求前终止 |
| 用户影响 | 使用这些proof能力的Console操作会表现为浏览器网络/CORS失败；线上实际发生频率未验证 |
| 数据影响 | 预检失败发生在真实请求前，因此该次请求无数据库写入；用户重试也不会到达handler |
| 安全影响 | 本项没有绕过认证或授权；它是合法高风险操作的可用性阻断，不能通过删除proof规避 |
| 根因 | SDK proof header与生产HTTP CORS白名单分别维护，mock和测试又采用不同列表，没有统一契约或真实跨域反事实 |
| 建议方向 | 后续独立修复批次只统一现有header契约与测试，不新增权限或改变proof语义；先确认当前主线是否已另行处理 |
| 预计修改范围 | HttpApp CORS白名单、对应preflight测试与browser mock一致性测试；不应触及业务handler |
| 验证方式 | 真实Console origin的OPTIONS包含`x-action-proof`应非阻断，再验证请求到达既有身份/授权边界；无proof和非法origin反例保持原行为 |
| 回滚方式 | 单一HTTP契约提交回退；本审计分支未实施 |
| 是否需要独立复核 | 否（P2）；若线上确认关键操作普遍不可用，再评估升级 |

## F-0045｜runtimegraph 仍强制已经正式退出的版本契约

| 字段 | 记录 |
| --- | --- |
| 模块 | Quality / Runtime graph / Miniapp |
| 类型 | 门禁漂移、错误质量信号 |
| 严重级别 | P2 |
| 置信度 | 高（历史决策、源码和token复算一致） |
| 文件和精确位置 | `04_tools/scripts/audit/runtimegraph.mjs:16-30`；`packages/sdk/src/client/ApiClient.ts`及测试；`services/commerce/src/foundation/interface/HttpApp.ts`及测试；缺失的`apps/miniapp/miniprogram/api/client.js`；提交`57c1177d42bfe3a36777d9e8bbb29d852cb36d8b` |
| 当前行为 | [STALE][E-AU-008-007/008] 正式`check:runtimegraph`仍要求SDK发送`x-contract-version`、Miniapp client含同名header、HttpApp含`CONTRACT_VERSION_UNSUPPORTED`和426；2026-09-13提交已明确退出这些runtime检查并更新实现/测试，却未更新checker。checker还同步读取不存在的Miniapp文件，会在统一report前抛ENOENT。本环境更早因缺`typescript`退出 |
| 预期行为 | 正式架构门禁应验证当前批准的运行契约，并把缺文件/缺token作为结构化检查结果；不能把已退休行为或不存在的客户端当成功标准 |
| 直接证据 | E-AU-008-007、E-AU-008-008、INV-AU-008-004、FM-AU-008-002 |
| 调用链或运行入口 | `npm run check:runtimegraph` → `audit:architecture` / `quality:canonical-hard-cut` → required file/token读取；当前依赖完整时仍会命中旧期望或ENOENT |
| 用户影响 | 正确实现会被正式质量入口阻断，或团队被迫忽略门禁，从而降低后续架构漂移检测可信度 |
| 数据影响 | 无直接运行数据写入 |
| 安全影响 | 无直接权限影响；旧版本头也不得被当成当前安全边界 |
| 根因 | 退出旧contract-version运行阻断的提交没有同步门禁事实表，且checker缺少缺文件容错和自身反事实fixture |
| 建议方向 | 后续独立门禁批次根据当前产品决定重写required表和缺文件报告；不恢复已退出的runtime阻断，不顺手补造Miniapp工程 |
| 预计修改范围 | runtimegraph checker及其fixture/测试；若Miniapp所有权另有定稿，应由独立产品批次处理 |
| 验证方式 | 对每个当前required事实做存在/缺失反事实；缺文件必须得到稳定报告；正式入口在依赖完整环境执行一次 |
| 回滚方式 | checker单一提交回退；本审计分支未实施 |
| 是否需要独立复核 | 否（P2） |

## F-0046｜WechatTransport 可违反字符串响应契约并留下悬空 Promise

| 字段 | 记录 |
| --- | --- |
| 模块 | SDK / Wechat transport |
| 类型 | 正确性、边界值、异步恢复、测试缺口 |
| 严重级别 | P3 |
| 置信度 | 高（语言级控制流）；微信实际响应形态和仓外消费者未知 |
| 文件和精确位置 | `packages/sdk/src/client/WechatTransport.ts:22-61`；`Transport.ts:9-16`；`ApiClient.ts:69-79,122-124`；`WechatTransport.test.ts` |
| 当前行为 | [FACT][E-AU-008-009] `TransportResponse.body`要求string，Wechat success却直接使用`JSON.stringify(response.data)`：undefined会得到undefined并在ApiClient的`body.length`处失败；BigInt或循环对象会抛错。实现先把`settled=true`并移除abort listener再序列化，抛错后Promise既不resolve也不reject。测试只覆盖abort |
| 预期行为 | 任意native callback都应把Promise恰好settle一次，且成功响应必须规范化为string；序列化失败应形成确定reject并保留取消/超时恢复语义 |
| 直接证据 | E-AU-008-009、INV-AU-008-003、FM-AU-008-003、FM-AU-008-004 |
| 调用链或运行入口 | `createWechatCommerce` → ApiClient → WechatTransport → `wx.request` success callback → stringify → ApiClient.decode；固定仓库没有生产caller |
| 用户影响 | 仓外或未来微信消费者可能把成功响应误报为失败，或一直等待到上游超时 |
| 数据影响 | 若写请求已在服务端成功而客户端误判，用户重试可能重复请求；SDK对非幂等操作限制自动重试，但人工重试影响未知 |
| 安全影响 | 未发现凭据泄露或权限绕过 |
| 根因 | unknown原生数据被直接断言为string契约，并在可能抛错的序列化之前提前进入settled状态 |
| 建议方向 | 后续独立adapter批次先定义undefined/非JSON值的响应规范，再保证序列化异常reject；不在审计分支修改 |
| 预计修改范围 | WechatTransport与其定向测试；必要时补Transport契约说明，不触及生成operation clients |
| 验证方式 | string/object/undefined/BigInt/cycle、success/fail、abort-before/during/after、重复callback矩阵，断言每例恰好settle一次 |
| 回滚方式 | adapter单一提交回退；本审计分支未实施 |
| 是否需要独立复核 | 否（P3）；若确认存在当前生产调用或重复写，再重新定级 |

## 9. AU-008 新增未定级事项

- [UNKNOWN] 线上Console/API是否运行固定基线、proof命令的真实调用频率与F-0044实际用户影响均未验证；本AU未访问线上。
- [UNKNOWN] `@shop/sdk`仓外消费者、外部Miniapp工程/微信发布流水线和人工应用`database/contracts/current.sql`的历史流程均未排除。
- [UNVERIFIED][E-AU-008-008] SDK test/typecheck、Miniapp generated check与runtimegraph均在业务逻辑前因本地依赖缺失阻塞；没有任何一项被写成通过或实现失败。

## F-0047｜CircuitBreaker 的并发完成顺序可撤销 open，classifier 异常可锁死 probe

| 字段 | 记录 |
| --- | --- |
| 模块 | `@shop/kernel` / 外部调用可靠性 |
| 类型 | 并发竞态、状态机、失败恢复 |
| 严重级别 | P2 |
| 置信度 | 高：实际固定基线源码的两个确定性Promise反事实均命中；线上并发和classifier异常频率未知 |
| 文件和精确位置 | `packages/kernel/src/CircuitBreaker.ts:15-50`；`services/commerce/src/foundation/performance/Executor.ts:18-38`；`extensions/vendors/core/src/CircuitPolicy.ts:4-21` |
| 当前行为 | [FACT][E-AU-009-004] threshold=1时两个closed调用并行，A失败后state=open，较早已开始的B随后成功会由`succeed()`无条件重置为closed。另在half-open probe失败后，若`countsAsFailure`自身抛错，`fail/succeed`均不执行，state保持halfopen且probing=true，后续全部run抛`CIRCUIT_OPEN` |
| 预期行为 | 一次调用的完成只能更新它被允许进入时对应的circuit代际；任何operation/classifier结束路径都必须释放probe或进入明确closed/open状态 |
| 直接证据 | E-AU-009-004、INV-AU-009-002/003、STATE-AU-009-001..007、FM-AU-009-001/002 |
| 调用链或运行入口 | Commerce HttpClient/provider adapter → Executor共享CircuitBreaker；VendorClient → CircuitPolicy共享CircuitBreaker → 外部HTTP |
| 用户影响 | [INFERENCE] open被旧成功撤销会继续向故障依赖放行调用；probe锁死会使已恢复依赖仍被当前实例持续拒绝。实际受影响请求量未验证 |
| 数据影响 | 无Kernel直接写；外部写调用被过度放行或持续拒绝，具体半完成数据由各adapter决定 |
| 安全影响 | 未发现直接权限或凭据影响 |
| 根因 | 状态机没有调用代际/token；`succeed`无条件closed，classifier调用不在保证probe恢复的保护区 |
| 建议方向 | 后续独立可靠性批次先定稿代际/half-open状态表，再以最小状态转换修改覆盖两个反事实；不与retry或provider修复混批 |
| 预计修改范围 | CircuitBreaker及定向并发测试；调用者原则上无需改动，需验证Vendor与Executor行为 |
| 验证方式 | closed并发成功/失败全部完成顺序、open恢复、两个probe竞争、operation/classifier同步/异步异常矩阵；每步断言state/probing和调用次数 |
| 回滚方式 | 回退CircuitBreaker单一提交；原实现不涉及数据迁移 |
| 是否需要独立复核 | 否（P2）；若证明线上大面积依赖雪崩或持续拒绝则重新定级 |

## F-0048｜`businesskeywrite` 未绑定业务幂等键，WeChat lost-response 可重发无键 POST

| 字段 | 记录 |
| --- | --- |
| 模块 | Kernel Retry / Commerce HttpClient / Notification WeChat adapter |
| 类型 | 幂等、重试、外部副作用、契约错位 |
| 严重级别 | P2 |
| 置信度 | 高（重试控制流和key丢弃确定）；第一次请求是否在外部生效、微信是否隐式去重未知 |
| 文件和精确位置 | `packages/kernel/src/Retry.ts:4-16,42-47`；`services/commerce/src/foundation/performance/Executor.ts:8-35`；`foundation/http/HttpClient.ts:18-20,54-56`；`modules/notification/04_adapters_shixian/adapter/WechatChannel.ts:27-39`；`06_tests_ceshi/DeliveryChannel.test.ts:18-27` |
| 当前行为 | [FACT][E-AU-009-005/011] Retry只校验mode字符串和次数/延迟；ExecutionContext/HttpCallContext没有idempotency key。HttpClient对businesskeywrite的connection/response/transport失败照常重试。WechatChannel收到`request.idempotency`却既不发送也不绑定到payload，仅以`mode: businesskeywrite`发送subscribe POST |
| 预期行为 | 任何可自动重试的业务写必须把稳定业务键绑定到provider可识别的请求，或在没有该保证时只尝试一次；模式名不能替代可执行幂等契约 |
| 直接证据 | E-AU-009-005、E-AU-009-011、INV-AU-009-004、STATE-AU-009-009、FM-AU-009-003 |
| 调用链或运行入口 | Notification job/dispatcher → WechatChannel.send → HttpClient.send → Executor → retry → `api.weixin.qq.com/.../message/subscribe/send` |
| 用户影响 | [INFERENCE] 第一次消息已被微信接受但响应丢失时，同一用户可能收到重复订阅通知；外部发生率和平台去重未知 |
| 数据影响 | 本地数据库去重不能撤销同一次执行内的第二个外部POST；未证明本地重复行 |
| 安全影响 | 未发现直接权限影响；URL含access token是既有provider协议，本项不复制凭据 |
| 根因 | Kernel重试契约只编码意图标签；Commerce执行上下文没有key字段；Wechat adapter丢弃上游已有dispatch idempotency |
| 建议方向 | 单独定稿“key由Kernel强制”或“每adapter自证”边界；先修一条WeChat链并以lost-response反事实验收，不顺手改其它provider |
| 预计修改范围 | Retry/ExecutionContext/HttpCallContext与Wechat adapter/tests中的最小一致集合；具体由设计选择决定 |
| 验证方式 | 首次fetch记录外部已接收后抛transport error、第二次调用计数；有key/无key、read/write/none、connection/response/HTTP error矩阵 |
| 回滚方式 | 回退独立重试契约提交；不改数据库迁移或线上provider状态 |
| 是否需要独立复核 | 否（P2）；若生产日志证明重复通知规模重大则重新定级 |

## F-0049｜ModuleCatalog 的 capability 协议与现行 manifests 不闭合，且“immutable”索引可分裂

| 字段 | 记录 |
| --- | --- |
| 模块 | `@shop/kernel` ModuleCatalog / Commerce module manifests |
| 类型 | 架构契约、模块边界、共享可变状态 |
| 严重级别 | P3 |
| 置信度 | 高（35份manifest全量复算和实际mutation反事实）；当前生产没有ModuleCatalog构造者 |
| 文件和精确位置 | `packages/kernel/src/module_jiexianban/ModuleCatalog.ts:13-126`；`ModuleManifest.ts:13-34`；35个 `services/commerce/src/modules/*/module.manifest.ts` |
| 当前行为 | [FACT][E-AU-009-006/007] 35 manifests提供51个唯一capability并声明92个requires，其中37个required值无provider，多数使用module ID而不是`*.read/manage` capability。Catalog保留调用者manifest和数组引用；构造后mutation可令`get()`看到新增值而`providersFor()`索引看不到。单manifest重复同一provides还会把自身报成两个歧义provider |
| 预期行为 | manifest依赖和resolver使用同一稳定命名空间；catalog构造后查询/解析来自同一不可变快照，并拒绝重复/畸形声明 |
| 直接证据 | E-AU-009-006、E-AU-009-007、INV-AU-009-006、STATE-AU-009-012、FM-AU-009-004、module-manifest-resolution.csv |
| 调用链或运行入口 | 当前：35 module文件加载 → defineModuleManifest → 各module index；潜在：startup → new ModuleCatalog → resolve。固定仓库只存在后者的4个合成测试，无生产构造者 |
| 用户影响 | 当前未证明运行影响；若未来按注释接入startup，选中相关module会报missing/ambiguous或受调用者mutation影响 |
| 数据影响 | 无当前数据库读写；潜在启动失败发生在业务处理前 |
| 安全影响 | 依赖图可能包含access/identity能力，但当前无运行接线，不能推导权限绕过 |
| 根因 | Manifest `CapabilityId`只是string，35份文件分别以module ID/capability ID维护；readonly类型和注释被当成运行时不可变性 |
| 建议方向 | 先由架构所有者决定manifest是可执行startup契约还是说明性元数据；再单独统一命名空间、验证与snapshot，不得机械改37项 |
| 预计修改范围 | Kernel catalog/manifest、35份manifest及其34个测试，或明确移除未接线执行承诺；需拆小批次 |
| 验证方式 | 真实35份manifest全集resolve、每个selection、duplicate provides、输入/返回mutation、optional/binding/cycle矩阵；同时验证正式startup是否接线 |
| 回滚方式 | 每批按单一module/协议提交回退；当前无数据迁移 |
| 是否需要独立复核 | 否（P3）；ModuleCatalog自身列G1而非删除候选 |

## F-0050｜ValueObject canonical equality 对 Date、非有限数及非 JSON 值不成立

| 字段 | 记录 |
| --- | --- |
| 模块 | `@shop/kernel` 领域值对象 |
| 类型 | 正确性、类型与运行时接受集、序列化 |
| 严重级别 | P3 |
| 置信度 | 高：实际源码反事实命中；当前唯一生产子类PaymentReference只有两个字符串字段 |
| 文件和精确位置 | `packages/kernel/src/ValueObject.ts:1-17`；`services/commerce/src/modules/payment_zhifu/02_domain_yewu/models_moxing/PaymentReference.ts:6-12` |
| 当前行为 | [FACT][E-AU-009-008] canonical对所有object枚举entries：两个不同Date都成为`{}`；`JSON.stringify(NaN)`与Infinity都成为`null`，因此均判相等。BigInt会抛序列化错误，循环对象会递归失败；泛型的nested unknown未排除这些输入 |
| 预期行为 | ValueObject支持的值域必须明确且equals对该值域全定义；业务不同值不能碰撞，不支持的值应在构造时确定拒绝 |
| 直接证据 | E-AU-009-008、INV-AU-009-007、FM-AU-009-005、RS-AU-009-001 |
| 调用链或运行入口 | 当前 PaymentReference → Commerce foundation ValueObject re-export → Kernel constructor/equals；未来公共子类可直接使用根导出 |
| 用户影响 | 当前PaymentReference平面字符串不触发；未来含日期/非有限数的值对象可能错误去重、漏报变化或在比较时抛错 |
| 数据影响 | 无当前写入证据；错误比较可能间接改变未来状态决策 |
| 安全影响 | 无直接证据 |
| 根因 | TypeScript `Record<string, unknown>` 接受集大于自制JSON canonicalizer；算法未定义特殊对象、非有限数、BigInt和cycle |
| 建议方向 | 独立值对象批次先定稿仅JSON值还是可扩展类型，再选择显式字段比较/受限canonical；保持PaymentReference现有行为测试 |
| 预计修改范围 | ValueObject和新边界测试；若收窄类型，需逐个审外部子类 |
| 验证方式 | property顺序、nested array/object、Date、NaN/Infinity、undefined、BigInt、Map/Set、cycle及外部mutation矩阵 |
| 回滚方式 | 回退单一Kernel提交；无数据迁移 |
| 是否需要独立复核 | 否（P3） |

## F-0051｜Deadline 对长时限提前中止，并在同步抛错 callback 上遗留 listener

| 字段 | 记录 |
| --- | --- |
| 模块 | `@shop/kernel/deadline` / 可靠性 |
| 类型 | 时间边界、资源清理、异步正确性 |
| 严重级别 | P3 |
| 置信度 | 高（控制流和平台timer上限明确）；仓内现行deadline均远短于边界 |
| 文件和精确位置 | `packages/kernel/src/deadline/index.ts:3,12-25,30-64` |
| 当前行为 | [FACT][E-AU-009-009] after/at接受任意正safe-integer期限，但构造只设置一次`min(MAX_TIMER, expiresAt-now)` timer；超过2,147,483,647ms时会在约24.85天提前abort而不重新计算。`run()`在注册listener后直接调用operation，再对返回值安装`.finally`；同步throw/非Promise会让executor拒绝但不移除listener |
| 预期行为 | signal不应早于expiresAt中止；operation的同步/异步所有退出路径都应移除listener，dispose应拥有清楚且可测的资源责任 |
| 直接证据 | E-AU-009-009、INV-AU-009-005、STATE-AU-009-010/011、FM-AU-009-006 |
| 调用链或运行入口 | SDK ApiClient、Commerce Executor/jobs、VendorClient → Deadline.at/after → AbortSignal → fetch/wait；仓内未发现超过24.85天期限 |
| 用户影响 | 当前短请求未受长timer问题影响；仓外长任务可能提前取消，同一Deadline频繁同步失败的run可能积累listener |
| 数据影响 | 提前取消可能留下由上层决定的外部半完成操作；Kernel本身不写数据库 |
| 安全影响 | 无直接证据 |
| 根因 | timer上限被当成实际期限而非分段调度；Promise callback调用不先规范为异步链或try/finally |
| 建议方向 | 单独Deadline批次实现分段重算与全退出清理，并先穷举timer/abort竞态；不与Circuit修复混批 |
| 预计修改范围 | Deadline及其直接单元测试；验证SDK/Executor/Vendor调用保持 |
| 验证方式 | fake clock跨MAX、parent abort、dispose前后、同步throw、reject、resolve、abort同tick、多个run/listener计数 |
| 回滚方式 | 回退Deadline单一提交；无迁移 |
| 是否需要独立复核 | 否（P3） |

## F-0052｜TestIdGenerator 第 18 个输出违反 Kernel Id 字母表

| 字段 | 记录 |
| --- | --- |
| 模块 | `@shop/testing` / `@shop/kernel` ID 接缝 |
| 类型 | 测试基础设施正确性、契约漂移 |
| 严重级别 | P3 |
| 置信度 | 高：实际Kernel parser反事实确定；固定仓库没有TestIdGenerator调用者 |
| 文件和精确位置 | `packages/testing/src/TestIdGenerator.ts:3-9`；`packages/kernel/src/Id.ts:1-10` |
| 当前行为 | [FACT][E-AU-009-010] generator使用JavaScript普通base32并转大写；sequence=18得到`...0I`，而Id正则的Crockford字母表排除I/L/O/U，`Id.parse`抛`ID_INVALID` |
| 预期行为 | 测试生成器每个输出都必须满足它实现的`IdGenerator`端口和实际`Id.parse`，至少跨完整字母表周期保持有效且确定 |
| 直接证据 | E-AU-009-010、INV-AU-009-008、FM-AU-009-007 |
| 调用链或运行入口 | 测试fixture → TestIdGenerator.next(prefix) → 普通base32 → Kernel Id.parse；当前只有testing包公开导出，无仓内caller |
| 用户影响 | 不影响当前生产；仓外或未来测试创建第18个ID时会异常中止并可能误判业务实现 |
| 数据影响 | 无生产数据影响 |
| 安全影响 | 无 |
| 根因 | parser与generator各自维护不同字母表，生成器没有复用Kernel编码规则，也没有自有测试 |
| 建议方向 | 独立testing小批次共享同一字母表/编码器并新增周期测试；不在审计分支修复 |
| 预计修改范围 | TestIdGenerator和testing定向测试；Kernel Id parser原则上无需改 |
| 验证方式 | 生成至少1,024个不同prefix/sequence，全部经Id.parse，断言确定性、唯一性、长度和禁字 |
| 回滚方式 | 回退testing单一提交 |
| 是否需要独立复核 | 否（P3） |

## 10. AU-009 新增未定级事项

- [UNKNOWN] `@shop/kernel` 的仓外消费者、超过24.85天的Deadline调用者和ModuleCatalog未来startup意图未取得证据。
- [UNKNOWN] WeChat平台是否对相同subscribe payload做隐式去重，以及生产是否发生lost-response重复发送；本AU未访问供应商或线上日志。
- [UNKNOWN][E-AU-009-017] Kernel test/typecheck的实现结果未知：两者均因本地缺`vitest`/`tsc`在源码加载前阻塞；没有写成通过或实现失败，也未安装依赖。

## F-0053｜自定义角色可铸造并转授角色管理者未拥有的关键权限

| 字段 | 记录 |
| --- | --- |
| 模块 | Authz / Access角色管理 / Console |
| 类型 | 权限提升、角色委派、治理边界 |
| 严重级别 | **P1**；RV-0009 已于 2026-09-15 从权限目录/Console、角色写入、assignment 与 Owner-only 迁移重新取证确认 |
| 置信度 | 高：UI可选集、HTTP permission、服务端写入、assignment和membership投影控制流已连通；线上是否存在受限role manager或已利用记录未知 |
| 文件和精确位置 | `packages/authz/src/PermissionCatalog.ts:20-29`；`contract/definitions/operations.yml:418-433`；Console `AccessRoleCatalog.ts:18-26`、`RoleEditor.tsx:61-88,216-243`、`AccessRoleCommand.ts:29-36`；Commerce `AccessOperations.ts:22-64,185-305`；migration `20260829060000_zhudatuan_operator_invitation_registration.sql:85-145`、`20260902140000_align_senior_administrator_business_permissions.sql:109-130` |
| 当前行为 | [FACT][E-AU-010-004/006] 任何拥有`access.role.manage`与对应Operation capability的Console主体都看到全部184个permission。服务端仅要求`permissions`为字符串数组，随后把所有存在的code写入custom role，不比较actor effective permissions，也不排除内建高级管理员明确列为Owner-only的`access.role.manage`、`access.scope.manage`、`capability.assignment.manage`、`identity.registration.reset`等。角色分配只按固定`role-senior-administrator-v1:` ID要求Owner；相同关键权限装入custom role不会触发该分支，数据库随后把它们投影到目标Membership grants |
| 预期行为 | 非Owner角色管理者可转授的permission集合必须由产品明确闭合，至少不能超过其有效权限/治理级别，也不能仅通过换一个custom role ID绕过现有Owner-only集合 |
| 直接证据 | E-AU-010-004、E-AU-010-005、E-AU-010-006、E-AU-011-007、COM-AU-010-010/011/012、INV-AU-010-009、INV-AU-011-008、FM-AU-010-001 |
| 调用链或运行入口 | Console RoleEditor → AccessRoleCommand → PUT `access.roles.manage` → AccessPipeline(`access.role.manage`) → AccessOperations重建rolepermission → `manageRoleAssignment` → membershiprole/scopegrant/access_version → `access.resolve_session_membership` → 后续Operation授权 |
| 用户影响 | [INFERENCE] 被委派一个有限“角色管理员”的主体可以创建包含更高治理能力的custom role并转授给自己或同范围成员，从而获得原委派未表达的权限；具体可操作对象仍受scope、target和step-up约束 |
| 数据影响 | 成功请求持久写`access.role`、`rolepermission`、`membershiprole`、`scopegrant`并递增目标access_version；可改变后续请求的授权结果 |
| 安全影响 | 存在正常API可达的权限提升链；不依赖异常Scope。是否已有可利用主体取决于线上角色与entitlement，尚未核验 |
| 根因 | 权限目录只有risk/scope元数据，没有“可由谁授予”的委派关系；Access handler把role ID特例当作治理边界，没有对custom role内容执行actor subset/Owner-only校验。兼容`public.*`角色函数已实现actor permission subset与Scope ceiling，证明仓内存在可执行对照模式，但两套目录和数据库模型不等价，不能直接复制SQL |
| 建议方向 | 先由RV-0009与Ethan定稿可授予集合/治理层级；把兼容链的subset/ceiling作为设计证据而非直接迁移方案。后续从当时最新`zdt-next`建立单一修复分支，只收敛角色委派判定及正反测试，不在审计分支新增安全规则 |
| 预计修改范围 | Access角色命令、permission委派元数据或现有治理resolver、Console可选集、数据库角色/版本处理、定向HTTP/DB测试；具体范围待产品定稿 |
| 验证方式 | Owner、受限role manager、普通管理员三主体 × 自有permission、非自有普通permission、Owner-only permission × create/assign/self/other/跨scope；逐项核对HTTP、role rows、access_version和下一请求实际授权 |
| 回滚方式 | 修复批次回退单一提交；对已创建的越界custom role另做受管数据清单和可逆迁移，先保存role/assignment/version快照 |
| 是否需要独立复核 | 已完成代码与契约重追；未来修复和线上数据处置仍须独立变更后复核 |

**RV-0009（二次独立复核，2026-09-15）：确认 P1。** Console 向角色编辑者暴露完整权限目录，服务端将任意 active permission code 写入 custom role；只有固定 senior role ID 受 Owner 限制，custom role 内容不受同等 ceiling。详见 `records/AU-914-rv-0009-custom-role-delegation-ceiling/summary.md`；线上角色数据和调用记录仍未读取。

为什么不是 P0：固定基线证明可执行权限提升机制，但本次没有读取线上角色、assignment、调用日志或异常授权记录，不能证明正在发生严重事故。`P0`必须有当前事故证据，不能沿用历史文档标签。

## F-0054｜角色分配的二级 Scope 权限检查跳过显式 deny

| 字段 | 记录 |
| --- | --- |
| 模块 | Authz Policy / Access角色分配 |
| 类型 | 显式拒绝绕过、分阶段API误用 |
| 严重级别 | P2 |
| 置信度 | 高：真实调用位置和实际Policy反事实均确定；线上是否存在allow+deny组合未知 |
| 文件和精确位置 | `packages/authz/src/Policy.ts:30-43`；Commerce `AccessPipeline.ts:64-87`；`AccessOperations.ts:76-107,185-249`；`AccessOperations.test.ts:414-421` |
| 当前行为 | [FACT][E-AU-010-008] `access.roles.manage`入口完整预检的是`access.role.manage`。角色assign/revoke随后直接调用`checkScope(membership,'access.scope.manage',targetScope,...)`；该stage只查allow grant、有效期和containment，不查`membership.denies`。确定性输入中`access.scope.manage`同时allow+explicit deny，route precheck返回null，二级checkScope仍返回evidence |
| 预期行为 | 业务代码若额外要求第二个permission，必须对这个permission执行包含active/version/explicit deny/allow的完整前置，再检查scope；显式deny不能因调用stage子集而失效 |
| 直接证据 | E-AU-010-008、COM-AU-010-011、INV-AU-010-002、FM-AU-010-002、PROBE-AU-010-008 |
| 调用链或运行入口 | `access.roles.manage` HTTP → AccessPipeline完整检查role.manage → AccessOperations `manageRoleAssignment` → 裸checkScope(scope.manage) → membershiprole/scopegrant写入 |
| 用户影响 | [INFERENCE] 同时拥有scope.manage allow、但被显式deny该权限的角色管理员仍可在角色分配路径使用这项二级权限；直接`access.scopes.manage`仍由顶层precheck正确拒绝 |
| 数据影响 | 可assign/revoke角色、增加scopegrant并递增目标Membership版本；条件限定在冲突allow+deny投影 |
| 安全影响 | 显式deny语义在一个高权限写入口失效；未证明线上存在对应组合或滥用 |
| 根因 | `checkScope`是有隐藏前置条件的stage API；生产caller把它当完整permission决策使用，测试fixture又直接注入AccessContext而绕过顶层组合 |
| 建议方向 | 独立Access授权修复批次复用完整判定或显式执行同permission precheck；不得与F-0053治理模型定稿混成一次大改 |
| 预计修改范围 | AccessOperations二级授权调用与定向角色assignment测试；可能无需改Authz API，需由修复设计确认 |
| 验证方式 | scope.manage allow、deny、allow+deny、过期allow、错误version、不同scope六组；每组断言数据库零/有写和decision evidence |
| 回滚方式 | 回退二级授权单一提交；无迁移时不涉及数据结构回滚 |
| 是否需要独立复核 | 否；若线上确认已有越权写再重新定级 |

## F-0055｜Scope containment 对异常 platform、缺 tenant 和跨 kind 同 ID 失效关闭不足

| 字段 | 记录 |
| --- | --- |
| 模块 | Authz Scope / PostgreSQL Scope投影 |
| 类型 | 租户隔离、范围判定、边界输入 |
| 严重级别 | P2 |
| 置信度 | 高：三个纯Policy反事实命中；当前正常Pg路径通常生成canonical Scope，异常数据可达性未在线核验 |
| 文件和精确位置 | `packages/authz/src/Scope.ts:3-15`、`Policy.ts:38-65`、`Policy.test.ts:14-46`；`packages/telemetry/src/ClientErrors.ts:81-98`；Commerce `PgAccessResolvers.ts:133-141`、`WebBusinessScopeResolver.ts:19-45`；`database/contracts/current.sql:1141-1165` |
| 当前行为 | [FACT][E-AU-010-010][E-AU-013-008] Authz与ClientErrorBuffer各保存一套近似`contains`：对任何`grant.kind==='platform'`立即true；非self/owner grant只有自身tenant存在时才比较tenant；exact ID分支不比较grant/resource kind。两套反事实都分别接受错误platform ID、缺tenant的跨租户ancestor，以及跨kind同ID；显式其他tenant拒绝 |
| 预期行为 | Scope边界接收到不完整或不规范投影时应拒绝；非平台层级两侧tenant必须完整相等，exact命中必须绑定kind+id，platform必须来自canonical root/ancestor |
| 直接证据 | E-AU-010-007、E-AU-010-010、E-AU-013-008、INV-AU-010-005/006/007、INV-AU-013-004、FM-AU-010-003、FM-AU-013-004、PROBE-AU-010-003..005、PROBE-AU-013-004 |
| 调用链或运行入口 | access tables/organization closure → Pg/Web ScopeResolver → AccessPipeline → checkScope/contains；或client-error read → server-derived access.scope → ClientErrorBuffer.list/contains。后一Operation当前缺正式发布入口，是缓解项而非正确性证明 |
| 用户影响 | [INFERENCE] 若数据库closure、scope function、新resolver或仓外caller产生异常Scope，可能把授权扩大到错误kind或tenant；正常canonical组织树路径降低风险，不等于内核已fail closed |
| 数据影响 | Authz本身不写数据；错误allow后的handler可读写何种数据取决于Operation |
| 安全影响 | 潜在跨租户/跨范围授权；没有证据证明固定线上数据当前异常，故不升级P1/P0 |
| 根因 | `Scope`把tenant对全部kind声明为可选，Policy假定上游已经canonical；同一规则又在Telemetry包复制而没有共享闭表。Pg JSON结果没有完整runtime schema验证，测试只覆盖tenant双方存在的负例 |
| 建议方向 | 独立Scope语义批次先定稿11-kind闭表和canonical platform规则，再决定在resolver边界验证、Policy内拒绝或二者组合；不得直接新增规则而跳过产品确认 |
| 预计修改范围 | Scope类型/decoder、Policy containment、Pg/Web resolver、11-kind负向测试，可能涉及数据异常核验；不一定需要迁移 |
| 验证方式 | 11 kind × tenant missing/equal/different × exact/path/wrong-kind/wrong-platform性质矩阵；再用真实DB fixture证明canonical输出仍通过 |
| 回滚方式 | 回退Scope/Policy单一提交；若清理异常数据则另备份并使用受管迁移 |
| 是否需要独立复核 | 否；安全专项建议复核，若线上异常数据命中则重新定级 |

## F-0056｜WebBusiness Scope 正式单测仍调用已退出的四参数契约

| 字段 | 记录 |
| --- | --- |
| 模块 | Commerce Security tests / WebBusinessScopeResolver |
| 类型 | 测试漂移、假性回归阻塞 |
| 严重级别 | P2 |
| 置信度 | 高：vitest配置包含该文件，固定源码直接调用在数据库前确定失败 |
| 文件和精确位置 | `services/commerce/vitest.config.ts:28-29`；`modules/webbusiness/WebBusinessScopeResolver.test.ts:7-15,50-59`；`foundation/security/AccessContext.ts:103-111`；`PgAccessResolvers.ts:133-141` |
| 当前行为 | [FACT][E-AU-010-011] 2026-09-12后canonical resolver要求realm/client/governanceOrganization并调用`access.resolve_session_scope`七参数函数；测试第三例仍期待`access.resolve_scope`和四个参数，actor也没有三个context字段。实际调用抛`AUTH_MEMBERSHIP_CONTEXT_MISSING`，pool query为0 |
| 预期行为 | 正式unit test应使用当前session-bound actor并断言七参数函数，且生产退回旧未绑定resolver时必须失败 |
| 直接证据 | E-AU-010-011、INV-AU-010-012、FM-AU-010-004 |
| 调用链或运行入口 | `npm test --workspace @shop/commerce` → vitest config `src/**/*.test.ts` → WebBusinessScopeResolver第三例 → PgScopeResolver |
| 用户影响 | 不直接改变生产；依赖完整时正式unit suite会被旧fixture阻断，降低权限回归信号可信度 |
| 数据影响 | 测试mock不写真实数据库 |
| 安全影响 | session-bound权限读取边界缺少可信回归，后续退化可能更难被发现 |
| 根因 | resolver接口迁移更新了生产代码和部分测试，没有同步该共享console路径fixture/oracle |
| 建议方向 | 独立测试修复批次只更新actor context、SQL和参数断言，并增加退回旧resolver的反事实；不改生产实现 |
| 预计修改范围 | 单一测试文件，必要时共享fixture |
| 验证方式 | 定向运行该文件，再运行Commerce unit；断言七参数、context mismatch和旧函数名反事实 |
| 回滚方式 | 回退测试单一提交 |
| 是否需要独立复核 | 否 |

## F-0057｜Access Version 的 PostgreSQL bigint 运行值与 number 类型声明不一致

| 字段 | 记录 |
| --- | --- |
| 模块 | Commerce PostgreSQL Access resolvers / Authz types |
| 类型 | 运行时类型、测试真实性、API契约 |
| 严重级别 | P3 |
| 置信度 | 高：锁定pg版本、默认OID parser和源码均直接核对；线上是否另有仓外parser配置未知 |
| 文件和精确位置 | `packages/authz/src/Policy.ts:5-18`；Commerce `PgAccessResolvers.ts:17-45,49-129`、`Pool.ts:1-21`、`AccessPipeline.ts:64-72`；migration `20260912240000_bind_permission_reads_to_session_membership.sql:26-31,110-129`；Console `ConsoleSession.ts:20-25` |
| 当前行为 | [FACT][E-AU-010-012] SQL函数把credential/access version声明为bigint；pg 8.16.3默认OID 20 parser把`7`返回string，仓内没有`types.setTypeParser`。Resolver row、Actor、MembershipAccess和AccessContext都声明number且直接返回row值；测试fixtures全部给number。三个数据库来源在正常路径同为string，严格相等当前可通过；Console边界另用DatabaseIntegerSchema归一化 |
| 预期行为 | 数据库adapter必须把bigint显式、安全地归一化为number，或从端口到wire如实建模string；测试应使用真实driver类型，不能依赖静态泛型改变运行值 |
| 直接证据 | E-AU-010-007、E-AU-010-012、INV-AU-010-010、FM-AU-010-005 |
| 调用链或运行入口 | identity/access bigint → pg parser → PgSession/Membership/VersionResolver → AccessPipeline strict equality → AccessContext → session响应/执行上下文 |
| 用户影响 | 当前同型比较通常不阻断请求；未来任一consumer做`Number.isSafeInteger`、算术或严格response schema时可能错误拒绝或发出string |
| 数据影响 | 当前未证明产生错误写；version写入SQL参数接受string数字 |
| 安全影响 | 可能削弱版本边界的类型保证，但未发现当前比较绕过 |
| 根因 | TypeScript query泛型被误当运行时解码；adapter没有集中bigint转换，mock又复制声明而非驱动事实 |
| 建议方向 | 独立DB adapter批次选择safe integer转换或端到端string模型，先确认版本上限与wire兼容；不在审计分支修改 |
| 预计修改范围 | PgAccessResolvers、AccessContext/Authz类型或decoder、真实pg fixture、Session response兼容测试 |
| 验证方式 | pg17 fixture返回1、MAX_SAFE_INTEGER、越界bigint、null；逐项断言三resolver、strict equality和HTTP schema |
| 回滚方式 | 回退adapter/type单一提交；无数据迁移 |
| 是否需要独立复核 | 否 |

## F-0058｜contractgen 绕过 `@shop/authz` export 直接导入 workspace 源文件

| 字段 | 记录 |
| --- | --- |
| 模块 | contractgen / Authz package boundary |
| 类型 | 模块边界、构建耦合 |
| 严重级别 | P3 |
| 置信度 | 高 |
| 文件和精确位置 | `tools/contractgen/package.json:13-21`；`ContractGenerator.ts:1-6,52-65,223-229,280-298`；`packages/authz/package.json:9-13` |
| 当前行为 | [FACT][E-AU-010-003] contractgen明确声明`@shop/authz:1.0.0`依赖，却从四层相对路径直接import`packages/authz/src/PermissionCatalog`；permission验证、checksum、OpenAPI和数据库产物全部依赖该内部路径 |
| 预期行为 | workspace消费者通过声明的package export加载公共目录，避免目录移动、编译边界或package实现重排无意破坏generator |
| 直接证据 | E-AU-010-003、COM-AU-010-001/002、FM-AU-010-006 |
| 调用链或运行入口 | `@shop/contractgen` generate/check → 相对源码import → PermissionCatalog → Contract/OpenAPI/DB产物 |
| 用户影响 | Authz目录重排或独立打包时contractgen在生成前失败；不直接影响已运行服务 |
| 数据影响 | 失败会阻断未来数据库contract产物生成，但本项不证明现有产物错误 |
| 安全影响 | 无直接权限绕过；边界绕行增加权限目录变更漏测风险 |
| 根因 | 包整合后保留历史相对源码路径，manifest依赖没有成为真实解析入口 |
| 建议方向 | 独立工具边界批次改用正式export并加包边界测试；与permission语义修改分开 |
| 预计修改范围 | ContractGenerator import和工具测试；无需改目录内容 |
| 验证方式 | contractgen check/generate定向运行；从临时package布局加载公共export并验证产物零漂移 |
| 回滚方式 | 回退单一import/test提交 |
| 是否需要独立复核 | 否 |

## F-0059｜Console 两份权限分类映射同时遗漏 `approval`

| 字段 | 记录 |
| --- | --- |
| 模块 | Authz PermissionCatalog / Console权限界面 |
| 类型 | 用户可见文案、重复事实源漂移 |
| 严重级别 | P3 |
| 置信度 | 高 |
| 文件和精确位置 | `packages/authz/src/PermissionCatalog.ts:30-32`；Console `AccessRoleCatalog.ts:3-23`、`ProfileModel.ts:36-69,91-98`；`ScopePresentation.ts:35-40` |
| 当前行为 | [FACT][E-AU-010-017] 目录有33类和3条approval permission；角色编辑与Profile各维护一份中文label map，两份都没有approval。一个fallback直接返回category，另一个normalizeConsoleCopy也不翻译approval，最终显示英文分组名 |
| 预期行为 | 所有目录category在中文Console有穷尽、单一的显示映射；新增分类缺label时测试应失败 |
| 直接证据 | E-AU-010-017、COM-AU-010-010、FM-AU-010-007 |
| 调用链或运行入口 | PermissionCatalog → PERMISSION_GROUPS/Profile permissionGroups → RoleEditor/Profile UI |
| 用户影响 | 权限管理界面中的审批分类显示英文且两个页面可能继续独立漂移 |
| 数据影响 | 无 |
| 安全影响 | 不改变服务端授权；可能降低权限含义可读性 |
| 根因 | category显示名在两个consumer手工复制，未对PermissionCatalog做穷尽校验 |
| 建议方向 | 独立Console小批次统一映射并加33类集合测试；不修改permission code |
| 预计修改范围 | Console共享展示映射和定向测试 |
| 验证方式 | 目录category与label key集合严格相等；打开角色/Profile权限分组检查中文文案 |
| 回滚方式 | 回退Console文案/测试提交 |
| 是否需要独立复核 | 否 |

## 11. AU-010 新增未定级事项

- [UNKNOWN] 七个非GET但绑定`.read` permission的Operation中，除F-0036两条外，其余五条是否符合产品语义；不能仅按名称登记缺陷。
- [UNKNOWN] 正常数据库是否存在缺tenant、错误closure、scope ID冲突或非canonical resolver输出；本AU没有连接线上数据库。
- [UNKNOWN] `@shop/authz`完整`decide` façade和类型的仓外消费者；已列DC-0012/G1，不得直接删除。
- [UNKNOWN][E-AU-010-016] Authz正式test/typecheck结果；两者因依赖缺失在源码加载前退出127，未安装依赖。

## F-0060｜Smart Wing 兼容共享包缺少独立质量入口，测试寄生 Storefront 且独立类型检查被跳过

| 字段 | 记录 |
| --- | --- |
| 模块 | `@smart-wing/authz`、`@smart-wing/api-contract` / 测试拓扑 |
| 类型 | 测试入口缺失、质量信号失真 |
| 严重级别 | P3 |
| 置信度 | 高 |
| 文件和精确位置 | `packages/smart-wing-authz/package.json:1-13`、`src/index.test.ts:1-159`、`tsconfig.json:1-12`；`packages/api-contract/package.json:1-11`、`src/permissions.test.ts:1-19`、`src/platform.test.ts:1-12`、`tsconfig.json:1-12`；`apps/storefront-web/package.json:9-15`；`apps/storefront-web/vitest.config.ts:3-13`；根`package.json:45,50` |
| 当前行为 | [FACT][E-AU-011-002/013/015][E-AU-012-002/010] 两个包共保存190行、17个直接用例和各自独立tsconfig，但都没有scripts；显式workspace test/typecheck均返回Missing script。根`test:unit`仍会调用Storefront的`vitest run`，其include显式收录两个包的测试文件；根`typecheck`使用workspaces `--if-present`，不会执行两个包的独立tsconfig，根project references也没有被该命令以`tsc -b`执行 |
| 预期行为 | 人工维护的兼容权限内核应有可独立审计的质量入口，或正式声明其间接测试归属；本包独立tsconfig应由正式命令执行，退役时则应明确排除并保留替代验证 |
| 直接证据 | E-AU-011-002、E-AU-011-012、E-AU-011-013、E-AU-011-015、E-AU-012-002、E-AU-012-010、TC-AU-011-014/015/016、TC-AU-012-005/006/007 |
| 调用链或运行入口 | 根`test:unit` → workspace Storefront `test` → Storefront Vitest include → 两包17个用例；根`typecheck` → workspace `typecheck --if-present` → 两包无script → 两份独立tsconfig未检查 |
| 用户影响 | 17个用例当前依赖Storefront测试配置才能被根命令发现；若该配置被移除、拆包或改名，两包没有自有入口暴露丢测。两份独立tsconfig的类型约束当前不在根typecheck信号中；兼容protected runtime未正式发布，但api-contract仍有23个非测试引用文件，影响面更广 |
| 数据影响 | 不直接写数据；漏测的授权错误若经手工兼容build使用可影响访问决定 |
| 安全影响 | 权限内核缺少正式回归信号，但本项不证明当前权限绕过 |
| 根因 | 包保留源码、测试和tsconfig，却把测试执行隐式寄托于另一个应用的Vitest include，同时未把独立类型检查或生命周期状态落实为可执行入口 |
| 建议方向 | 后续独立质量批次在“建立本包自有入口并保留Storefront聚合”与“明确退役并迁移唯一契约”之间定稿；不在审计分支修改 |
| 预计修改范围 | 两个package脚本/根测试拓扑，或分别完成退役文档与契约承接；不可把两个包的生命周期决定混成一次大改 |
| 验证方式 | 分别证明根测试与两个包测试报告17用例、两份独立tsconfig被正式typecheck执行；或逐包正式退役并证明契约已有承接 |
| 回滚方式 | 回退单一测试拓扑/退役提交 |
| 是否需要独立复核 | 否 |

## F-0061｜公开 step-up 最大时限接受非有限值

| 字段 | 记录 |
| --- | --- |
| 模块 | `@smart-wing/authz` / step-up |
| 类型 | 边界值、可配置窗口语义 |
| 严重级别 | P3 |
| 置信度 | 高：源码反事实确定；当前两个源码caller均未传该选项 |
| 文件和精确位置 | `packages/smart-wing-authz/src/index.ts:19-20,29-30,41-48` |
| 当前行为 | [FACT][E-AU-011-010] `stepUpMaxAgeSeconds`未限制为有限非负值；传`Infinity`时2000年的step-up在2026年仍被接受。当前caller使用默认900秒，未发现生产参数化入口 |
| 预期行为 | 安全时限若公开可配置，应只接受定义域内的有限值；非法值应稳定拒绝或采用已声明默认值 |
| 直接证据 | E-AU-011-010、PROBE-AU-011-010、INV-AU-011-004 |
| 调用链或运行入口 | 兼容caller → `decide(options.stepUpMaxAgeSeconds)` → `hasFreshStepUp` → critical allow/challenge |
| 用户影响 | 只有新增或仓外caller传异常窗口时才会延长身份复核有效期；当前仓内caller未触发 |
| 数据影响 | 无直接写入 |
| 安全影响 | 可弱化critical action的recent verification，但当前正式protected runtime未加载且无仓内异常caller |
| 根因 | 公开数字选项直接进入乘法比较，没有明确输入契约 |
| 建议方向 | 若兼容链继续存活，独立小批次先定义非法值语义并补边界测试；若退役则由退役证明承接 |
| 预计修改范围 | 单一纯函数与直接测试 |
| 验证方式 | NaN、Infinity、负数、0、900秒整、未来时间和默认值矩阵 |
| 回滚方式 | 回退单一实现/测试提交 |
| 是否需要独立复核 | 否 |

## F-0062｜Critical 权限在 Scope 不匹配前发起 step-up 挑战

| 字段 | 记录 |
| --- | --- |
| 模块 | `@smart-wing/authz` / Scope与step-up顺序 |
| 类型 | 错误状态顺序、无效挑战 |
| 严重级别 | P3 |
| 置信度 | 高 |
| 文件和精确位置 | `packages/smart-wing-authz/src/index.ts:24-32` |
| 当前行为 | [FACT][E-AU-011-011] binding先计算但其不存在的拒绝位于step-up之后；错误mall scope的critical请求无step-up返回`STEP_UP_REQUIRED`，完成step-up后才返回`SCOPE_MISMATCH` |
| 预期行为 | 已确定不具资源Scope的请求不应先要求用户执行无效的身份复核；错误原因顺序应稳定反映最早不可恢复条件 |
| 直接证据 | E-AU-011-011、PROBE-AU-011-011、INV-AU-011-006 |
| 调用链或运行入口 | Commerce compat route → server-derived ResourceScope → `decide` → critical challenge → 重试 → Scope拒绝 |
| 用户影响 | 用户被要求完成一次无法改变最终结果的额外验证，之后仍失败；当前compat protected runtime未正式发布 |
| 数据影响 | 无 |
| 安全影响 | 没有扩大权限；主要是挑战语义与用户体验失真 |
| 根因 | step-up分支放在`!binding`拒绝之前 |
| 建议方向 | 若兼容链保留，独立行为批次由产品确认拒绝优先级并补组合测试 |
| 预计修改范围 | 判定分支顺序与直接测试 |
| 验证方式 | valid/invalid Scope × critical/noncritical × fresh/missing step-up全矩阵 |
| 回滚方式 | 回退单一顺序/测试提交 |
| 是否需要独立复核 | 否 |

## F-0063｜多端交付矩阵与正式闸门脱节，并引用不存在的小程序实现

| 字段 | 记录 |
| --- | --- |
| 模块 | `@smart-wing/api-contract` / 多端发布证据 |
| 类型 | 发布事实漂移、证据闸门失效 |
| 严重级别 | P2 |
| 置信度 | 高：固定基线文件存在性、全仓消费者和正式脚本控制流均已复核 |
| 文件和精确位置 | `packages/api-contract/src/delivery-matrix.json:1-67`；根`package.json:108`；`04_tools/scripts/check-platform-delivery.mjs:1-24`；实际`apps/miniapp/miniprogram/` |
| 当前行为 | [FACT][E-AU-012-005/006/007] 矩阵把public-catalog、server-cart和order-create标为`releaseReady:true`，并把微信小程序列为implemented；四条微信侧证据都指向不存在的`apps/wechat-miniapp/miniprogram/utils/*`。固定仓库唯一小程序目录是`apps/miniapp/miniprogram`，没有这些API模块。全仓没有代码读取该矩阵，正式`check:delivery`只验证`requirements/mvp.yml`与`infrastructure/aliyun/delivery.yml`，不读取矩阵 |
| 预期行为 | 任何被称为机器可读交付事实的矩阵都应由正式闸门消费，且每条implemented/releaseReady证据必须解析到固定基线中的真实入口；否则应明确降级为历史资料 |
| 直接证据 | E-AU-012-005、E-AU-012-006、E-AU-012-007、FM-AU-012-001、INV-AU-012-002 |
| 调用链或运行入口 | 当前实际为两条平行链：`delivery-matrix.json` → 无代码消费者；`npm run check:delivery` → `check-platform-delivery.mjs` → `mvp.yml + aliyun/delivery.yml` |
| 用户影响 | 读取该矩阵的开发者或评审可能误判三项能力已有Web/微信双端实现并可发布；正式质量命令不会发现这些断链证据 |
| 数据影响 | 不直接写数据库；可能使发布或验收决策建立在错误完成度上 |
| 安全影响 | 无直接权限或凭据影响 |
| 根因 | 旧微信目录/能力说明被保留在数据文件中，正式交付闸门后来转向另一套需求和制品清单，二者没有共同来源或漂移检查 |
| 建议方向 | 单独的交付事实批次先由产品确认矩阵是否仍为权威；若保留，令闸门逐条解析真实入口和状态；若退役，先迁移唯一的能力状态后再归档。不得把“修路径”与实现缺失能力混为一批 |
| 预计修改范围 | delivery matrix、正式delivery checker、必要的状态来源/测试；不必然修改小程序业务代码 |
| 验证方式 | 对每条evidence做路径+符号解析；反事实删除/改名时正式闸门必须失败；releaseReady只能在required platforms均有可达实现后成立 |
| 回滚方式 | 回退矩阵/闸门单一提交；保留变更前状态快照，不触碰线上制品 |
| 是否需要独立复核 | 否（P2）；若该矩阵被外部发布系统消费则重新评估影响 |

## F-0064｜商品分类契约包含没有二级父节点的有效叶子

| 字段 | 记录 |
| --- | --- |
| 模块 | `@smart-wing/api-contract` / 商品分类 |
| 类型 | 数据契约不闭合、导航与校验漂移 |
| 严重级别 | P2 |
| 置信度 | 高：固定JSON集合复算与真实Storefront校验路径一致；具体线上商品数量未核验 |
| 文件和精确位置 | `packages/api-contract/src/catalog-taxonomy.json:23-31,102-105`；Storefront `domain/catalog/taxonomy.ts:22-34`；migration `20260725012000_recalibrate_abo_taxonomy.sql:3-4`、`20260814194000_fill_mobile_catalog_categories.sql:44` |
| 当前行为 | [FACT][E-AU-012-004/008] `digital_mobile_accessory`叶子声明`l2=digital_mobile`，数据库迁移也会写入该路径；但JSON的digital children只有computer、audio、office，没有`digital_mobile`。Storefront从leaves直接建立`STRICT_TAXONOMY_PATHS`，因此该三段路径会被判为严格有效，同时它的二级节点不在可浏览category tree中。其余30个叶子的父链闭合 |
| 预期行为 | 每个可被严格接受的叶子都必须引用同一契约中存在且属于对应L1的L2节点；导航树、数据库分类和校验集合应闭合 |
| 直接证据 | E-AU-012-004、E-AU-012-008、PROBE-AU-012-001、INV-AU-012-001 |
| 调用链或运行入口 | 数据库商品taxonomy → Storefront API → `isStrictTaxonomyPath` leaves映射 → 商品接受；category tree → `SMART_WING_TAXONOMY` → 浏览导航 |
| 用户影响 | 手机配件商品可被当作严格分类商品展示，却没有对应的二级浏览节点；用户可能只能从上层或搜索进入，分类筛选与展示路径不一致 |
| 数据影响 | 迁移和分类函数已经使用该L2 code；直接删叶子或改code会产生历史数据兼容责任 |
| 安全影响 | 无 |
| 根因 | categories树与leaves平铺表手工维护，当前测试没有父链闭包断言；数据库新增`digital_mobile`时JSON树未同步 |
| 建议方向 | 独立分类契约批次先以数据库现行code和产品导航为准补齐/迁移父节点，并增加父链、唯一性和featured引用闭包测试；不得直接删除已有code |
| 预计修改范围 | taxonomy JSON、分类契约测试、可能的展示映射；如改code则另需受管数据迁移 |
| 验证方式 | 全量L1/L2/L3唯一且父链闭合；数据库已用code对账；真实分类页只读视觉核对和Storefront定向测试 |
| 回滚方式 | 仅补父节点可回退JSON/测试；若涉及数据code，先保存映射并用独立可逆迁移 |
| 是否需要独立复核 | 否（P2）；涉及线上分类数据变更前需数据专项复核 |

## 11. AU-011 新增未定级事项

- [UNKNOWN] 仓外是否加载该private workspace或手工兼容制品。
- [UNKNOWN] 是否仍有历史主机运行旧`admin-server.cjs`；本AU只证明当前仓库发布策略禁止它。
- [UNKNOWN] 86条兼容permission与`public.*`权限模型的正式退役时间及契约承接者。

## 12. AU-012 新增未定级事项

- [UNKNOWN] 仓外消费者是否依赖`platform.ts`的零仓内调用公共类型，以及`delivery-matrix.json`是否被仓外发布流程直接读取。
- [UNKNOWN] 线上商品中`digital_mobile_accessory`的实际数量和用户导航可见影响；固定仓库只证明数据库会产生该路径且前端契约不闭合。
- [UNKNOWN] 两个兼容包17个测试在安装锁定依赖后的真实通过/失败结果；本AU遵守边界未安装依赖。

## F-0065｜Redactor 会把多类凭据与身份信息字符串原样写入遥测和审计

| 字段 | 记录 |
| --- | --- |
| 模块 | `@shop/telemetry` / Commerce Operation审计 |
| 类型 | 敏感信息脱敏缺口 |
| 严重级别 | **P1 候选**；未完成 RV-0011 前不作最终P1 |
| 置信度 | 高：合成值已通过真实Redactor和ClientErrorBuffer执行；线上实际内容未读取 |
| 文件和精确位置 | `packages/telemetry/src/Redactor.ts:1-19`、`Logger.ts:7-21`、`Adapter.ts:12-36`、`ClientErrors.ts:39-58`；Commerce `foundation/application/ModuleOperations.ts:169-188`、`foundation/telemetry/Telemetry.ts:1-8` |
| 当前行为 | [FACT][E-AU-013-004/005] 敏感对象键会整体替换，Bearer、手机号和email也会替换；但字符串中的`password=...`、Cookie、Basic认证串和卡号保持原样，身份证号码只被手机号模式替换中间11位，仍留下多数可识别字符。合成`password=AuditSecretA`通过实际ClientErrorBuffer writer后仍原样存在；循环对象使脱敏器抛RangeError |
| 预期行为 | 进入日志、trace、指标标签、客户端错误和Operation审计的已识别凭据/PII，不应因为位于任意字符串值而绕过脱敏；失败应受控且不能回退为原文输出 |
| 直接证据 | E-AU-013-004、E-AU-013-005、PROBE-AU-013-001/002、INV-AU-013-001、FM-AU-013-001 |
| 调用链或运行入口 | 业务Operation request/audit result/reason → `appendOperationAudit` → `Redactor` → audit sink/数据库；Commerce logger/metrics/tracer → `nodeTelemetry` → `Redactor` → stdout |
| 用户影响 | 具备日志或审计读取权的人员/系统可能看到本应隐藏的认证材料或身份信息 |
| 数据影响 | Operation审计可持久化残留字符串；日志保留期和外部采集范围本AU未核验 |
| 安全影响 | 凭据重放、会话暴露与个人信息泄漏风险；当前未证明真实秘密已写入，故不是P0 |
| 根因 | 字段名规则较广，但任意字符串规则只覆盖Bearer、手机号、email和带特定标签的OTP；不同输入形态没有统一敏感值分类与完整测试矩阵 |
| 建议方向 | 未来独立修复批次先以合成攻击样本确定契约，再扩展值模式/结构化输入并规定循环与异常处理；不得在审计分支修复，也不得读取真实凭据作为测试样本 |
| 预计修改范围 | Redactor、直接测试，以及Operation audit和各sink的定向回归；不要求修改业务权限 |
| 验证方式 | 合成credential/PII矩阵不得在输出中恢复；循环/异常值受控；真实Operation审计与stdout链使用测试sink端到端验证 |
| 回滚方式 | 回退单一脱敏批次；保留旧行为对照和合成回归，不修改历史审计数据 |
| 是否需要独立复核 | 是，RV-0011；P1强制从真实生产入口重新追到输出/持久化边界 |

为什么不是P0：当前只证明正式代码路径可泄漏特定形态的合成值，没有读取线上日志、审计表或证明正在发生严重泄漏。若RV-0011发现持续真实泄漏，应立即按P0规则停止。

## F-0066｜客户端错误Operation有正式契约和SDK，但不在固定生产发布入口中

| 字段 | 记录 |
| --- | --- |
| 模块 | Commerce Observability / `@shop/telemetry` |
| 类型 | API契约与发布注册断链 |
| 严重级别 | P2 |
| 置信度 | 高：固定契约、模块注册、专用入口和部署禁止表已反向核对；仓外运行单元未知 |
| 文件和精确位置 | `contract/definitions/operations.yml:3121-3150`、SDK `operations/observability.ts:8-41`、Commerce `modules/observability/ObservabilityModule.ts:1-4`、`app/modules.ts:44`、`entry/ApiMain.ts:5-10`、`04_tools/scripts/check/deployment.mjs:39-43` |
| 当前行为 | [FACT][E-AU-013-006] create/read两项都声明`availability:runtime`并生成SDK；实现只随完整`COMMERCE_MODULES`装入`ApiMain`。当前正式发布只接受专用target，专用入口没有这两项；部署检查同时禁止`commerce-api`和`ApiMain.js` |
| 预期行为 | 声明runtime可用并生成客户端的Operation，应至少有一个正式发布单元注册；否则契约应明确退役/不可用状态 |
| 直接证据 | E-AU-013-006、INV-AU-013-002、FM-AU-013-002 |
| 调用链或运行入口 | SDK → `/api/v1/telemetry/clienterrors` → 期望OperationController → ObservabilityModule；固定发布图在入口注册前断开 |
| 用户影响 | 客户端可生成看似正式的方法，但部署后请求无法到达对应handler |
| 数据影响 | 客户端错误不进入进程内buffer；buffer本身不持久化业务表 |
| 安全影响 | 无直接权限扩大；create仍声明member、read声明operator且实现使用server-derived scope |
| 根因 | 全量ApiMain拆成专用入口后，Observability能力没有被分配到新target，契约availability也未同步 |
| 建议方向 | 单独由产品/运维确认能力是否保留；保留则分配明确发布单元，退役则按契约兼容流程处理，不能直接删模块或SDK |
| 预计修改范围 | 发布target/entry或契约availability、SDK生成和定向测试；二选一，不与脱敏修复混批 |
| 验证方式 | release target集合能解析两项Operation，或客户端/契约明确不可用；真实路由只读冒烟非404/502 |
| 回滚方式 | 回退单一入口或契约提交；不迁移数据 |
| 是否需要独立复核 | 否（P2）；仓外仍运行完整ApiMain时需修正发布结论 |

## F-0067｜TelemetryWriter允许Promise，但三个sink会丢弃拒绝

| 字段 | 记录 |
| --- | --- |
| 模块 | `@shop/telemetry` |
| 类型 | 异步失败传播、可维护性 |
| 严重级别 | P3 |
| 置信度 | 高：拒绝writer反事实产生未处理rejection；当前生产writer同步 |
| 文件和精确位置 | `packages/telemetry/src/Adapter.ts:3,18-36`、`ClientErrors.ts:31,58`、`Telemetry.ts:3-9` |
| 当前行为 | [FACT][E-AU-013-007] writer类型是`void | Promise<void>`；metrics、span end和client-error record均以`void writer(...)`丢弃返回值。一个metric和同一span两次end的探针产生3次`unhandledRejection` |
| 预期行为 | 公共契约若允许异步writer，其拒绝必须被await、返回或通过显式错误通道处理；否则类型应只允许同步writer |
| 直接证据 | E-AU-013-007、PROBE-AU-013-003、INV-AU-013-003、FM-AU-013-003 |
| 调用链或运行入口 | metrics.count/duration、span.end、ClientErrorBuffer.record → writer Promise rejection → host unhandled-rejection策略 |
| 用户影响 | 使用异步平台adapter时可能产生噪声、丢遥测，严格宿主策略下可能影响进程稳定 |
| 数据影响 | 遥测记录可能丢失；不直接改变业务事务 |
| 安全影响 | 无直接影响 |
| 根因 | sink API设计为同步，但writer类型后来允许异步，调用点未统一失败语义 |
| 建议方向 | 独立API契约批次选择同步限制或显式异步/错误回调，并覆盖拒绝与重复end；不在审计分支实施 |
| 预计修改范围 | writer/sink接口、adapters、定向测试和消费者typecheck |
| 验证方式 | 拒绝writer无unhandled rejection且行为契约明确；同步stdout路径不回归 |
| 回滚方式 | 回退单一接口批次 |
| 是否需要独立复核 | 否 |

## 13. AU-013 新增未定级事项

- [UNKNOWN] 线上日志或Operation审计是否已包含F-0065形态的真实敏感值；未连接线上、未读取真实数据。
- [UNKNOWN] 仓外是否直接消费browser/miniapp/tracer公共面，或继续部署完整ApiMain。
- [UNKNOWN] telemetry六个直接测试在安装锁定依赖后的真实结果；本AU遵守边界未安装依赖。

## F-0068｜测试Harness会改变或掩盖原始失败语义

| 字段 | 记录 |
| --- | --- |
| 模块 | `@shop/testing` Database/Provider Harness |
| 类型 | 测试可信度、失败传播 |
| 严重级别 | P3 |
| 置信度 | 高：合成双异常和throwing matcher控制流已验证；当前唯一Database consumer的reset自行吞掉清理错误 |
| 文件和精确位置 | `packages/testing/src/DatabaseHarness.ts:7-17`、`ProviderHarness.ts:6-13` |
| 当前行为 | [FACT][E-AU-014-004] 测试体抛`TEST_FAIL`且reset抛`RESET_FAIL`时，调用者最终只收到`RESET_FAIL`；Provider matcher抛错时`execute():Promise`在返回Promise前同步抛出 |
| 预期行为 | 测试基础设施应保留主失败并附加cleanup失败；Promise形态API的fixture失败应保持一致的rejection语义 |
| 直接证据 | E-AU-014-004、INV-AU-014-001/002、FM-AU-014-001/002 |
| 调用链或运行入口 | Repository/仓外test → harness → test/matcher → cleanup/Promise断言 |
| 用户影响 | 开发者可能追错根因，或测试断言因同步throw与rejection差异产生噪声 |
| 数据影响 | 当前Repository reset主动容错并尽力清理；仓外fixture未知 |
| 安全影响 | 无 |
| 根因 | finally采用单异常传播；Promise返回类型没有包裹可能throw的matcher |
| 建议方向 | 独立testing批次定义primary+cleanup错误和全异步失败契约，再补双异常/matcher测试；不与业务修复混批 |
| 预计修改范围 | 两个Harness及直接测试 |
| 验证方式 | test/reset成功失败四象限；matcher missing/error/response三类均用稳定Promise断言 |
| 回滚方式 | 回退testing单一提交 |
| 是否需要独立复核 | 否 |

## F-0069｜HttpHarness记录的请求快照与Responder实际处理对象可能不同

| 字段 | 记录 |
| --- | --- |
| 模块 | `@shop/testing` HTTP Harness |
| 类型 | 测试假阳性、并发可变输入 |
| 严重级别 | P3 |
| 置信度 | 高：实际Harness异步探针复现；固定仓库无包外caller |
| 文件和精确位置 | `packages/testing/src/HttpHarness.ts:15-28`、`HttpHarness.test.ts:10-24` |
| 当前行为 | [FACT][E-AU-014-005] send把冻结浅快照放入requests，却把原始request传给异步respond。send后修改URL/header时，captured仍记录旧值，responder读取新值 |
| 预期行为 | 测试记录与stub应观察同一个不可变请求快照，才能证明断言对应实际处理输入 |
| 直接证据 | E-AU-014-005、INV-AU-014-003、FM-AU-014-003 |
| 调用链或运行入口 | SDK/test caller → HttpHarness.send → captured snapshot + async responder original reference |
| 用户影响 | 测试可能断言发送了A，同时stub按B响应，产生难复现假阳性/假阴性 |
| 数据影响 | 只影响测试，不进入生产Transport |
| 安全影响 | 无 |
| 根因 | 捕获和执行使用两个不同对象；当前测试只断言header freeze，不检查responder一致性 |
| 建议方向 | 独立testing批次统一使用同一snapshot并增加异步mutation/abort测试；不在审计分支修复 |
| 预计修改范围 | HttpHarness及直接测试 |
| 验证方式 | send后变更原对象不影响captured和responder；预取消/执行中取消/resolve/reject保持一致 |
| 回滚方式 | 回退testing单一提交 |
| 是否需要独立复核 | 否 |

## 14. AU-014 新增未定级事项

- [UNKNOWN] 仓外测试是否消费除DatabaseHarness以外的root/browser公共工具。
- [UNKNOWN] 七个包内测试在安装锁定依赖后的真实结果；本AU未安装依赖。

## F-0070｜MutationQueue 会把成功写入后的观察回调异常改判为写入失败

| 字段 | 记录 |
| --- | --- |
| 模块 | `@shop/interaction` / Storefront cart sync |
| 类型 | 成功/失败边界、客户端状态一致性 |
| 严重级别 | P3 |
| 置信度 | 高：真实Queue合成探针复现；当前Storefront callback内部容错 |
| 文件和精确位置 | `packages/interaction/src/KeyedMutationQueue.ts:95-121`；Storefront `context/cartQuantitySync.ts:28-40`、`MallContext.tsx:171-189` |
| 当前行为 | [FACT][E-AU-015-004] write成功后先把confirmed更新为新值，再调用onCommitted；callback抛错会进入catch，调用onError、丢弃pending并拒绝flush，rollbackValue却是新confirmed。探针得到`COMMIT_CALLBACK_FAIL`和rollback=2 |
| 预期行为 | 远端写成功与观察/缓存回调失败应有独立语义；观察失败不得触发“远端写失败”回滚链 |
| 直接证据 | E-AU-015-004、INV-AU-015-001、FM-AU-015-001 |
| 调用链或运行入口 | Storefront quantity update → queue write API → confirmed → onCommitted/cache → catch/onError UI rollback |
| 用户影响 | 极端callback异常下，服务端已成功但UI提示同步失败或丢弃后续操作 |
| 数据影响 | 可能产生服务端数量与客户端提示/缓存不一致；当前cache writer吞持久化异常，实际概率受限 |
| 安全影响 | 无 |
| 根因 | write与observer callback位于同一try/catch，且confirmed在observer前更新 |
| 建议方向 | 独立interaction批次拆分commit结果和observer失败通道并补callback throw测试；不与购物车业务重构混批 |
| 预计修改范围 | Queue及定向测试，必要时cart adapter错误契约 |
| 验证方式 | write/onCommitted/onError成功失败矩阵，断言远端调用、rollback值、pending和flush结果 |
| 回滚方式 | 回退单一Queue提交 |
| 是否需要独立复核 | 否 |

## F-0071｜ActionCoordinator 的重复请求可以获得错误的Result静态类型

| 字段 | 记录 |
| --- | --- |
| 模块 | `@shop/interaction` KeyedActionCoordinator |
| 类型 | 公共类型契约、去重语义 |
| 严重级别 | P3 |
| 置信度 | 高：接口类型允许且运行探针证明值类型错配；Auth现行未发现跨类型key |
| 文件和精确位置 | `packages/interaction/src/KeyedActionCoordinator.ts:13-17,53-61` |
| 当前行为 | [FACT][E-AU-015-005] Result是每次`start`独立泛型；相同key已有string action时，duplicate可声明number action并得到`Promise<number>`，实际共享首个Promise并解析string |
| 预期行为 | 同一key去重必须在类型上绑定一致Result，或重复attempt返回unknown/首请求类型，不能无校验cast |
| 直接证据 | E-AU-015-005、INV-AU-015-002、FM-AU-015-002 |
| 调用链或运行入口 | Auth action wrapper/仓外caller → coordinator.start(key) → active.promise cast |
| 用户影响 | 新消费者可能在类型检查通过后按错误类型处理运行值 |
| 数据影响 | 当前无直接数据影响证据 |
| 安全影响 | 无 |
| 根因 | coordinator只以Key参数化，Result留在方法级，active promise存为unknown后无条件cast |
| 建议方向 | 独立类型API批次把key与result绑定或收窄duplicate返回；补编译期与运行测试 |
| 预计修改范围 | Coordinator类型/实现、React hook与消费者typecheck |
| 验证方式 | 同key异Result必须编译失败或显式unknown；同Result去重/取消行为不回归 |
| 回滚方式 | 回退类型API单一提交 |
| 是否需要独立复核 | 否 |

## F-0072｜FeedbackStore 的只读Snapshot可在无通知时被外部改写

| 字段 | 记录 |
| --- | --- |
| 模块 | `@shop/interaction` FeedbackStore |
| 类型 | 外部store不变量、可变引用 |
| 严重级别 | P3 |
| 置信度 | 高：真实store探针复现；现行Storefront传入fresh literal |
| 文件和精确位置 | `packages/interaction/src/FeedbackStore.ts:11-16,43-62`；Storefront `context/useToasts.ts:7-18` |
| 当前行为 | [FACT][E-AU-015-006] publish原样保存message，getSnapshot返回含同一对象的数组。调用者随后改原对象，snapshot identity不变、内容变化且listener不被通知 |
| 预期行为 | `useSyncExternalStore` snapshot应只在受控publish/remove时改变，并以新identity通知订阅者 |
| 直接证据 | E-AU-015-006、INV-AU-015-003、FM-AU-015-003 |
| 调用链或运行入口 | Storefront showToast/仓外caller → publish → snapshot → React subscription |
| 用户影响 | 外部复用可变对象时UI可能不刷新或读取到无事件的变化 |
| 数据影响 | 只影响内存反馈状态 |
| 安全影响 | 无 |
| 根因 | TypeScript readonly只在编译期生效，store没有复制/冻结message |
| 建议方向 | 独立store契约批次定义复制/冻结或明确所有权，并补mutation与listener测试 |
| 预计修改范围 | FeedbackStore及直接测试 |
| 验证方式 | publish后改原输入不改变snapshot；每个可见变化有新identity和一次通知 |
| 回滚方式 | 回退单一store提交 |
| 是否需要独立复核 | 否 |

## F-0073｜ResourceCache dispose 后仍可从Storage重新持有状态

| 字段 | 记录 |
| --- | --- |
| 模块 | `@shop/interaction` ResourceCache |
| 类型 | 生命周期、资源释放 |
| 严重级别 | P3 |
| 置信度 | 高：真实cache探针复现；当前Auth模块级cache不调用dispose |
| 文件和精确位置 | `packages/interaction/src/ResourceCache.ts:55-75,117-123` |
| 当前行为 | [FACT][E-AU-015-007] dispose清空memory和activeLoads并设disposed；read不检查disposed，之后可从storage解码值、重新写入memory并返回。探针dispose后仍返回7 |
| 预期行为 | 已dispose对象不应重新持有缓存状态；read应有明确拒绝或只读不缓存契约 |
| 直接证据 | E-AU-015-007、INV-AU-015-004、FM-AU-015-004 |
| 调用链或运行入口 | Auth/仓外cache owner → dispose → late read(storage) → memory.set |
| 用户影响 | 生命周期竞争下可能读取陈旧会话/资源缓存或造成释放后内存再增长 |
| 数据影响 | 仅缓存投影；当前Auth cache未dispose，无现行可达证据 |
| 安全影响 | 若未来用于身份缓存会有陈旧投影风险；当前未证明 |
| 根因 | disposed guard只覆盖write/revalidate，不覆盖read/remove |
| 建议方向 | 独立cache生命周期批次统一dispose后全部方法契约并补late-call矩阵 |
| 预计修改范围 | ResourceCache及直接测试、消费者typecheck |
| 验证方式 | dispose后read/write/revalidate/remove一致；active loader忽略abort时不重填 |
| 回滚方式 | 回退cache单一提交 |
| 是否需要独立复核 | 否 |

## 15. AU-015 新增未定级事项

- [UNKNOWN] 仓外消费者是否依赖callback异常、可变snapshot或dispose后read行为。
- [UNKNOWN] 21个包内测试在锁定依赖安装后的真实结果；本AU未安装依赖。

## F-0074｜Storefront 保留一个没有实际源码消费者的旧设计包依赖

| 字段 | 记录 |
| --- | --- |
| 模块 | `@smart-wing/design-system` / Storefront workspace |
| 类型 | 依赖图、架构漂移 |
| 严重级别 | P3 |
| 置信度 | 高：固定仓库全引用检索只有package/lock边，没有源码、CSS、脚本或配置消费 |
| 文件和精确位置 | `packages/design-system/package.json:1-12`；Storefront `package.json:21`；根`package-lock.json:253,927-928,4141-4142` |
| 当前行为 | [FACT][E-AU-016-003/004] Storefront声明依赖旧设计包，安装/Workspace图保留边；其生产代码不import任何旧export，Console和正式token脚本使用canonical `@shop/design` |
| 预期行为 | workspace依赖应对应真实构建/源码职责；已迁移依赖应有明确兼容消费者或退役证据 |
| 直接证据 | E-AU-016-003、E-AU-016-004、INV-AU-016-002、FM-AU-016-001 |
| 调用链或运行入口 | package dependency graph → workspace/lock/release impact；没有进入Storefront bundle的代码链 |
| 用户影响 | 维护者和影响分析可能误判旧包仍是Storefront视觉来源，扩大构建/发布或迁移判断范围 |
| 数据影响 | 无 |
| 安全影响 | 无 |
| 根因 | 向canonical design迁移后依赖声明未同步收口 |
| 建议方向 | 未来独立依赖治理批次先做构建/页面视觉和仓外消费复核，再只移除依赖边；不得顺带删除旧包 |
| 预计修改范围 | Storefront package与lock；旧包归档/删除另批 |
| 验证方式 | Storefront定向build、关键页面视觉对照、workspace/release影响图复算 |
| 回滚方式 | 恢复package/lock单一提交 |
| 是否需要独立复核 | 否；旧包删除仍需另行复核 |

## F-0075｜旧 tokens.css 的生成声明已脱离真实生成器和正式漂移检查

| 字段 | 记录 |
| --- | --- |
| 模块 | `@smart-wing/design-system` token生成链 |
| 类型 | 生成物来源、文档漂移 |
| 严重级别 | P3 |
| 置信度 | 高：生成器输入/输出常量与正式check已执行；旧文件没有当前写入点 |
| 文件和精确位置 | `packages/design-system/src/tokens.css:1-4`；`04_tools/scripts/build-web-tokens.mjs:11-36,208-241`；canonical `packages/design/src/tokens.json:1-12` |
| 当前行为 | [FACT][E-AU-016-005/006] 旧CSS声称由该脚本从旧JSON生成并可用`npm run build:web-tokens`重生；当前脚本只读写`packages/design`。正式check返回0但不检查旧CSS。旧token仍为1.0智慧翼/会员码，canonical已为1.2主打团/翼码，变量79对82 |
| 预期行为 | 标记GENERATED的文件必须能由所列脚本从所列源重生，并被正式check覆盖；否则应明确归档/冻结状态 |
| 直接证据 | E-AU-016-005、E-AU-016-006、INV-AU-016-001、FM-AU-016-002 |
| 调用链或运行入口 | 维护者执行build:web-tokens → 只更新canonical输出；旧CSS保持不变且check仍通过 |
| 用户影响 | 维护者可能误以为旧视觉文件已由当前单源和CI保护 |
| 数据影响 | 无业务数据；视觉token内容漂移 |
| 安全影响 | 无 |
| 根因 | 生成器迁移到canonical目录后旧生成头未改成归档/历史说明，也未接退役检查 |
| 建议方向 | 在独立视觉治理批次由Ethan确认旧包去向；保留则恢复可复现生成，退役则先验证消费者后归档。不能直接手改生成CSS |
| 预计修改范围 | 生成来源/检查或旧包归档说明；不与视觉值改版混批 |
| 验证方式 | 旧输出可字节重生且反事实改源使check失败，或确认退役后构建/页面无差异 |
| 回滚方式 | 回退单一生成链/归档提交 |
| 是否需要独立复核 | 否（P3）；DC-0020若升级G3必须独立复核 |

## 16. AU-016 新增未定级事项

- [UNKNOWN] 仓外构建或设计工具是否按`@smart-wing/design-system`包名消费exports。
- [UNKNOWN] 移除Storefront依赖及旧包后的完整build和真实页面视觉是否完全不变。

## F-0076｜Canonical 组件样式引用80个未生成的CSS令牌

| 字段 | 记录 |
| --- | --- |
| 模块 | `@shop/design` token生成链与Console样式 |
| 类型 | 生成契约、生产UI样式 |
| 严重级别 | P2 |
| 置信度 | 高：变量定义/使用集合已复算；浏览器视觉范围未实测 |
| 文件和精确位置 | `packages/design/src/tokens.css:6-107`；`foundation.css:1-197`；`controls.css:1-235`；`data-display.css:1-145`；`feedback.css:1-97`；`vi-1-2-foundation.css:1-331`；`04_tools/scripts/build-web-tokens.mjs:81-194`；Console `src/main.tsx:3-6` |
| 当前行为 | [FACT][E-AU-017-005] 14个CSS文件使用的`--sw-*`与全部仓内CSS定义做差，得到80个无定义变量；生成器只输出旧的有限映射。无fallback的`var()`使所在声明失效 |
| 预期行为 | canonical token输出必须覆盖所有生产组件使用的变量，或每处有明确fallback；check应验证消费闭合而非仅字节一致 |
| 直接证据 | E-AU-017-004/005、INV-AU-017-001、FM-AU-017-001 |
| 调用链或运行入口 | tokens.json → build-web-tokens → tokens.css + components.css → Console main → Button/Surface/Workspace组件 |
| 用户影响 | 控件触控高度、边框、padding、字号、Surface背景/深度及工作台布局/语义色可能退回浏览器默认或局部失效 |
| 数据影响 | 无业务数据写入影响 |
| 安全影响 | 可降低权限/状态提示的视觉清晰度；未证明授权绕过 |
| 根因 | 组件CSS已扩展到VI1.2完整token词汇，生成器仍只映射早期子集；现有check只比对生成器自身输出 |
| 建议方向 | 后续独立token闭合批次先建立consumer→definition反事实闸门，再扩展生成映射；不在审计分支修复 |
| 预计修改范围 | token生成器、生成物、CSS闭合测试；视觉值变更另批 |
| 验证方式 | 变量差集为0；design test/typecheck；Console定向build和关键控件computed-style/视觉对照 |
| 回滚方式 | 回退单一token生成提交并重生受控产物 |
| 是否需要独立复核 | 否；若升级P1则需要 |

## F-0077｜AccessDenied 的视觉类没有任何CSS实现，测试却把类名当作暗色表面

| 字段 | 记录 |
| --- | --- |
| 模块 | `@shop/design` AccessDenied |
| 类型 | 权限状态UI、测试假阳性 |
| 严重级别 | P2 |
| 置信度 | 高：全仓CSS零选择器定义；未打开真实页面 |
| 文件和精确位置 | `packages/design/src/AccessDenied.tsx:35-105`；`AccessDenied.component.test.tsx:10-20`；`components.css:1-5` |
| 当前行为 | [FACT][E-AU-017-006] 组件输出`swaccessdenied*`共11组类，但全仓CSS无任何匹配定义。测试名宣称dark surface，却只检查`swaccessdeniedforbidden`类存在和无按钮 |
| 预期行为 | 权限边界应有可见、可访问且与普通内容明确区分的受测样式；视觉断言必须验证真实样式入口或浏览器结果 |
| 直接证据 | E-AU-017-006、INV-AU-017-002、FM-AU-017-002 |
| 调用链或运行入口 | Console RouteError/ResourceState → ContextualAccessDenied → 未定义CSS类 |
| 用户影响 | 403/401状态可能呈现为无层级的默认文本，弱化错误原因和恢复提示 |
| 数据影响 | 无 |
| 安全影响 | 不改变服务端授权裁决；只影响边界表达 |
| 根因 | AccessDenied实现与样式资产未同时进入canonical CSS入口；测试只验证DOM形状 |
| 建议方向 | 独立权限状态视觉批次补齐真实样式与浏览器级断言；不顺手改变授权规则 |
| 预计修改范围 | AccessDenied CSS入口、组件视觉测试/Story |
| 验证方式 | 生产CSS存在全部必要选择器；403与401页面computed style和键盘/读屏对照 |
| 回滚方式 | 回退单一视觉提交 |
| 是否需要独立复核 | 否 |

## F-0078｜Console 把API 401折叠成denied，导致重新登录恢复分支不可达

| 字段 | 记录 |
| --- | --- |
| 模块 | Console QueryState ↔ `@shop/design` ResourceState/AccessDenied |
| 类型 | 前后端错误契约、会话恢复 |
| 严重级别 | P2 |
| 置信度 | 高：共享QueryState由多个生产路由调用，状态映射和渲染分支直接可证 |
| 文件和精确位置 | Console `src/shared/api/QueryState.ts:13-42`；design `ResourceState.tsx:42-44`；`AccessDenied.tsx:45-67,95-103`；Console `ScopeShell.tsx:190-199,252` |
| 当前行为 | [FACT][E-AU-017-007] `errorCondition`把401和403都返回`denied`；ResourceState仅`unauthenticated`分支渲染重新登录，`denied`进入无动作forbidden分支。ScopeShell虽提供onRelogin，仍不会被消费 |
| 预期行为 | 认证失效与授权拒绝应保持不同状态；401必须提供确定的重新认证路径，403保持权限拒绝语义 |
| 直接证据 | E-AU-017-007、INV-AU-017-003、FM-AU-017-003 |
| 调用链或运行入口 | feature query ApiError(401) → Console queryCondition → denied → ResourceState → forbidden AccessDenied |
| 用户影响 | 会话过期时页面显示“没有权限”且无重新登录按钮，用户需猜测刷新/重新进入 |
| 数据影响 | 无直接数据影响 |
| 安全影响 | 不扩大权限；会混淆认证与授权审计语义 |
| 根因 | Console状态适配器合并HTTP 401/403，而design状态联合已明确区分两者 |
| 建议方向 | 后续独立状态契约批次修正映射并补401/403端阵；不修改权限本身 |
| 预计修改范围 | Console QueryState与直接测试，必要时路由恢复测试 |
| 验证方式 | 401→unauthenticated+relogin；403→denied且无越权动作；所有消费路由定向测试 |
| 回滚方式 | 回退单一状态映射提交 |
| 是否需要独立复核 | 否 |

## F-0079｜Storybook 未装载生产组件样式，也没有正式Story执行入口

| 字段 | 记录 |
| --- | --- |
| 模块 | `@shop/design` Storybook/质量入口 |
| 类型 | 测试可信度、视觉回归 |
| 严重级别 | P3 |
| 置信度 | 高：preview/import图与根script已核对 |
| 文件和精确位置 | `.storybook/preview.ts:1-18`；`package.json:10-16`；`Dialog.stories.tsx:1-42`；根`package.json:54,123` |
| 当前行为 | [FACT][E-AU-017-008] preview只导入tokens/base/workspace，未导入components；Dialog play与a11y error配置存在，但根正式质量链仅运行Vitest component，不运行Story interaction/a11y |
| 预期行为 | Storybook应与生产装载同一组件CSS，并有明确可执行的交互/a11y入口 |
| 直接证据 | E-AU-017-008、INV-AU-017-004、FM-AU-017-004 |
| 调用链或运行入口 | Storybook preview → stories；根quality链无story runner |
| 用户影响 | Story画面和a11y结果不能可靠代表Console生产组件，视觉回归可能假阴性 |
| 数据影响 | 无 |
| 安全影响 | 无 |
| 根因 | Storybook开发入口与生产样式入口、正式测试入口分别演进 |
| 建议方向 | 独立Design QA批次统一style import并决定正式story runner；不与token修复混批 |
| 预计修改范围 | preview、package scripts/质量入口、Story测试 |
| 验证方式 | Story构建/interaction/a11y真实执行；生产/Story computed style对照 |
| 回滚方式 | 回退单一QA接线提交 |
| 是否需要独立复核 | 否 |

## F-0080｜Canonical token品牌身份与公开Brand组件/资产相互冲突

| 字段 | 记录 |
| --- | --- |
| 模块 | `@shop/design` 品牌资产 |
| 类型 | 设计契约、内容漂移 |
| 严重级别 | P3 |
| 置信度 | 高：JSON、组件和SVG文本直接冲突；当前Brand无生产调用 |
| 文件和精确位置 | `tokens.json:3-18`；`Brand.tsx:3-18`；`brand/brand-lockup-horizontal.svg:1-18`；`brand-mark.svg:1-19`；`wing-code-symbol.svg:1-20`；`wing-pattern.svg:1-12` |
| 当前行为 | [FACT][E-AU-017-009] token声明主打团/ZHUDATUAN/翼码，公开Brand alt/copy和四个canonical SVG仍声明智慧翼/Smart Wing；Storybook同时展示两套名称 |
| 预期行为 | canonical包中的品牌元数据、组件可访问名称、可见资产与Ethan确认的正式VI一致 |
| 直接证据 | E-AU-017-009、INV-AU-017-005、FM-AU-017-005 |
| 调用链或运行入口 | public Brand/brand subpath → Storybook/未来消费者；miniapp生成器复制mark/wingcode |
| 用户影响 | 新消费者或设计交付可能展示旧品牌名称；当前固定生产Console无Brand import证据 |
| 数据影响 | 无 |
| 安全影响 | 无 |
| 根因 | token改名/版本升级未与品牌组件和SVG内容原子收口 |
| 建议方向 | 由Ethan定稿后单独品牌资产批次处理组件、SVG、alt和跨端复制；必须视觉复核 |
| 预计修改范围 | Brand、4 SVG、Story与miniapp生成输出 |
| 验证方式 | 文本/资产一致性、生成check、关键页面/Story视觉和可访问名称 |
| 回滚方式 | 回退单一品牌提交和受控生成物 |
| 是否需要独立复核 | 否 |

## F-0081｜移动平台设计标准的大部分字段没有生成或运行消费者

| 字段 | 记录 |
| --- | --- |
| 模块 | `@shop/design` mobile platform contract |
| 类型 | 规格到运行接线、文档漂移 |
| 严重级别 | P3 |
| 置信度 | 高：字段级全仓反查；是否为未来规格未知 |
| 文件和精确位置 | `mobile-platforms.json:1-223`；`04_tools/scripts/build-web-tokens.mjs:35-37,63-66,174-190`；`build-miniapp-theme.mjs:1-46` |
| 当前行为 | [FACT][E-AU-017-010] web生成器只读取iOS/Android wing-code与触控尺寸；miniapp生成器不读取该文件；wechat、六档size class、overflow/tablet规则没有固定仓库消费者 |
| 预期行为 | 标为平台标准的可执行规则应进入生成/运行/验证链，或明确标为未实施设计规格 |
| 直接证据 | E-AU-017-010、INV-AU-017-006、FM-AU-017-006 |
| 调用链或运行入口 | mobile-platforms → web generator（部分）；其余字段无下游 |
| 用户影响 | 维护者可能误以为小程序和平板规则已生效；真实适配状态无法从该文件推断 |
| 数据影响 | 无 |
| 安全影响 | 无 |
| 根因 | 设计数据扩展快于生成器和运行适配接线 |
| 建议方向 | 后续跨端专项先标记implemented/planned，再逐规则建立消费者；不得直接删除唯一规格 |
| 预计修改范围 | 平台数据schema、生成器/miniapp适配与验证；需拆批 |
| 验证方式 | 每字段consumer矩阵、设备档位/resize定向测试和生成漂移检查 |
| 回滚方式 | 回退每个独立平台接线提交 |
| 是否需要独立复核 | 否；若DC-0022升级G3则需要 |

## 17. AU-017 新增未定级事项

- [UNKNOWN] 固定基线Console真实页面的computed style损失范围；本AU没有打开页面或截图。
- [UNKNOWN] 仓外消费者是否使用DC-0021中的公共export。
- [UNKNOWN] `mobile-platforms.json`未接线字段是待实现正式规格、纯设计说明还是已退役约束。

## F-0082｜生成的Miniapp Experience parser与canonical契约不等价

| 字段 | 记录 |
| --- | --- |
| 模块 | Miniapp generated contract / `ExperienceContract` |
| 类型 | 生成实现漂移、输入边界 |
| 严重级别 | P3 |
| 置信度 | 高：源/模板逐分支对照并由生成JS探针复现；当前零运行caller |
| 文件和精确位置 | `packages/contract/src/ExperienceContract.ts:30-72`；`04_tools/scripts/build-miniapp-contract.mjs:10-31`；`apps/miniapp/miniprogram/domain/experience.js:1-25` |
| 当前行为 | [FACT][E-AU-018-005] canonical限制最多100页、每页200块，对application/id/path/target执行trim、非空和255长度检查，并允许缺失blocks按空数组处理；生成parser无这些上限/字符串约束，却要求blocks必须数组。探针接受101页、201块、空白application/空ID，并拒绝缺失blocks |
| 预期行为 | 标记“Generated from ExperienceContract”的运行parser应与canonical parser拥有明确且受测的相同接纳/拒绝语义，或公开记录受控差异 |
| 直接证据 | E-AU-018-005、INV-AU-018-002、FM-AU-018-002 |
| 调用链或运行入口 | ExperienceContract常量/手写模板 → experience.js；当前Miniapp片段无运行caller |
| 用户影响 | 若外部页面接入该parser，同一体验文档可能在服务端/canonical拒绝但小程序接受，或反向拒绝；当前线上可达性未知 |
| 数据影响 | 只解析内存文档；无仓内写入链 |
| 安全影响 | 无已证实安全影响；缺上限可扩大客户端处理量，但当前无运行入口 |
| 根因 | 生成器只复制枚举与简化校验逻辑，没有复用canonical parser或行为parity矩阵 |
| 建议方向 | 独立生成契约批次先确定canonical语义，再让生成parser逐项等价并建立表驱动反事实；不手改生成JS |
| 预计修改范围 | ExperienceContract、生成器、生成物和parity测试 |
| 验证方式 | version/application/pages/page/blocks/block/action/content完整accept/reject矩阵在TS与生成JS一致；生成check与外部Miniapp验证 |
| 回滚方式 | 回退生成器和生成物同一提交 |
| 是否需要独立复核 | 否 |

## 18. AU-018 新增未定级事项

- [UNKNOWN] 外部完整小程序源码、线上微信版本和这9个文件的真实交付消费者。
- [UNKNOWN] 无运行caller生成物是待装配候选片段、外部工程同步源还是遗留输出。

## F-0083｜Auth runtime 可把凭据API指向未绑定Manifest的任意HTTPS域

| 字段 | 记录 |
| --- | --- |
| 模块 | Auth Web runtime identity node |
| 类型 | 身份凭据目的地、运行配置供应链 |
| 严重级别 | P1候选 |
| 置信度 | 高：parser、安装、测试和请求正文调用链直接可证；live值未核验 |
| 文件和精确位置 | `auth-web/src/services/identityNodeEnvironment.ts:16-58`；`canonicalIdentity.ts:302-411,464-470`；`canonicalRegistration.ts:247-285`；SDK `IdentityNodeRegistry.ts:151-217`；`identityNodeRuntime.test.ts:8-43` |
| 当前行为 | [FACT][E-AU-019-005] runtime envelope的digest/source字段仅校验格式；registry只要求当前accounts host匹配并接受任意HTTPS API/回跳origin。测试中的generated节点使用`.invalid` API/console/storefront仍成功安装。后续currentIdentityNode把该API作为含账号、密码、OTP或注册正文的fetch目的地 |
| 预期行为 | runtime所选敏感目的地必须与同一受信节点Manifest/domain bindings及实际artifact身份绑定，不能由仅shape-valid JSON任意选择 |
| 直接证据 | E-AU-019-005、INV-AU-019-001、FM-AU-019-001 |
| 调用链或运行入口 | accounts host `/identity-runtime.json` → install runtimeRegistry → currentIdentityNode → identityRequest → runtime apiOrigin/consumerApiOrigin |
| 用户影响 | 错配runtime且目标允许CORS时，用户提交的登录/注册凭据会发往错误服务；当前线上是否存在错配UNKNOWN |
| 数据影响 | 可能暴露账号、密码、OTP、邀请码和注册资料；未证明已发生 |
| 安全影响 | 高；配置权等价于凭据接收方选择权 |
| 根因 | runtime envelope完整性字段未被客户端验证，registry通用shape校验未绑定受信Manifest |
| 建议方向 | 后续独立批次统一runtime producer、签名/digest或Manifest投影绑定；不在审计分支新增门禁 |
| 预计修改范围 | runtime生成/激活、Auth installer、SDK投影与反事实测试；必须拆批 |
| 验证方式 | 当前accounts host+外域API反事实必须被拒；合法新增节点通过；真实浏览器CORS/请求目的地和回滚演练 |
| 回滚方式 | 回退独立runtime绑定提交并恢复上一份已知正确runtime artifact |
| 是否需要独立复核 | 是，RV-0012 |

## F-0084｜Auth build快渲染与runtime全局替换形成双版本节点状态

| 字段 | 记录 |
| --- | --- |
| 模块 | Auth Web bootstrap |
| 类型 | 状态一致性、身份入口 |
| 严重级别 | P2 |
| 置信度 | 高：render guard和运行时读取顺序直接可证 |
| 文件和精确位置 | `main.tsx:7-25`；`App.tsx:11-46`；`identityNodeEnvironment.ts:16-70`；`canonicalIdentity.ts:302-370,464-470` |
| 当前行为 | [FACT][E-AU-019-003/006] build registry识别hostname后App立即捕获entry props；runtime到达后只替换模块级registry，`renderedFromBuild`阻止App重绘。提交时canonical服务再次读取新registry |
| 预期行为 | 页面入口、application/target、显示品牌与请求API/回跳校验应来自同一不可分割registry版本 |
| 直接证据 | E-AU-019-003/E-AU-019-006、INV-AU-019-002、FM-AU-019-002 |
| 调用链或运行入口 | build entry→App props；并行runtime install→currentIdentityNode→submit |
| 用户影响 | runtime与build存在合法差异时，登录/注册可被节点不匹配拒绝或显示与提交目标不一致 |
| 数据影响 | 未证实写错数据；F-0083另述目的地风险 |
| 安全影响 | 默认回跳校验会fail closed；仍破坏身份边界可解释性 |
| 根因 | 快速首屏策略与可变全局runtime策略没有版本切换协议 |
| 建议方向 | 单独bootstrap一致性批次选择原子等待、显式版本快照或受控重渲染 |
| 预计修改范围 | main/App/environment及bootstrap测试 |
| 验证方式 | build/runtime相同、合法漂移、host新增、慢响应四矩阵；页面和请求节点必须一致 |
| 回滚方式 | 回退单一bootstrap提交 |
| 是否需要独立复核 | 否；若升级P1则需要 |

## F-0085｜runtime瞬时失败会覆盖已由有效build注册表渲染的登录页

| 字段 | 记录 |
| --- | --- |
| 模块 | Auth Web bootstrap |
| 类型 | 可用性、失败传播 |
| 严重级别 | P2 |
| 置信度 | 高：Promise catch无条件root.render |
| 文件和精确位置 | `main.tsx:7-31`；`identityNodeEnvironment.ts:20-31`；`main.test.ts:4-11` |
| 当前行为 | [FACT][E-AU-019-003] 已知build节点先显示App；runtime网络、5xx、JSON/envelope/host错误随后进入catch并把root替换为配置不可用。仅404或非JSON 200走fallback |
| 预期行为 | runtime是否强制应有明确策略；若build是合法fallback，瞬时runtime故障不应无条件摧毁已可用入口 |
| 直接证据 | E-AU-019-003、INV-AU-019-003、FM-AU-019-003 |
| 调用链或运行入口 | main renderApp→loadIdentityNodeRuntime rejection→root.render error |
| 用户影响 | runtime服务或文件短暂异常可使所有登录/注册入口不可用 |
| 数据影响 | 无直接写入；中断身份流程 |
| 安全影响 | fail closed但扩大可用性故障域 |
| 根因 | fallback语义只按HTTP/content-type区分，没有结合是否已有可信build entry |
| 建议方向 | 先由架构裁定runtime强制性，再独立实现明确状态机和行为测试 |
| 预计修改范围 | main/environment和测试 |
| 验证方式 | 404、HTML、500、网络断开、畸形JSON、host mismatch、已有/无build entry全矩阵 |
| 回滚方式 | 回退bootstrap错误策略提交 |
| 是否需要独立复核 | 否 |

## F-0086｜身份渠道切换丢弃跨节点 login_intent 与原查询上下文

| 字段 | 记录 |
| --- | --- |
| 模块 | Auth Web App |
| 类型 | 跨节点契约、导航状态 |
| 严重级别 | P2 |
| 置信度 | 高：query重建逻辑和intent读取点直接可证 |
| 文件和精确位置 | `App.tsx:21-31`；`identityNodeEnvironment.ts:79-91`；`canonicalIdentity.ts:302-320`；`canonicalRegistration.ts:195-220` |
| 当前行为 | [FACT][E-AU-019-007] switchAudience从零构造query，只保留consumer application/target或operator target；原`login_intent`、invite及其他上下文全部消失。后续currentLoginIntent读取新URL得到undefined |
| 预期行为 | 仍适用于目标渠道的短时跨节点意图必须被显式保留；不兼容字段应按契约决定而非全部静默丢弃 |
| 直接证据 | E-AU-019-007、INV-AU-019-004、FM-AU-019-004 |
| 调用链或运行入口 | IdentityAudienceSwitch→replaceState→canonical login/member request |
| 用户影响 | 跨节点用户切换管理员/会员后无法完成原登录，需返回源节点重发 |
| 数据影响 | 无直接数据错误 |
| 安全影响 | 不绕过验证；意图丢失导致fail closed/可用性问题 |
| 根因 | 页面分流参数和跨节点授权参数没有集中导航投影函数 |
| 建议方向 | 单独导航契约批次建立允许传播矩阵并补双向测试 |
| 预计修改范围 | App/entry helper/测试 |
| 验证方式 | 带单一合法intent双向切换后提交body保持；重复/畸形intent仍拒绝 |
| 回滚方式 | 回退单一query传播提交 |
| 是否需要独立复核 | 否 |

## F-0087｜Operator找回密码可显示新手机号却提交旧手机号challenge

| 字段 | 记录 |
| --- | --- |
| 模块 | Auth Web Operator |
| 类型 | 正确性、主体绑定 |
| 严重级别 | P2 |
| 置信度 | 高：受控字段和challenge状态转换直接可证；服务端绑定会缓解越权 |
| 文件和精确位置 | `OperatorIdentityPage.tsx:207-240,275-334`；`canonicalIdentity.ts:218-252` |
| 当前行为 | [FACT][E-AU-019-009] 验证码发出后同一表单的identifier仍可编辑，TextField onChange只setIdentifier；resetChallenge不清除。提交使用旧challenge/code但界面显示新identifier |
| 预期行为 | identifier改变必须废弃旧challenge，或验证码阶段锁定并明确显示challenge对应手机号 |
| 直接证据 | E-AU-019-009、INV-AU-019-005、FM-AU-019-005 |
| 调用链或运行入口 | sendResetCode(A)→setResetChallenge→edit identifier(B)→resetCanonicalPassword(old challenge) |
| 用户影响 | 拥有多个账号的用户可能误以为重置B，实际重置A；失败时也难解释 |
| 数据影响 | 可能修改错误的本人账号密码；服务端challenge防止重置无验证码账号 |
| 安全影响 | 未见越权路径，但主体展示与授权证据脱节 |
| 根因 | reset状态没有与identifier建立失效关系 |
| 建议方向 | 独立Operator reset UI状态批次；不改变服务端权限 |
| 预计修改范围 | Operator页和一个行为测试 |
| 验证方式 | A发码后改B必须清challenge/阻止提交；A正常重置仍通过 |
| 回滚方式 | 回退单一页面状态提交 |
| 是否需要独立复核 | 否 |

## F-0088｜Auth CSRF重试为同一逻辑操作生成新的幂等键

| 字段 | 记录 |
| --- | --- |
| 模块 | Auth canonical clients |
| 类型 | 重试、幂等 |
| 严重级别 | P3 |
| 置信度 | 高：key在request closure内部生成；当前重试只针对handler前CSRF拒绝是缓解项 |
| 文件和精确位置 | `canonicalIdentity.ts:389-411`；`canonicalRegistration.ts:247-277`；对应retry tests |
| 当前行为 | [FACT][E-AU-019-010] 每次request调用都新建idempotency-key和x-request-id；CSRF invalid重试因此不再是同一幂等身份。测试只断言次数，不比较键 |
| 预期行为 | 同一用户动作的传输重试应保持稳定幂等键，并明确request-id是否按attempt变化 |
| 直接证据 | E-AU-019-010、FM-AU-019-006 |
| 调用链或运行入口 | identityRequest request()→403 CSRF→request() |
| 用户影响 | 现有服务在handler前拒绝通常不会重复写；若边界变化或错误响应，重复保护减弱 |
| 数据影响 | 目前仅最坏情形；未证实重复session/member写入 |
| 安全影响 | 无直接授权扩大 |
| 根因 | 逻辑operation metadata与attempt metadata在同一closure内生成 |
| 建议方向 | 独立客户端幂等批次稳定key并补反事实；先确认服务端CSRF时序 |
| 预计修改范围 | 两个canonical request helper和测试 |
| 验证方式 | retry前后幂等键相同、request-id策略明确；后端只执行一次 |
| 回滚方式 | 回退单一幂等提交 |
| 是否需要独立复核 | 否 |

## F-0089｜共享Auth制品在L1仍声明L0 canonical与社交预览地址

| 字段 | 记录 |
| --- | --- |
| 模块 | Auth Web HTML metadata |
| 类型 | 多节点品牌/SEO契约 |
| 严重级别 | P3 |
| 置信度 | 高：HTML常量与双target发布映射直接可证 |
| 文件和精确位置 | `index.html:13-18`；release/remote policy的L0/L1 auth-web target |
| 当前行为 | [FACT][E-AU-019-011] canonical、og:url和og:image固定`accounts.fufu.wang`，同一dist也发布给`accounts.hbbtzn.com` |
| 预期行为 | 每个身份节点应声明自身可审计的canonical/preview metadata，或明确共享品牌策略 |
| 直接证据 | E-AU-019-011 |
| 调用链或运行入口 | Vite build→共享dist→L0/L1 accounts host→crawler/browser head |
| 用户影响 | L1链接分享与搜索归属指向L0，品牌和入口识别错误 |
| 数据影响 | 无 |
| 安全影响 | 不改变登录请求；可能降低用户识别正确域名的能力 |
| 根因 | 可重定位bundle只处理资源base，未处理host-specific metadata |
| 建议方向 | 由品牌/节点策略决定运行时或发布时metadata投影，独立验证两host |
| 预计修改范围 | HTML/build/runtime注入和发布检查 |
| 验证方式 | 两节点抓取head并核对canonical/OG与资源可达性 |
| 回滚方式 | 回退metadata投影提交 |
| 是否需要独立复核 | 否 |

## F-0090｜Auth测试不能证明当前双页面和bootstrap关键失败行为

| 字段 | 记录 |
| --- | --- |
| 模块 | Auth Web tests |
| 类型 | 测试可信度、覆盖缺口 |
| 严重级别 | P3 |
| 置信度 | 高：test include、测试对象和mock边界逐文件核对 |
| 文件和精确位置 | `vitest.config.ts:18-25`；`main.test.ts:4-11`；`OperatorIdentityPage.test.ts:49-74`；`canonicalIdentity.test.ts`；`canonicalRegistration.test.ts`；无Consumer test |
| 当前行为 | [FACT][E-AU-019-012] main测试只比较源码字符串位置；现行Operator页仅2例，Consumer页0例；canonical tests全量mock fetch且没有畸形2xx，既有F-0007不会使测试失败。大量auth.test验证当前无入口的legacy链 |
| 预期行为 | 当前App分流、runtime状态机、Consumer/Operator核心提交、畸形成功响应和主体切换应由行为测试证明 |
| 直接证据 | E-AU-019-012、TC-AU-019-001/002 |
| 调用链或运行入口 | package test→vitest include src/**/*.test.ts；当前环境因缺vitest未执行 |
| 用户影响 | 入口或契约回归可能在测试仍绿时进入制品 |
| 数据影响 | 测试本身不写业务数据 |
| 安全影响 | F-0083等敏感目的地边界没有客户端拒绝测试 |
| 根因 | UI迁移后测试重心仍在legacy/canonical helper，bootstrap采用源码文本oracle |
| 建议方向 | 后续按bootstrap、Consumer、Operator、schema分别补最小行为测试，不与生产修复混批 |
| 预计修改范围 | 测试文件；必要时极小可测试性接缝 |
| 验证方式 | 逐个反事实可在破坏实现时稳定失败；浏览器集成验证真实fetch/redirect边界 |
| 回滚方式 | 回退各单一测试批次 |
| 是否需要独立复核 | 否 |

## 19. AU-019 新增未定级事项

- [UNKNOWN] live `identity-runtime.json`、当前线上Auth bundle与CORS接收方；本AU未访问线上。
- [UNKNOWN] Ethan现行批准的是LoginPage还是Consumer/Operator双页，继续保留F-0005分歧。

## F-0091｜支付密钥只校验PEM外壳，畸形DER延迟到首笔请求才失败

| 字段 | 记录 |
| --- | --- |
| 模块 | 微信支付配置/密码学 |
| 类型 | 配置正确性、可用性、错误契约 |
| 严重级别 | P2 |
| 置信度 | 高：源码与合成WebCrypto反事实均直接证明 |
| 文件和精确位置 | `01_core_hexin/extensions/payment/wechat/src/Config.ts:45-63,94-100,125-130`；`Crypto.ts:49-63` |
| 当前行为 | [FACT][E-AU-020-007] `loadWechatPayConfig`仅用BEGIN/END和base64字符正则接受PKCS8/SPKI；合成`AAAA`正文通过正则，但WebCrypto importKey均抛`DataError: Invalid keyData` |
| 预期行为 | 启动读取secret时应证明密钥可由当前运行时导入，错误应保持稳定配置错误码 |
| 直接证据 | E-AU-020-007、TC-AU-020-003/004 |
| 调用链或运行入口 | 三个runtime load config成功→进程ready→首个prepay签名或provider响应/通知验签→原始DataError |
| 用户影响 | 配置或轮换错误不能在启动门禁被发现，支付创建、查询、退款或回调可能在真实流量到达后才失败 |
| 数据影响 | 未证明资金状态写错；失败主要阻断支付状态推进并造成延迟 |
| 安全影响 | 没有证明私钥泄露或伪造；失效模式为拒绝服务和诊断失真 |
| 根因 | 配置层只检查文本容器，密钥语义导入留到每次操作 |
| 建议方向 | 后续独立批次在配置装配/启动阶段预导入或执行不泄密的可用性验证，并统一错误码；不在审计分支实施 |
| 预计修改范围 | Config/Crypto、三个runtime启动测试、密钥轮换测试 |
| 验证方式 | 合法PKCS8/SPKI可启动；外壳合法但DER畸形在ready前以配置错误失败；真实签名/验签回归通过 |
| 回滚方式 | 回退单一密钥预检提交并恢复原secret版本 |
| 是否需要独立复核 | 否 |

## F-0092｜响应头之后的正文超时和断流绕过支付Transport重试分类

| 字段 | 记录 |
| --- | --- |
| 模块 | 微信支付Transport / Executor |
| 类型 | 超时、重试、断路器、错误传播 |
| 严重级别 | P2 |
| 置信度 | 高：catch边界和本地响应流探针直接证明 |
| 文件和精确位置 | `01_core_hexin/extensions/payment/wechat/src/Transport.ts:64-94,97-131`；`services/commerce/.../WechatGateway.ts:107-111` |
| 当前行为 | [FACT][E-AU-020-008] fetch取得响应头前的错误会转换为retryable `WechatPayProtocolError`；之后`readBoundedBody`的`reader.read()`在超时/断流时抛原始异常。Gateway只把retryable ProtocolError计入重试/断路器 |
| 预期行为 | 同一请求deadline覆盖完整响应消费，所有网络/超时阶段应映射为一致、可审计的基础设施错误 |
| 直接证据 | E-AU-020-008、TC-AU-020-005 |
| 调用链或运行入口 | Purchase/Jobs→WechatGateway.execute→Transport.send→headers成功→body stall→raw TimeoutError→Executor不可重试且不计circuit failure |
| 用户影响 | 短暂网络或provider流中断会过早失败；查询类失去设计中的安全重试，支付/退款状态恢复延后 |
| 数据影响 | 没有证明重复写；退款写仍不会被盲重试，但其查询恢复可被中断 |
| 安全影响 | 无直接授权或签名绕过；异常发生在验签前，结果不会被信任 |
| 根因 | try/catch只包围fetch promise，没有包围响应体读取与验签前传输阶段 |
| 建议方向 | 后续独立Transport批次统一映射body read的abort/network错误，同时保留too-large/encoding等既有ProtocolError |
| 预计修改范围 | Transport和定向stream/deadline测试；Gateway无需改变业务语义 |
| 验证方式 | headers前、headers后、外部取消、deadline、断流结果矩阵；read模式重试，write模式不盲重试，断路器计数一致 |
| 回滚方式 | 回退单一Transport错误映射提交 |
| 是否需要独立复核 | 否 |

## F-0093｜公共支付Client允许未验证的单次回调地址覆盖安全配置

| 字段 | 记录 |
| --- | --- |
| 模块 | 微信支付Client API |
| 类型 | 契约边界、配置一致性 |
| 严重级别 | P3 |
| 置信度 | 高：序列化路径与全部仓内生产caller已核对 |
| 文件和精确位置 | `01_core_hexin/extensions/payment/wechat/src/Client.ts:6-14,26-33,40-48,68-75,91-126`；`Config.ts:137-143`；`WechatGateway.ts:23-33,67-75` |
| 当前行为 | [FACT][E-AU-020-009] prepay/refund输入可提供`notifyUrl`，validation不检查它，正文直接优先使用该值。当前生产Gateway始终传`resolveWechatPayNotifyUrl`结果，三个runtime再绑定Manifest host/scope |
| 预期行为 | 包的公共请求API不应提供绕过自身callback配置不变量的路径，或必须对override执行同一验证 |
| 直接证据 | E-AU-020-003/009、TC-AU-020-006 |
| 调用链或运行入口 | 任意直接Client caller→input.notifyUrl→微信请求notify_url；当前生产链由Gateway约束 |
| 用户影响 | 当前仓内生产路径无已证实影响；未来或仓外直接caller可能把通知送往错误地址而导致状态停滞 |
| 数据影响 | 可能造成通知未进入本地状态机；没有证明已发生数据错误 |
| 安全影响 | 微信通知正文为签名加密载荷，未证明明文凭据泄露；错误目的地仍是配置边界破坏 |
| 根因 | 配置URL验证是私有函数，Client把caller override视为已可信 |
| 建议方向 | 后续单一API契约批次移除override或复用相同验证；先确认是否有仓外消费者 |
| 预计修改范围 | Client/Config导出边界和测试；生产Gateway调用可简化但不应同批扩项 |
| 验证方式 | 非HTTPS、私网、错误path、query/hash和非Manifest callback反事实；生产scoped callback保持不变 |
| 回滚方式 | 回退单一Client契约提交 |
| 是否需要独立复核 | 否 |

## 20. AU-020 新增未定级事项

- [UNKNOWN] 线上支付secret是否包含可导入密钥、平台轮换状态、真实provider超时分布和当前运行制品版本；本AU未访问线上。

## F-0094｜通用Provider Webhook签名未绑定event ID，可改ID绕过去重

| 字段 | 记录 |
| --- | --- |
| 模块 | Provider Core / Channel Webhook |
| 类型 | 重放保护、消息身份、异步幂等 |
| 严重级别 | **P1 候选**；未完成RV-0013前不作最终P1 |
| 置信度 | 高：签名材料、request类型、route和数据库唯一键均直接可证；线上启用协议与下游最终影响未知 |
| 文件和精确位置 | `01_core_hexin/extensions/providers/core/src/PortFactory.ts:36-53`；`packages/contract/src/provider/Ports.ts:39-57`；`services/commerce/.../ApplyWebhook.ts:18-39`；`02_platform_pingtai/database/supabase/migrations/20260821044000_channel_lifecycle.sql:6-59` |
| 当前行为 | [FACT][E-AU-021-005/006] HMAC仅覆盖`timestamp.body`；`x-provider-event-id`不在Verifier request或签名材料内，却是`unique(connection_id,external_id)`唯一去重身份。5分钟内保持正文/时间戳/签名不变、只换ID即可再次验签并插入新inbox/job/outbox |
| 预期行为 | 被持久化为消息身份并驱动幂等的event ID必须受可信签名绑定，或数据库还需按签名覆盖的稳定内容阻止同体改ID重放 |
| 直接证据 | E-AU-021-004–006、TC-AU-021-003/004 |
| 调用链或运行入口 | 公网channel webhook→ApplyWebhook→createPorts webhook verify→KMS→channel.accept_webhook→ChannelWebhookJob→runtime.outbox |
| 用户影响 | [INFERENCE] 攻击者或错误网关可在窗口内制造重复渠道状态事件；重复通知、任务和运营记录会增加，具体业务动作取决于下游consumer |
| 数据影响 | 新inbox和outbox必然可产生；provideroperation同reference会覆盖状态。是否进一步重复履约/退款尚未完成下游复核 |
| 安全影响 | 可绕过设计中的消息重放去重，但仍需取得一份合法签名请求；不构成无密钥任意伪造 |
| 根因 | 验签契约与持久化幂等契约分别设计，event ID没有进入被认证消息 |
| 建议方向 | 后续独立批次先按真实provider协议决定签名绑定event ID、从已签正文派生ID或增加raw/signature稳定去重；不得统一假设所有provider协议相同 |
| 预计修改范围 | ProviderWebhookRequest/PortFactory、provider-specific verifier、ApplyWebhook/数据库约束和反事实测试；可能需分provider迁移 |
| 验证方式 | 同请求同ID重放、改ID重放、同ID不同body碰撞、时间窗边界、合法provider重试、并发双投矩阵；核对每个下游consumer只产生一次可观察效果 |
| 回滚方式 | 修复批次保留原header/DB键兼容窗口和迁移回滚方案；本审计未实施 |
| 是否需要独立复核 | 是，RV-0013 |

为什么不是P0：没有证据显示该重放正在造成严重线上、资金或安全事故，也未确认哪些provider在线启用和下游是否有额外幂等。按定义只能保留P1候选。

## F-0095｜Provider Core唯一Webhook测试没有命中生产验签实现

| 字段 | 记录 |
| --- | --- |
| 模块 | Provider Core tests / Webhook |
| 类型 | 测试可信度、平行实现 |
| 严重级别 | P3 |
| 置信度 | 高：测试import与生产factory/route调用链全仓核对 |
| 文件和精确位置 | `01_core_hexin/extensions/providers/core/src/Provider.test.ts:37-50`；`src/Webhook.ts:3-23`；`src/PortFactory.ts:36-53` |
| 当前行为 | [FACT][E-AU-021-007] 测试构造`src/Webhook.ts`，其request含externalId且verifier收到完整request；生产使用Contract `ProviderWebhookVerifier`，request不含externalId，实际HMAC在PortFactory内且没有测试 |
| 预期行为 | 生产HMAC材料、时间窗、header格式、normalize、event ID与数据库去重关系应由反事实测试直接覆盖 |
| 直接证据 | E-AU-021-007/008、TC-AU-021-005 |
| 调用链或运行入口 | npm test→Provider.test→非生产Webhook；生产factory→createPorts webhook完全未执行 |
| 用户影响 | 测试可保持绿色而F-0094等生产重放缺陷存在，降低发布门禁可信度 |
| 数据影响 | 测试本身不写业务数据；间接遗漏重复inbox/outbox风险 |
| 安全影响 | 重放边界没有测试保护 |
| 根因 | 早期Webhook ingress wrapper与后续Channel route/contract并行保留，测试未迁移到真实入口 |
| 建议方向 | 后续测试批次直接实例化createPorts verifier并跨ApplyWebhook/DB contract验证；旧wrapper去留另做候选复核 |
| 预计修改范围 | Provider Core测试与Channel集成测试 |
| 验证方式 | 破坏timestamp/body/event ID任一受信字段时测试稳定失败；重复投递只产生一个效果 |
| 回滚方式 | 回退单一测试批次 |
| 是否需要独立复核 | 否；F-0094本身需要 |

## 21. AU-021 新增未定级事项

- [UNKNOWN] 线上启用provider及其真实Webhook网关是否用其它层绑定event ID；需RV-0013重新追踪。
- [UNKNOWN] F-0094产生的重复outbox下游是否全部幂等；当前只证明消息重复可观察，不扩大为资金重复事实。

## F-0096｜Vendor连接可把签名请求发送到任意HTTPS来源

| 字段 | 记录 |
| --- | --- |
| 模块 | Vendor Core / Channel Connection |
| 类型 | 信任边界、目的地绑定、凭据使用 |
| 严重级别 | **P1 候选**；未完成RV-0014前不作最终P1 |
| 置信度 | 高：配置写入、安装校验、运行装载和请求发送链均已核对；线上值、出口策略和secret ACL未知 |
| 文件和精确位置 | `01_core_hexin/extensions/vendors/core/src/Connection.ts:12-21`；`src/Client.ts:68-93`；`services/commerce/src/modules/channel/03_application_yingyong/command/CreateConnection.ts:14-70`；`services/commerce/src/modules/extension/03_application_yingyong/command/InstallExtension.ts:24-70`；`packages/authz/src/PermissionCatalog.ts:48` |
| 当前行为 | [FACT][E-AU-022-004/005] connection只要求baseUrl可解析且协议为HTTPS；未与provider Manifest或批准主机绑定，也未排除userinfo、回环、私网和链路本地地址。持有`channel.connection.manage`的critical operator可同时选择secretRef和任意HTTPS目的地，health与业务请求会向其发送认证证明及业务正文 |
| 预期行为 | provider连接的网络目的地应与被安装provider的可信清单绑定；secret选择权不应隐式扩大为任意外发能力 |
| 直接证据 | E-AU-022-003–006、TC-AU-022-002/003 |
| 调用链或运行入口 | channel.connections.create/update→secrets.read→数据库connection→RuntimeExtensionLoader→VendorClient→new URL(path,baseUrl)→认证请求 |
| 用户影响 | [INFERENCE] 被误配或滥用时可使商品、订单或履约调用发往错误服务，并造成渠道不可用 |
| 数据影响 | 业务请求正文可能离开预期provider边界；未证明线上已发生 |
| 安全影响 | HMAC签名或RSA签名证明、请求标识和业务载荷会发送到所配来源；私钥本身不会被发送 |
| 根因 | 配置把HTTPS当成完整信任判据，Manifest没有声明/约束实际网络来源 |
| 建议方向 | 后续独立设计批次按provider声明批准origin，并核对代理、区域端点和测试环境需求；不得在审计分支实施 |
| 预计修改范围 | Manifest/connection contract、安装与更新命令、Runtime loader、迁移兼容和网络反事实测试 |
| 验证方式 | 批准origin、错误host、userinfo、loopback/private/link-local、重定向、IPv6和既有连接迁移矩阵；确认真实provider端点兼容 |
| 回滚方式 | 保留旧连接配置与兼容读取，按provider灰度；回退单一治理提交 |
| 是否需要独立复核 | 是，RV-0014 |

为什么不是P0：没有证据显示线上连接已被恶意或错误绑定，也没有正在发生的严重事故；critical权限、secret ACL和出口网络仍是待核实缓解项。

## F-0097｜通用Vendor响应没有字节与JSON深度上限

| 字段 | 记录 |
| --- | --- |
| 模块 | Vendor Core HTTP Client |
| 类型 | 资源耗尽、外部输入边界 |
| 严重级别 | **P1 候选**；未完成RV-0015前不作最终P1 |
| 置信度 | 高：响应读取与递归校验实现已直接核对；线上内存限制和provider行为未知 |
| 文件和精确位置 | `01_core_hexin/extensions/vendors/core/src/Client.ts:31-112,121-129`；`extensions/vendors/cakeuncle/src/Client.ts:95-140,160-188` |
| 当前行为 | [FACT][E-AU-022-007/008] Client对响应直接执行无上限`response.text()`，随后JSON.parse并递归验证任意深度对象/数组；无Content-Length、流式字节或嵌套深度限制。独立Cakeuncle Client已有2MiB读取上限，不能保护通用Client |
| 预期行为 | 外部响应在分配完整正文和递归遍历前应有共享字节上限，并对JSON深度/节点数量设置可预期边界 |
| 直接证据 | E-AU-022-007–009、TC-AU-022-004/005 |
| 调用链或运行入口 | Commerce provider operation→VendorClient.request→fetch→response.text→JSON.parse→assertJsonValue |
| 用户影响 | [INFERENCE] 异常或受控provider响应可造成单次请求高内存、栈溢出或进程重启，影响共用Commerce运行单元 |
| 数据影响 | 请求可能在远端已成功、本地解析前失败，造成不确定状态和重试恢复压力；未证明实际数据错误 |
| 安全影响 | 属于已认证外部依赖可触发的可用性边界，不是无网络路径的本地输入 |
| 根因 | deadline只限制时间，响应数据模型校验没有容量预算 |
| 建议方向 | 后续共享Transport批次引入流式限额、深度/节点预算和稳定错误分类；按读/写重试语义分别验证 |
| 预计修改范围 | Vendor Core Client、错误分类、各vendor契约测试；Cakeuncle是否统一另行决定 |
| 验证方式 | 超Content-Length、chunked超限、深层对象/数组、无效UTF-8、读/写与幂等重试矩阵、内存受限进程探针 |
| 回滚方式 | 回退单一Transport提交并恢复旧读取路径 |
| 是否需要独立复核 | 是，RV-0015 |

为什么不是P0：没有证据显示线上provider正在返回超大/超深响应，亦未证明当前运行进程发生OOM或严重事故。

## F-0098｜Vendor Core测试未覆盖主要信任与恢复边界

| 字段 | 记录 |
| --- | --- |
| 模块 | Vendor Core tests |
| 类型 | 测试可信度、契约缺口 |
| 严重级别 | P3 |
| 置信度 | 高：全部11文件与正式脚本已核对 |
| 文件和精确位置 | `01_core_hexin/extensions/vendors/core/src/Client.test.ts:17-53`；`package.json:6-12` |
| 当前行为 | [FACT][E-AU-022-010] 4个用例只覆盖未声明operation、503读取重试、无幂等键写入不重试和circuit open；没有baseUrl、HMAC/RSA、双阶段超时、响应限额/深度、有幂等键写入和取消测试 |
| 预期行为 | 生产信任边界、签名材料、恢复语义和外部输入容量必须有反事实测试，且破坏实现会稳定失败 |
| 直接证据 | E-AU-022-010/011、TC-AU-022-006 |
| 调用链或运行入口 | npm test→Vitest→Client.test；当前审计环境缺vitest，正式入口127退出 |
| 用户影响 | F-0096/F-0097及签名、超时回归可能在现有测试绿色时进入共享Commerce制品 |
| 数据影响 | 测试本身不写数据；间接遗漏不确定写入与重复调用风险 |
| 安全影响 | 目的地和认证证明边界没有测试保护 |
| 根因 | 测试集中在重试/circuit最小主路径，未把连接和外部输入视作端到端契约 |
| 建议方向 | 后续测试批次先补反事实矩阵，再分别治理实现；审计不修改测试 |
| 预计修改范围 | Vendor Core单测及Channel/Runtime装载集成测试 |
| 验证方式 | 每个信任或恢复不变量均有破坏性断言；在正式workspace入口运行 |
| 回滚方式 | 回退单一测试提交 |
| 是否需要独立复核 | 否；F-0096/F-0097本身需要 |

## 22. AU-022 新增未定级事项

- [UNKNOWN] 线上connection的实际baseUrl、secretRef授权边界、节点出口策略和当前制品版本；需RV-0014核对。
- [UNKNOWN] Commerce运行单元内存/栈限制及真实vendor最大响应分布；需RV-0015核对。

## F-0099｜Cakeuncle限长响应仍可由深层JSON击穿递归校验

| 字段 | 记录 |
| --- | --- |
| 模块 | Cakeuncle Vendor Client |
| 类型 | 外部输入边界、错误分类、可用性 |
| 严重级别 | P2 |
| 置信度 | 高：实现与合成反事实均复核 |
| 文件和精确位置 | `01_core_hexin/extensions/vendors/cakeuncle/Client.ts:118-140,169-188,221-229` |
| 当前行为 | [FACT][E-AU-023-003/004] 正文限制2MiB，但JSON.parse后用互相递归的`isJsonObject/isJsonValue`遍历，无深度/节点预算。5,000层、30,004字节的合法JSON触发RangeError；catch把它映射为retryable `VENDOR_TRANSPORT_FAILED`，读调用会重试并计入circuit |
| 预期行为 | 容量预算应同时限制字节、嵌套深度和节点数量；结构过深应稳定拒绝且不伪装成瞬态网络故障 |
| 直接证据 | E-AU-023-003/004、TC-AU-023-003 |
| 调用链或运行入口 | 4个Cakeuncle provider→Client.send→readLimited→JSON.parse→isJsonObject→asVendorFailure→retry/circuit |
| 用户影响 | 异常provider响应可让一次读取重复失败并打开该connection断路器，暂时阻断正常catalog/price/stock调用 |
| 数据影响 | 当前消费者主要是读取；Foodvoucher写链另见F-0100。未证明持久化数据损坏 |
| 安全影响 | 已认证外部依赖可触发有界请求失败；RangeError被catch，没有证据证明进程崩溃 |
| 根因 | 2MiB字节限额被当成完整结构复杂度限额，递归校验没有独立预算 |
| 建议方向 | 后续单一Client批次增加迭代式校验或深度/节点预算，并稳定映射为不可重试响应错误 |
| 预计修改范围 | Cakeuncle Client与定向测试；不与通用Vendor Core F-0097混改 |
| 验证方式 | 字节×深度×节点矩阵、读重试/circuit计数、正常最大provider响应和内存受限探针 |
| 回滚方式 | 回退单一Cakeuncle Client提交 |
| 是否需要独立复核 | 否 |

## F-0100｜Foodvoucher生产端重新暴露Cakeuncle明确禁用的写入与Webhook能力

| 字段 | 记录 |
| --- | --- |
| 模块 | Cakeuncle Vendor / Foodvoucher Provider边界 |
| 类型 | 能力契约、协议错配、运行入口 |
| 严重级别 | **P1 候选**；未完成RV-0016前不作最终P1 |
| 置信度 | 高：包声明、barrel、provider manifest/factory和通用ports均直接可证；线上启用状态及供应商最新协议未知 |
| 文件和精确位置 | `01_core_hexin/extensions/vendors/cakeuncle/README.md:14-27`；`index.ts:1-7`；`Webhook.ts:6-51`；`extensions/providers/foodvoucher/manifest.ts:4-19`；`Provider.ts:6-16`；`extensions/providers/core/src/PortFactory.ts:20-53,72-97` |
| 当前行为 | [CONFLICT][E-AU-023-005/006/007] Cakeuncle包声明Foodvoucher仅Catalog/Price，Card issuance与Webhook因HTTP、unsigned callback和加密契约不完整而禁用，专用Webhook也未导出；但生产Foodvoucher manifest宣称Issue/Bind/Verify/Void/Extend/Refund/Statement/Webhook，factory用通用createPorts注册order/cancel/refund/statement/verification及header-HMAC Webhook |
| 预期行为 | 生产manifest、ports、传输协议和包级禁用边界必须闭合；未经验证的远端写入与回调不得被Registry宣称可用 |
| 直接证据 | E-AU-023-005–007、TC-AU-023-005 |
| 调用链或运行入口 | RuntimeExtensionLoader→FoodvoucherProvider.create→CakeuncleClient+createPorts→Registry scope→业务写入/Channel webhook |
| 用户影响 | [INFERENCE] 若installation启用，卡券发行、作废、退款、核销或通知可能系统性失败；错误暴露的能力也会误导上游调度 |
| 数据影响 | 非幂等写入失败会返回outcome unknown；真实远端是否受理取决于未核协议，不能写成重复发行或资金损失事实 |
| 安全影响 | 通用header-HMAC与已知Cakeuncle body签名/unsigned callback模型不一致；专用实现又证明payload未受签名保护 |
| 根因 | 通用Provider能力模板绕过了vendor-specific发布决策，manifest与transport成熟度没有单一事实源 |
| 建议方向 | 后续Foodvoucher专项先只读核实线上启用和正式协议，再收敛manifest/ports；不要直接启用专用Webhook或补写入实现 |
| 预计修改范围 | Foodvoucher manifest/factory/operations、Cakeuncle协议适配、Registry契约测试；可能需分多个小批次 |
| 验证方式 | 独立复核capability→scope→caller全链，使用合成/供应商沙箱验证每个operation和callback；线上只读确认enabled状态 |
| 回滚方式 | 保留当前manifest签名与installation快照；治理批次按单能力回退 |
| 是否需要独立复核 | 是，RV-0016 |

为什么不是P0：没有证据显示Foodvoucher线上已启用或正在造成重大发行、资金、数据或安全事故；当前只证明固定代码的能力契约冲突。

## F-0101｜Cakeuncle包未声明直接使用的Contract类型依赖

| 字段 | 记录 |
| --- | --- |
| 模块 | Cakeuncle Vendor package |
| 类型 | 依赖边界、隔离构建 |
| 严重级别 | P3 |
| 置信度 | 高：package与源码import直接核对 |
| 文件和精确位置 | `01_core_hexin/extensions/vendors/cakeuncle/package.json:7-10`；`Client.ts:2`；`Webhook.ts:2` |
| 当前行为 | 源码直接import `@shop/contract`类型，package只声明`@shop/vendorcore`；当前工作区可依赖提升或传递依赖解析 |
| 预期行为 | 每个workspace声明自身直接源码依赖，使隔离类型检查和依赖图可复现 |
| 直接证据 | E-AU-023-008/010 |
| 调用链或运行入口 | workspace typecheck/build→TS module resolution |
| 用户影响 | 独立安装、缓存布局或依赖收紧时可能出现类型解析失败；当前正式typecheck因工具缺失未验证 |
| 数据影响 | 无直接数据影响 |
| 安全影响 | 无直接安全影响 |
| 根因 | type-only依赖在hoisted workspace中可见，未进入包清单 |
| 建议方向 | 后续依赖清单小批次显式声明并验证锁文件；审计不修改依赖/锁文件 |
| 预计修改范围 | package.json、lockfile和隔离typecheck |
| 验证方式 | clean isolated workspace typecheck与根workspace影响检查 |
| 回滚方式 | 回退单一依赖声明提交 |
| 是否需要独立复核 | 否 |

## F-0102｜Cakeuncle测试没有覆盖生产能力接线与深度故障

| 字段 | 记录 |
| --- | --- |
| 模块 | Cakeuncle Vendor tests |
| 类型 | 测试可信度、契约缺口 |
| 严重级别 | P3 |
| 置信度 | 高：4个测试文件及直接生产消费者已核对 |
| 文件和精确位置 | `01_core_hexin/extensions/vendors/cakeuncle/tests/Auth.test.ts:1-8`；`Client.test.ts:1-77`；`Signer.test.ts:1-24`；`Webhook.test.ts:1-39` |
| 当前行为 | 14个用例覆盖签名向量、基础Client和被禁用Webhook，但不验证公共barrel、Foodvoucher真实ports、深度/节点限额、chunked超限、双阶段超时/取消和读取重试次数 |
| 预期行为 | 测试应命中真实发布能力，并让F-0099/F-0100类边界破坏稳定失败 |
| 直接证据 | E-AU-023-006/009/010、TC-AU-023-001–006 |
| 调用链或运行入口 | npm test→package tests；生产Foodvoucher factory与Runtime registry不在套件内 |
| 用户影响 | 不安全或不可用能力可在包内测试保持绿色时进入Commerce制品 |
| 数据影响 | 测试本身不写数据；间接遗漏远端写入不确定状态 |
| 安全影响 | payload未签名与生产header-HMAC协议冲突没有端到端门禁 |
| 根因 | 单元测试按文件能力编写，没有以发布manifest/ports为验证对象 |
| 建议方向 | 后续测试批次增加跨包契约和容量反事实；不在审计分支修复 |
| 预计修改范围 | Cakeuncle与Foodvoucher tests、provider contract suite |
| 验证方式 | 破坏export/capability/signature/depth任一不变量时测试失败；正式workspace入口执行 |
| 回滚方式 | 回退单一测试提交 |
| 是否需要独立复核 | 否；F-0100本身需要 |

## 23. AU-023 新增未定级事项

- [UNKNOWN] Foodvoucher线上enabled installation、真实Cakeuncle协议版本、base URL与callback来源；需RV-0016核对。
- [UNKNOWN] 被禁用Webhook/H5/Card签名是否仍承担仓外兼容或供应商对接证据；需RV-0017核对。

## F-0100｜AU-024调用链复核补充

[FACT][E-AU-024-003–005] 第二条链路从全部生产`ExtensionRegistry.require` caller反向复核后，收窄AU-023表述：Foodvoucher Provider对象确实包含6个业务port和Webhook，但当前固定caller中只有Catalog、Statement、Webhook在manifest词汇下可达；Fulfillment固定请求`Order/order`，会被只有`Issue`的manifest拒绝，cancel/refund/verification没有找到固定静态caller。风险仍成立于错误能力表面和三个可达链，不把“对象有port”夸大为“所有写入正在运行”。RV-0016仍需第二位独立评审者和线上只读证据。

## F-0103｜Required Foodvoucher丢失已知只读适配，health无法证明业务可用

| 字段 | 记录 |
| --- | --- |
| 模块 | Foodvoucher Provider / Cakeuncle Catalog |
| 类型 | 业务契约、能力回归、健康检查 |
| 严重级别 | **P1 候选**；未完成RV-0018前不作最终P1 |
| 置信度 | 中高：当前代码、当前包声明和祖先专用契约闭合；供应商最新协议与线上enabled状态未知 |
| 文件和精确位置 | `01_core_hexin/extensions/providers/foodvoucher/Provider.ts:6-16`；`Mapper.ts:1`；`manifest.ts:4-19`；`extensions/providers/core/src/PortFactory.ts:56-65`；`Mapper.ts:11-17,31-34`；`extensions/vendors/cakeuncle/README.md:7-27`；`Client.ts:51-63,159-164` |
| 当前行为 | [CONFLICT][E-AU-024-006–008] 当前Catalog通用port读取`value.records`并要求canonical字段，Price完全不存在；Cakeuncle Client只剥离business error而返回原始envelope。当前README与同仓祖先专用实现记录Foodvoucher产品响应为`code/msg/data`并要求Catalog/Price。Provider health只探connection.healthOperation，不执行catalog/price mapping，因此可健康启动后首个业务调用失败 |
| 预期行为 | required/available provider至少应让声明启用的Catalog/Price通过真实供应商响应和启动canary；不能用单独health endpoint替代业务契约验证 |
| 直接证据 | E-AU-024-002/006–009、TC-AU-024-003–006 |
| 调用链或运行入口 | ChannelSyncJob Catalog/Price→Registry→FoodvoucherProvider→CakeuncleClient→generic Mapper；Loader register→Client.health仅探health operation |
| 用户影响 | [INFERENCE] 若installation启用，食品提货券目录或价格无法进入商城；Catalog作业失败重试，Price在Registry直接缺能力 |
| 数据影响 | 主要造成源目录/价格缺失或停滞；没有证据显示既有数据被覆盖或删除 |
| 安全影响 | 无新增凭据泄露事实；与F-0100 Webhook/写入协议边界相邻 |
| 根因 | 冲突收口选择了通用Provider模板，删除了vendor-specific mapper/ports/tests，同时未让health覆盖业务operation |
| 建议方向 | 后续专项先核供应商现行协议与产品决定，再只恢复被确认的最小只读能力；写入/Webhook另批处理 |
| 预计修改范围 | Foodvoucher Provider/Mapper/manifest/tests与connection health canary；不得混入其他provider |
| 验证方式 | 供应商沙箱或录制fixture的Catalog/Price全链、畸形字段/重复ID/金额精度、health后首个operation；线上只读核enabled/run状态 |
| 回滚方式 | 单一只读适配提交可回退；保留现有installation与manifest版本迁移方案 |
| 是否需要独立复核 | 是，RV-0018 |

为什么不是P0：没有线上enabled、失败作业、用户影响规模或当前供应商响应的直接证据；不能从required清单和历史实现推断正在发生严重事故。

## F-0104｜Provider契约测试会把Foodvoucher能力错配判为可执行

| 字段 | 记录 |
| --- | --- |
| 模块 | Foodvoucher tests / Provider contract suite |
| 类型 | 测试假阳性、契约覆盖 |
| 严重级别 | P3 |
| 置信度 | 高：包测和根contract全部逻辑已核对 |
| 文件和精确位置 | `01_core_hexin/extensions/providers/foodvoucher/tests/Provider.test.ts:6-12`；`03_quality_ceshi/tests/contracts/providers.spec.ts:37-53`；`tests/contracts/providers/ProviderContract.ts:12-32,42-50` |
| 当前行为 | 包测只断言required ID和manifest签名。根contract遇到Issue等未映射capability时退回手写port列表，只断言`provider.has(port)`；不拒绝额外ports、不执行任何Foodvoucher operation，也不检查capability-port语义配对 |
| 预期行为 | required provider契约测试应由统一映射推导port，执行最小行为fixture，并拒绝未声明/未实现/多余能力 |
| 直接证据 | E-AU-024-009、TC-AU-024-006 |
| 调用链或运行入口 | root provider contract→factory.create→has only；package Vitest→manifest only |
| 用户影响 | F-0100/F-0103存在时质量门禁仍可保持绿色并宣称“executable contracts” |
| 数据影响 | 测试本身不写数据；间接遗漏目录、对账和Webhook停滞 |
| 安全影响 | generic Webhook协议错配没有被测试暴露 |
| 根因 | fallback用手写期望掩盖未定义capability映射，contract只测结构不测行为 |
| 建议方向 | 后续测试批次建立唯一capability-port映射与Foodvoucher fixture；不在审计分支修改 |
| 预计修改范围 | root provider contract和Foodvoucher tests |
| 验证方式 | 删除mapper、移除Price、增加额外port或改capability词汇时测试稳定失败；执行真实catalog response fixture |
| 回滚方式 | 回退单一测试提交 |
| 是否需要独立复核 | 否；相关P1候选需复核 |

## 24. AU-024 新增未定级事项

- [UNKNOWN] Foodvoucher线上是否enabled、最近Channel run/Job结果及当前供应商响应；审计未访问线上。
- [UNKNOWN] 产品最终选择是恢复只读Catalog/Price还是完整实现Issue/Bind/Verify/Void/Extend；历史文档不能替Ethan定稿。

## F-0105｜Cake分页接受非末页短页并静默漏商品

| 字段 | 记录 |
| --- | --- |
| 模块/类型 | Cake Catalog；分页正确性、数据完整性 |
| 严重级别/置信度 | P2；高 |
| 文件和位置 | `extensions/providers/cake/CakeuncleClient.ts:41-50,105-113,157-160` |
| 当前/预期行为 | [FACT][E-AU-025-003] 请求size=200，但total尚未完成时1–199条短页仍通过并直接进入下一页；非末页应满页或使用服务端cursor，否则失败关闭 |
| 证据/调用链 | TC-AU-025-003；Channel Catalog job→pullCatalog→productPage→assertPage→nextCursor |
| 用户/数据/安全影响 | 商品或spec可能静默漏导；不直接删除既有数据；无安全影响 |
| 根因/建议范围 | 只拒绝0条不完整页；后续独立分页批次补完整页不变量和测试 |
| 验证/回滚 | 1/199/200/末页/total变化矩阵；回退单一分页提交 |
| 独立复核 | 否 |

## F-0106｜Cake Price/Stock按key批次重复全量扫描供应商目录

| 字段 | 记录 |
| --- | --- |
| 模块/类型 | Cake Price/Inventory；通信放大、deadline |
| 严重级别/置信度 | P2；高 |
| 文件和位置 | `extensions/providers/cake/CakeuncleClient.ts:53-87`；`services/commerce/src/modules/channel/05_interface_jieru/job/ChannelSyncJob.ts:89-116` |
| 当前/预期行为 | [FACT][E-AU-025-004/005] 每次Price或Stock调用都拉categories并遍历最多10,000商品页；Channel每500 keys分批且两类run分开。应复用同步周期快照、点查或增量结果 |
| 调用链 | Channel run→500-key batch→Price/Stock→snapshot→全部叶分类/分页 |
| 用户/数据/安全影响 | 大目录下易超deadline、限流或断路，价格库存延迟；无已证实数据损坏或安全影响 |
| 根因/建议范围 | canonical key port与全目录供应商API直接适配；后续单独设计快照所有权和一致性 |
| 验证/回滚 | 供应商调用数、10k页、并发Price/Stock、过期快照矩阵；回退单一优化提交 |
| 独立复核 | 否 |

## F-0107｜Cake测试未覆盖分页短页与扫描放大

| 字段 | 记录 |
| --- | --- |
| 模块/类型 | Cake tests；测试缺口 |
| 严重级别/置信度 | P3；高 |
| 文件和位置 | `extensions/providers/cake/tests/CakeuncleClient.test.ts:14-68`；`Provider.test.ts:6-12` |
| 当前/预期行为 | 仅正常单页/空末页、映射和字段错误；应覆盖短页、跨页重复、deadline、10k上限、调用数和Channel job |
| 证据/调用链 | E-AU-025-008、TC-AU-025-001–004；npm test→Vitest（当前缺工具） |
| 影响 | F-0105/F-0106可在测试绿色时存在；无直接数据/安全写入 |
| 建议/范围 | 单一测试批次补分页和规模反事实，不混实现修改 |
| 验证/回滚 | 破坏分页/调用预算时测试失败；回退测试提交 |
| 独立复核 | 否 |

## 25. AU-025 新增未定级事项

- [UNKNOWN] 线上Cake目录页数、短页行为、Price/Stock运行频率和供应商限流指标；未访问线上。

## F-0108｜Flower分页接受非末页短页并静默漏商品

| 字段 | 记录 |
| --- | --- |
| 模块/类型 | Flower Catalog；分页正确性、数据完整性 |
| 严重级别/置信度 | P2；高 |
| 文件和位置 | `extensions/providers/flower/FlowerClient.ts:44-53,111-120,166-170` |
| 当前/预期行为 | [FACT][E-AU-026-003] 请求size=200，但total尚未完成时1–199条短页仍通过并按页号推进；非末页应满页、使用服务端cursor或失败关闭 |
| 证据/调用链 | TC-AU-026-003；Channel Catalog job→pullCatalog→productPage→assertPage→nextCursor |
| 用户/数据/安全影响 | 商品或spec可能静默漏导；不直接删除既有数据；无安全影响 |
| 根因/建议范围 | 只拒绝0条不完整页；后续独立分页批次补完整页不变量和测试 |
| 验证/回滚 | 1/199/200/末页/total变化矩阵；回退单一分页提交 |
| 独立复核 | 否 |

## F-0109｜Flower Price/Stock按key批次重复全量扫描供应商目录

| 字段 | 记录 |
| --- | --- |
| 模块/类型 | Flower Price/Inventory；通信放大、deadline |
| 严重级别/置信度 | P2；高 |
| 文件和位置 | `extensions/providers/flower/FlowerClient.ts:56-92`；`services/commerce/src/modules/channel/05_interface_jieru/job/ChannelSyncJob.ts:89-116` |
| 当前/预期行为 | [FACT][E-AU-026-004/005] 每次非空Price或Stock调用都拉categories并遍历最多10,000商品页；Channel每500 keys分批且两类run分开。应复用同步周期快照、点查或增量结果 |
| 调用链 | Channel run→500-key batch→Price/Stock→snapshot→全部叶分类/分页 |
| 用户/数据/安全影响 | 大目录下易超deadline、限流或断路，价格库存延迟；无已证实数据损坏或安全影响 |
| 根因/建议范围 | canonical key port与全目录供应商API直接适配；后续单独设计快照所有权和一致性 |
| 验证/回滚 | 供应商调用数、10k页、并发Price/Stock、过期快照矩阵；回退单一优化提交 |
| 独立复核 | 否 |

## F-0110｜Flower可发布低于售价的划线价并被下游拒绝

| 字段 | 记录 |
| --- | --- |
| 模块/类型 | Flower Catalog；跨模块价格契约 |
| 严重级别/置信度 | P2；高 |
| 文件和位置 | `extensions/providers/flower/Mapper.ts:137-173`；`services/commerce/src/modules/catalog/03_application_yingyong/CatalogProductImport.ts:89-92` |
| 当前/预期行为 | [FACT][E-AU-026-006/007] 任意非零market_price都成为compareMinor；Catalog要求其不低于amountMinor。Cake同协议实现已省略低值，Flower未应用同一规则 |
| 调用链 | Supplier product→FlowerMapper→Channel catalog record→CatalogProductImport |
| 用户/数据/安全影响 | 异常供应商价格可让目录导入失败或继续展示旧值；不直接产生越权或资金写入 |
| 根因/建议范围 | 同源适配器演进分叉；后续单独统一价格不变量并保留供应商反事实fixture |
| 验证/回滚 | market price为0、低于、等于、高于售价四态；回退单一Mapper提交 |
| 独立复核 | 否 |

## F-0111｜Flower关键Client与Mapper没有行为测试

| 字段 | 记录 |
| --- | --- |
| 模块/类型 | Flower tests；测试缺口 |
| 严重级别/置信度 | P3；高 |
| 文件和位置 | `extensions/providers/flower/tests/Provider.test.ts:1-13`；`FlowerClient.ts`；`Mapper.ts` |
| 当前/预期行为 | 唯一测试只核required ID和签名；应覆盖分页、分类树、字段、金额、库存、快照规模和下游价格契约 |
| 证据/调用链 | E-AU-026-008、TC-AU-026-001–005；npm test→Vitest（当前缺工具） |
| 影响 | F-0108–F-0110可在包级测试绿色时存在；无直接数据/安全写入 |
| 建议/范围 | 单一测试批次补Client/Mapper反事实，不混实现修改 |
| 验证/回滚 | 破坏分页、价格或调用预算时测试失败；回退测试提交 |
| 独立复核 | 否 |

## 26. AU-026 新增未定级事项

- [UNKNOWN] 线上Flower是否enabled、目录页数、实际market_price关系及同步失败记录；审计未访问线上。
- [UNKNOWN] Flower图片URL是否仍可能使用HTTP；代码未做Cake已有的已知域名HTTPS归一化，但固定基线没有真实Flower响应证明，暂不定级。

## F-0112｜Meal多scope安装只健康检查首个门店

| 字段 | 记录 |
| --- | --- |
| 模块/类型 | Meal Provider；健康门禁、发布边界 |
| 严重级别/置信度 | P2；高 |
| 文件和位置 | `extensions/providers/meal/BrandCatalog.ts:18-35`；`Provider.ts:18-27,37-49`；`bootstrap/ExtensionRegistry.ts:26-44` |
| 当前/预期行为 | [FACT][E-AU-027-003/004] installation可含多个scope，但唯一probe只接收`scopes[0]`，只invoke且不映射其响应；整体health应覆盖所有发布scope或明确拆分健康状态 |
| 调用链 | Loader→MealProvider.create→mealProbe(scopes[0])→Registry register/stage health |
| 用户/数据/安全影响 | 后续品牌/门店不可用或响应畸形时provider仍可激活，目录/价格任务运行期失败；无直接安全影响 |
| 根因/建议范围 | provider级健康状态与多scope配置聚合不一致；后续单独定义全scope/抽样/分scope健康策略 |
| 验证/回滚 | 首scope正常、第二scope网络失败/畸形、scope顺序变化矩阵；回退单一health提交 |
| 独立复核 | 否 |

## F-0113｜Meal Price按500键批次重复拉取整店菜单

| 字段 | 记录 |
| --- | --- |
| 模块/类型 | Meal Price；通信放大、deadline |
| 严重级别/置信度 | P2；高 |
| 文件和位置 | `extensions/providers/meal/Provider.ts:65-86`；`catalog/CatalogSourcePort.ts:28-31`；`channel/ChannelSyncJob.ts:89-110` |
| 当前/预期行为 | [FACT][E-AU-027-005/006] 每批Price对命中的scope下载并映射整份菜单，Channel每批最多500 external IDs；同scope大于500个映射商品时重复整店调用。应复用同步周期快照或提供增量/点查 |
| 调用链 | Channel price run→500-key batch→Meal price→scope menu→全菜单index→请求项 |
| 用户/数据/安全影响 | 大菜单/多批同步下放大外部请求与CPU，易超deadline或限流并延迟价格；无已证数据损坏 |
| 根因/建议范围 | 按键Price契约适配整菜单API但没有跨批快照所有权 |
| 验证/回滚 | 499/500/501键、单/多scope调用数与快照一致性；回退单一优化提交 |
| 独立复核 | 否 |

## F-0114｜Meal package未声明直接vendorcore依赖

| 字段 | 记录 |
| --- | --- |
| 模块/类型 | Meal package；依赖边界 |
| 严重级别/置信度 | P3；高 |
| 文件和位置 | `extensions/providers/meal/BrandCatalog.ts:2`；`Provider.ts:5`；`package.json:9` |
| 当前/预期行为 | [FACT][E-AU-027-007] 两个源码文件直接type import `@shop/vendorcore`，dependencies只有contract/providercore/vendorcakeuncle；直接依赖应由本包声明 |
| 影响 | 当前工作区提升可能掩盖问题；隔离安装、包图或release impact可能不完整；无运行数据/安全影响 |
| 建议/范围 | 后续单一依赖清单批次补直接声明并验证lock/impact；审计分支不修改 |
| 验证/回滚 | 隔离workspace typecheck与依赖图；回退单一依赖提交及锁文件变化 |
| 独立复核 | 否 |

## F-0115｜Meal测试仅覆盖KFC单scope正常路径

| 字段 | 记录 |
| --- | --- |
| 模块/类型 | Meal tests；测试缺口 |
| 严重级别/置信度 | P3；高 |
| 文件和位置 | `extensions/providers/meal/tests/Ports.test.ts:16-58`；`Provider.test.ts:7-15` |
| 当前/预期行为 | 只执行KFC单scope菜单/价格与一个OrderDraft样例；应覆盖其余六品牌、多scope health、错误记录、ID编码、价格批次和所有订单字段反事实 |
| 证据/调用链 | E-AU-027-008、TC-AU-027-001–006；npm test→Vitest（当前缺工具） |
| 影响 | F-0112/F-0113和多数品牌映射可在测试绿色时退化；无直接数据/安全写入 |
| 建议/范围 | 先补多scope和七品牌契约fixture，再分批覆盖调用预算；不混实现修改 |
| 验证/回滚 | 每个品牌字段破坏、第二scope失败、501键调用预算时测试失败；回退测试提交 |
| 独立复核 | 否 |

## 27. AU-027 新增未定级事项

- [UNKNOWN] 线上Meal是否enabled、配置了多少品牌门店、单店映射商品量和供应商限流；审计未访问线上。
- [UNKNOWN] 七品牌供应商字段是否仍与固定Mapper一致；除KFC外没有当前fixture或实际响应证据。

## F-0116｜Book订单提交后tracking因capability词汇不一致被拒绝

| 字段 | 记录 |
| --- | --- |
| 模块/类型 | Book/Fulfillment；能力契约、履约正确性 |
| 严重级别/置信度 | P1候选；高 |
| 文件和位置 | `extensions/providers/book/manifest.ts:12`；`Provider.ts:6`；`fulfillment/FulfillmentJobs.ts:37-67`；`bootstrap/ExtensionRegistry.ts:76-82` |
| 当前/预期行为 | [FACT][E-AU-028-003/004/005] Book声明Order和Shipment并发布order/tracking；Order成功后固定排入tracking，但caller请求Logistics。Registry先检查capability，Book不含Logistics，故不会调用tracking port。已提交外部订单应有可达的状态追踪闭环 |
| 调用链 | fulfillment job→Book Order/order→accepted+enqueue tracking→Logistics/tracking→EXTENSION_CAPABILITY_MISSING |
| 用户影响 | Book订单可能已在供应商侧成立，但本地持续无法跟踪发货/送达，订单收货闭环和后续事件停滞 |
| 数据/安全影响 | 本地停留accepted/processing并反复失败；未证明数据丢失或安全绕过 |
| 根因/建议范围 | manifest capability词汇与唯一Fulfillment caller不一致；后续独立契约批次统一规范词汇并覆盖所有provider |
| 验证/回滚 | Book合成order receipt后运行tracking job，必须进入tracking port并可完成里程碑；回退单一契约提交 |
| 独立复核 | 是，RV-0021；需重新核对动态caller、manifest与运行入口 |

## F-0117｜Book Return与Refund可解锁同一refund port

| 字段 | 记录 |
| --- | --- |
| 模块/类型 | Book Provider；capability-port契约 |
| 严重级别/置信度 | P2；高 |
| 文件和位置 | `extensions/providers/book/manifest.ts:12`；`Provider.ts:6`；`providers/core/src/PortFactory.ts:20-33`；`ExtensionRegistry.ts:76-82` |
| 当前/预期行为 | [FACT][E-AU-028-005/006] manifest同时含Return/Refund，factory仅有refund port并指向`book.return.submit`；Registry允许caller用任一已声明capability配同一port。能力与port应有唯一、可验证语义映射 |
| 用户/数据/安全影响 | 未来退货/退款caller可能在词汇兼容下调用错误协议；当前固定仓库无caller，尚无已证线上影响 |
| 根因/建议范围 | capability与port独立字符串校验；后续全provider契约批次建立权威映射，不在Book内临时加旁路 |
| 验证/回滚 | capability×port全矩阵，错误组合必须失败；回退单一契约提交 |
| 独立复核 | 否；若升级P1需复核 |

## F-0118｜Book测试不执行任何业务port

| 字段 | 记录 |
| --- | --- |
| 模块/类型 | Book tests；测试缺口 |
| 严重级别/置信度 | P3；高 |
| 文件和位置 | `extensions/providers/book/tests/Provider.test.ts:1-13` |
| 当前/预期行为 | 唯一用例只核required ID、definition ID和签名；应至少覆盖factory、capability-port矩阵、Catalog映射、写入幂等标记、tracking链与Webhook协议 |
| 证据/调用链 | E-AU-028-007、TC-AU-028-001–005；npm test→Vitest（当前缺工具） |
| 影响 | F-0116/F-0117及operation拼写/响应漂移可在包级测试绿色时存在 |
| 建议/范围 | 先补履约能力矩阵，再按独立批次加入Wenxuan协议fixture；不混生产修复 |
| 验证/回滚 | 修改Shipment/Logistics、operation或canonical key时测试失败；回退测试提交 |
| 独立复核 | 否 |

## 28. AU-028 新增未定级事项

- [UNKNOWN] 线上Book是否enabled、是否已有外部订单或失败tracking job；审计未访问线上，因此F-0116保持P1候选而非P0。
- [UNKNOWN] Wenxuan真实鉴权、请求/响应和Webhook协议是否由外部canonical gateway转换；固定仓库只有通用HMAC/JSON实现。

## F-0119｜Directcharge核心履约caller无法到达order与tracking ports

| 字段 | 记录 |
| --- | --- |
| 模块/类型 | Directcharge/Fulfillment；能力契约、业务可达性 |
| 严重级别/置信度 | P1候选；高 |
| 文件和位置 | `extensions/providers/directcharge/manifest.ts:12`；`Provider.ts:6`；`fulfillment/FulfillmentJobs.ts:37-67`；`ExtensionRegistry.ts:76-82` |
| 当前/预期行为 | [FACT][E-AU-029-003/004/005] factory发布order/tracking，但manifest没有Fulfillment固定请求的Order/Logistics，只有Issue/DirectCharge/Query；Registry先检查capability，核心任务在调用万联前失败。required直充provider应有可达提交和结果查询入口 |
| 调用链 | fulfillment submit/track→Registry require(Order或Logistics, order或tracking)→EXTENSION_CAPABILITY_MISSING |
| 用户影响 | 直充/卡券履约无法通过现有核心任务发起或查询，订单可能持续失败 |
| 数据/安全影响 | 外部调用前失败，未证明产生供应商侧重复写；本地失败/重试状态影响待线上核验 |
| 根因/建议范围 | 领域capability词汇与统一Fulfillment caller不一致；后续全provider契约批次统一，不在单包增加旁路 |
| 验证/回滚 | 合成Directcharge fulfillment必须进入order并可由tracking查询；回退单一契约提交 |
| 独立复核 | 是，RV-0022 |

## F-0120｜Directcharge capability与port没有唯一语义映射

| 字段 | 记录 |
| --- | --- |
| 模块/类型 | Directcharge Provider；capability-port契约 |
| 严重级别/置信度 | P2；高 |
| 文件和位置 | `manifest.ts:12`；`Provider.ts:6`；`providers/core/src/PortFactory.ts:20-33`；`ExtensionRegistry.ts:76-82` |
| 当前/预期行为 | [FACT][E-AU-029-005/006] Issue/DirectCharge/Query/Verify等能力与order/tracking/verification ports无权威配对；任一已声明能力都可和任一现有port通过Registry。配对应唯一并由契约验证 |
| 用户/数据/安全影响 | 新caller可能以错误能力调用直充、查询、退款或验券operation；当前固定caller尚未形成这些组合 |
| 根因/建议范围 | Registry分别校验capability和port；后续建立全局映射与契约测试 |
| 验证/回滚 | capability×port穷举矩阵；非法组合失败；回退单一契约提交 |
| 独立复核 | 否；升级P1时需要 |

## F-0121｜Directcharge测试不执行任何业务port

| 字段 | 记录 |
| --- | --- |
| 模块/类型 | Directcharge tests；测试缺口 |
| 严重级别/置信度 | P3；高 |
| 文件和位置 | `extensions/providers/directcharge/tests/Provider.test.ts:1-13` |
| 当前/预期行为 | 唯一用例只核required ID、definition ID和签名；应覆盖factory、capability矩阵、直充提交/查询、退款、验券、Catalog和Webhook |
| 证据/调用链 | E-AU-029-007、TC-AU-029-001–005；npm test→Vitest（当前缺工具） |
| 影响 | F-0119/F-0120及万联operation/响应漂移可在包级测试绿色时存在 |
| 建议/范围 | 先补核心履约能力矩阵，再加入万联协议fixture；不混生产修复 |
| 验证/回滚 | 修改能力词汇、operation或canonical key时测试失败；回退测试提交 |
| 独立复核 | 否 |

## 29. AU-029 新增未定级事项

- [UNKNOWN] 线上Directcharge是否enabled、现有履约失败和万联调用记录；未访问线上，因此F-0119保持P1候选而非P0。
- [UNKNOWN] Issue与DirectCharge的产品语义应合并还是分别对应卡券发放/话费直充；需Ethan或真实协议定稿。

## F-0122｜Jdfresh库存与订单后物流链因capability不一致不可达

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | Jdfresh/Channel/Fulfillment；P1候选，高置信 |
| 位置 | `jdfresh/manifest.ts:12`；`Provider.ts:6`；`ChannelSyncJob.ts:113-126`；`FulfillmentJobs.ts:37-67` |
| 当前/预期 | [FACT][E-AU-030-002–005] factory有stock/tracking，manifest用GeoStock/Delivery；caller用Inventory/Logistics，Registry在port前拒绝。库存与已提交订单物流应可达 |
| 影响 | 库存同步失败；JD生鲜Order成功后tracking失败，履约状态停滞。线上是否enabled未知 |
| 根因/方向 | 全局能力词汇未统一；后续独立契约批次治理，不加单包旁路 |
| 验证/回滚 | 合成inventory及Order→tracking全链；回退单一契约提交 |
| 独立复核 | RV-0023 |

## F-0123｜Jdfresh TimeSlot与领域能力没有唯一port映射

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | Jdfresh契约；P2，高置信 |
| 位置 | `manifest.ts:12`；`Provider.ts:6`；`ExtensionRegistry.ts:76-82` |
| 当前/预期 | TimeSlot无专用port；GeoStock/Delivery只能由caller自行配stock/tracking，且任意现有port都可配。应有权威映射 |
| 影响 | 新caller可能错误调用或无法调用时段/区域库存能力；当前无TimeSlot caller |
| 验证/回滚 | capability×port穷举；回退契约提交 |
| 独立复核 | 否 |

## F-0124｜Jdfresh测试不执行任何业务port

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | Jdfresh tests；P3，高置信 |
| 位置 | `jdfresh/tests/Provider.test.ts:1-13` |
| 当前/预期 | 只核ID和签名；应覆盖factory、库存、订单、物流、时段、退款、对账、Webhook和能力矩阵 |
| 影响 | F-0122/F-0123及operation/响应漂移不被包测试发现 |
| 验证/回滚 | 破坏能力词汇或operation时测试失败；回退测试提交 |
| 独立复核 | 否 |

## F-0125｜Jdproduct Return能力未闭合

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | Jdproduct Provider；P2，高置信 |
| 位置 | `extensions/providers/jdproduct/manifest.ts:12`；`Provider.ts:6` |
| 当前/预期 | manifest声明`Return`能力，但`operations`中没有`return` port。能力与port应可唯一闭合，至少要有可达端口或明确废弃说明。 |
| 影响 | 当前不会直接证明线上退货流程可执行或可安全禁用；但`manifest`层面能力承诺与实现不一致。 |
| 根因/方向 | 能力词汇保留与port实现未同步；后续provider统一契约复核再治理，不建议单包硬编码旁路 |
| 验证/回滚 | 在provider级别做capability×port反事实，发现任何`Return`路径引用时应先补齐映射；回退单一契约提交 |
| 独立复核 | 否 |

## F-0126｜Jdproduct测试未覆盖业务ports

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | Jdproduct tests；P3，高置信 |
| 位置 | `extensions/providers/jdproduct/tests/Provider.test.ts:1-13` |
| 当前/预期 | 只核`required ID`与manifest签名；未实例化factory、不测试`catalog/price/stock/order/tracking`和错误映射。 |
| 影响 | capability/port变更或供应商适配漂移可被包测试遗漏，进入生产后只触发运行时故障 |
| 验证/回滚 | package级用例应包含factory、capability与port矩阵、至少一条业务port行为；回退单一测试提交 |
| 独立复核 | 否 |

## F-0127｜Private Provider tracking与Logistics capability不闭合

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | Private Provider；P1候选，高 |
| 位置 | `extensions/providers/private/manifest.ts:12`；`extensions/providers/private/Provider.ts:6`；`services/commerce/src/modules/fulfillment/05_interface_jieru/jobs_renwu/FulfillmentJobs.ts:66-67`；`providers/core/src/ExtensionRegistry.ts:76-82` |
| 当前/预期 | `manifest`将 `Shipment/Return` 纳入能力，但 `Provider`/`channels` 组合仅有 `tracking`；`FulfillmentJobs`对已启用 private 实例仍使用 `Logistics` capability 发起 `tracking`，`ExtensionRegistry`会在 capability 检查阶段拒绝该链路。应确保 `manifest`与caller口径一致：要么显式支持`Logistics` capability，要么移除不匹配履约入口。 |
| 影响 | private provider 的履约更新阶段可能在启用后卡在 tracking 查询；履约状态可被长期停滞。 |
| 根因/方向 | capability 与 port 字符串域未闭合，且未保留版本级禁用/迁移策略。后续统一 provider 契约批次治理，不在本次单 provider 内做临时旁路。 |
| 验证/回滚 | 构造 private 履约/tracking反事实，确认 `extension.require` 在 capability/port 上的拒绝与成功路径；回退仅改契约提交。 |
| 独立复核 | 是，RV-0024 |

## F-0128｜Private Provider 声明能力与端口映射失配

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | Private Provider；P2；高 |
| 位置 | `extensions/providers/private/manifest.ts:12`；`services/commerce/src/modules/channel/04_adapters_shixian/adapter/PgPrivateProvider.ts:9-44`；`extensions/providers/private/Provider.ts:8-14` |
| 当前/预期 | `manifest`声明 `Shipment`、`Return`，`ports`实现侧未暴露对应端口，`Return`也未声明对应操作端口。当前固定caller未验证该能力，但承诺与实现并未形成一一可达语义。 |
| 影响 | 当前无实证证明退货/出货能力可执行或被合法禁用；若未来补齐 caller 后可触发错误路由。 |
| 根因/方向 | 能力词汇与真实端口演进漂移，缺统一映射与唯一绑定矩阵。 |
| 验证/回滚 | 独立补齐固定 provider 能力/端口映射测试；若确认能力停用需正式退役并更新 manifest/发布入口。 |
| 独立复核 | 否 |

## F-0129｜Private Provider测试覆盖不足

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | Private Provider tests；P3；高 |
| 位置 | `extensions/providers/private/tests/Provider.test.ts:1-13` |
| 当前/预期 | 测试仅核验 `required id`、`definition` 与签名；未实例化factory，不覆盖 `catalog/stock/order/tracking/cancel/refund/statement` 与错误映射。 |
| 影响 | `manifest` 口径变更、port 漏映射与重试/错误分类问题可在包级测试中不被发现，运行时才触发。 |
| 验证/回滚 | 用例应覆盖 `factory + manifest + ExtensionRegistry + 主要端口行为`；回退仅减小 test patch。 |
| 独立复核 | 否 |

## F-0130｜Tmallmarket Return能力声明未闭合

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | Tmallmarket Provider；P2；高 |
| 位置 | `extensions/providers/tmallmarket/manifest.ts:12`；`extensions/providers/tmallmarket/Provider.ts:6` |
| 当前/预期 | `manifest`声明 `Return` 能力，但 `operations` 中不含 `return` 映射。该能力当前可对外承诺但未提供稳定执行端口。 |
| 影响 | 不会直接影响当前固定caller链路，但建立了“有能力名无端口”的长期契约债务，外部/未来 caller 可能误用。 |
| 根因/方向 | 能力词汇与端口集合不同步，未通过统一 provider 契约回归检查。 |
| 验证/回滚 | 在契约层补齐 capability×port 穷举用例，确认 `Return` 是否需正式下线或新增 port。 |
| 独立复核 | 否 |

## F-0131｜Tmallmarket测试覆盖不足

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | Tmallmarket tests；P3；高 |
| 位置 | `extensions/providers/tmallmarket/tests/Provider.test.ts:1-13` |
| 当前/预期 | 只核验 required ID 与 manifest 签名；未覆盖 `create`、factory、operations 映射、`statement`/`refund`/`tracking` 等业务端口。 |
| 影响 | 能力/端口漂移、vendor client 适配和错误映射可能在单元层面不被发现。 |
| 验证/回滚 | 将测试扩展为 `factory + manifest + ports` 最小矩阵；回退单一测试提交。 |
| 独立复核 | 否 |

## F-0133｜Tmall vendor适配器测试覆盖不足

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | Tmall vendor adapter；P3；高 |
| 位置 | `01_core_hexin/extensions/vendors/tmall/tests/Auth.test.ts:1-10` |
| 当前/预期 | 测试仅覆盖“任一签名字段缺失会抛错”，未验证 `keyId` 与 `secret` 的单字段差异、`createTmallClient` factory 和关键 business operation 的闭合行为。 |
| 影响 | 当认证密钥字段或 vendor 适配器行为发生调整时，回归仅依赖签名抛错测试，易出现线上才暴露的适配漂移。 |
| 验证/回滚 | 补充 `keyId` 与 `secret` 细分断言，并增加 `createTmallClient` + 至少 `tracking/statement/refund` 的契约覆盖。 |
| 独立复核 | 否 |

## F-0134｜JD vendor 认证测试覆盖不足

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | JD vendor adapter；P3；高 |
| 位置 | `01_core_hexin/extensions/vendors/jd/tests/Auth.test.ts:1-14` |
| 当前/预期 | 测试仅覆盖“任一签名字段缺失会抛错”，未验证 `keyId` 与 `privateKey` 的单字段差异、`createJdClient` factory 与关键 business operation 的闭合行为。 |
| 影响 | 当认证密钥字段或 vendor 适配器行为发生调整时，回归仅依赖签名抛错测试，易出现线上才暴露的适配漂移。 |
| 验证/回滚 | 补充 `keyId` 与 `privateKey` 细分断言，并增加 `createJdClient` 与至少一条业务 operation 的契约覆盖。 |
| 独立复核 | 否 |

## F-0135｜Wanlian vendor 认证测试覆盖不足

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | Wanlian vendor adapter；P3；高 |
| 位置 | `01_core_hexin/extensions/vendors/wanlian/tests/Auth.test.ts:1-11` |
| 当前/预期 | 测试仍仅验证“空输入会抛错”，未覆盖 `keyId` 与 `privateKey` 的错误码差异，也未覆盖 `createWanlianClient` 及其与 `directcharge/movie` provider 的 operation 闭合行为。 |
| 影响 | 当认证字段校验或 vendor 适配器行为变化时，包级回归难以提前发现，易延迟暴露到 provider runtime。 |
| 验证/回滚 | 补充字段级断言、工厂闭合测试（catalog/issue/tracking）及 secrets 管道验签分支；回退只减小测试提交。 |
| 独立复核 | 否 |

## F-0136｜Wenxuan vendor 认证测试覆盖不足

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | Wenxuan vendor adapter；P3；高 |
| 位置 | `01_core_hexin/extensions/vendors/wenxuan/tests/Auth.test.ts:1-11` |
| 当前/预期 | 测试仍仅覆盖“空输入会抛错”，未覆盖 `keyId` 与 `secret` 的独立错误码路径，也未覆盖 `createWenxuanClient` 与 `book` provider 调用闭合。 |
| 影响 | provider 认证策略或 vendor 适配器回归可能只在 runtime/线上调用时暴露，延迟发现。 |
| 验证/回滚 | 扩展测试为字段级错误码、`createWenxuanClient` 工厂输出与至少一条 `book` 操作（如 `catalog/order`/`statement`）的端到端映射验证；回滚减小测试提交。 |
| 独立复核 | 否 |

## F-0137｜Console 个人信息页分页未消费 `nextCursor`

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | Console profile；P3；高 |
| 位置 | `01_core_hexin/apps/console/src/feature/access/AccessQuery.ts:11-16`；`01_core_hexin/services/commerce/src/modules/access/03_application_yingyong/AccessReadOperations.ts:19,61,132-133`；`01_core_hexin/apps/console/src/feature/profile/ProfileRoute.tsx:30-37` |
| 当前/预期 | 前端每次固定读取 `access.center.read` 的第一页（`limit:500`），未消费返回的 `nextCursor`；`membership` 通过会话会员 ID 在第一页命中后才可展示，分页越界将导致“未找到当前会员身份”与降级文案。 |
| 影响 | 成员规模大于 500 且目标身份不在第一页时，个人信息页会显示身份缺失，但不一定阻断核心会话行为。 |
| 验证/回滚 | 建议新增分页冒烟测试与 `cursor` 回灌复测；修复方向为 page 递进读取或改造专用身份精确查找接口。 |
| 独立复核 | 否 |

## F-0138｜资格策略管理不消费条件版本

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | qualification；P1；高 |
| 位置 | `01_core_hexin/services/commerce/src/foundation/interface/OperationController.ts:330-338`；`01_core_hexin/services/commerce/src/modules/qualification/03_application_yingyong/QualificationOperations.ts:30-44` |
| 当前/预期 | Controller 会把 `If-Match` 解析为 `expectedVersion`，但 `qualification.policies.manage` 从不读取它；SQL 仅按 policy id/scope 更新并递增 `active_version`。预期是当调用方携带版本条件时，写入应以该条件决定成功或版本冲突。 |
| 影响 | 两个不同幂等键的管理员写入可以依次创建版本，后者无冲突提示地成为 checkout 的生效策略；资格/购买规则可能发生无意覆盖。 |
| 验证/回滚 | 在隔离数据库并行提交不同 rule、相同 If-Match 的两个请求，验证第二个请求是否为冲突；修复必须独立分支，回滚为撤回该修复提交。 |
| 独立复核 | 已完成（AU-046，一致） |

## F-0139｜资格决策预览未复用 checkout 资格规则

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | qualification / checkout；P2；高 |
| 位置 | `QualificationOperations.ts:20-28`；`checkout_jiesuan/.../QuoteReader.ts:251-266` |
| 当前/预期 | preview 仅检查 profile 状态与 resource 排除；checkout 另执行 deny/allowed、城市、标签与购买限额。预期是预览与实际报价使用同一资格判定语义或明确不可比较。 |
| 影响 | 运营或调用方可能获得 eligible 的预览，实际结算却拒绝同一商品，导致操作与用户可见结果不一致。 |
| 验证/回滚 | 用城市、requiredTags、allowed=false、购买限额四组 fixture 分别比较 preview 与 QuoteReader；修复需独立分支。 |
| 独立复核 | 否 |

## F-0140｜公开策略管理 API 无法表达 checkout 使用的完整策略

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | qualification / checkout；P2；高 |
| 位置 | `20260821016000_create_qualification.sql:3-94`；`QualificationOperations.ts:30-44`；`QuoteReader.ts:184-200` |
| 当前/预期 | 资源、主体和购买限额保存在独立版本子表；manage API 只写 policy/policyversion 且立即发布，开放请求 schema 未定义子表数据。预期是完整策略 API 能原子表达这些字段，或该接口不对外承诺完整策略管理。 |
| 影响 | 通过公开 API 无法创建资源范围、主体标签或购买上限策略；空 resource 会被 checkout 解释为适用于所有商品，可能扩大策略作用范围。 |
| 验证/回滚 | 在隔离数据库调用 manage 后读取四张资格表并执行 QuoteReader；修复需独立分支。 |
| 独立复核 | 否 |

## F-0141｜XLSX 报表导出无内存或行数上界

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | reporting；P2；高 |
| 位置 | `01_core_hexin/services/commerce/src/modules/reporting/05_interface_jieru/job/ExportJobRunner.ts:29-48` |
| 当前/预期 | XLSX 分支将每个分页行持续加入 `workbookRows`，全部读取后才生成工作簿；未限制行数/字节，CSV 分支则每页清空。预期为流式生成或显式资源上限与可读失败码。 |
| 影响 | 大范围无过滤导出可能超出 120 秒任务时限或进程内存，反复重试并延迟导出服务。 |
| 验证/回滚 | 用隔离对象存储和超过内存预算的 order/metric fixture 验证任务状态、重试和对象清理；修复必须独立分支。 |
| 独立复核 | 否 |

## F-0142｜Support 消息发送的版本条件契约不一致

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | support；P2；高 |
| 位置 | `modules/support/.../SendMessage.ts:13-31`；`packages/sdk/src/operations/support.ts:116-121` |
| 当前/预期 | SDK 公开 optional expectedVersion，服务端却强制缺失即失败。预期为契约与实现统一。 |
| 影响 | 非 Console 调用方会收到意外的 `EXPECTED_VERSION_REQUIRED`，兼容调用链可能失败。 |
| 验证/回滚 | 在隔离测试中分别带/不带 If-Match 调用；修复必须独立分支。 |
| 独立复核 | 否 |

## F-0143｜通知领取后前置失败会永久遗留 sending dispatch

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | notification；**P1**；高 |
| 位置 | `01_core_hexin/services/commerce/src/modules/notification/03_application_yingyong/command/DispatchNotification.ts:45-56`；`.../04_adapters_shixian/persistence/PgNotificationRepository.ts:139-160`；`.../foundation/application/JobRunner.ts:82-103,109-133` |
| 当前/预期 | dispatch 在 `claim` 时立即从 queued/failed 改为 sending；KMS 解密和模板组装发生在调用 `deliveries.send` 的 try/catch 之前。若前置步骤抛错，只有 runtime.job 退避；下次 claim 排除 sending，处理器返回成功，job 成为 completed。预期为任何可重试的前置失败都能使 dispatch 可重领，或具有明确的租约/恢复过程。 |
| 影响 | KMS 短暂不可用、密文不可读或模板数据异常时，用户可能永远收不到支付、履约、财务、支持等事件通知；记录只显示 sending，且没有 attempt/死信可直接提示运营。实际发生率与线上存量未验证。 |
| 根因 | runtime.job 的租约和重试状态机与 notification.dispatch 的独立 `sending` 状态机未关联；后者无 lease、超时恢复或前置异常补偿。 |
| 验证/回滚 | 隔离数据库构造 dispatch，在 KMS decrypt 模拟失败后运行两次 processor，核对 dispatch 仍 sending、第二个 runtime job completed；修复必须在最新主线独立小分支完成，回滚为撤回该修复提交。 |
| 独立复核 | 已完成（AU-050）；从 runtime 领取函数、迁移、身份监控与测试缺口独立复追，结论一致。 |

## F-0144｜Experience 主发布链没有模块专用行为测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | experience；P2；高 |
| 位置 | `01_core_hexin/services/commerce/src/modules/experience/03_application_yingyong/ExperienceOperations.ts:105-199`；`.../05_interface_jieru/job/ExperienceJobs.ts:21-101`；现有测试仅为 `.../06_tests_ceshi/{adapter/CdnPublisher,application/ExperienceOperatorOperations,module.manifest}.test.ts` |
| 当前/预期 | `save → validate → publish → outbox/inbox → CDN → release/publication active` 是公开页面生效的主业务链，但未见其模块专用行为测试；已有测试只验证内容寻址对象、Identity 受限应用更新和 manifest 清单。预期是至少以真实 PostgreSQL 或等价事务夹具覆盖成功、版本冲突、对象失败重试与 inbox 幂等激活。 |
| 影响 | 对 publish 事务、状态切换、事件负载、Worker 锁与失败恢复的改动可能只在运行时暴露；页面配置可能无法发布或错误切换，现阶段无自动化回归闸门。未见已发生线上故障。 |
| 根因 | 主 Commerce 运行模块与 Identity selected-module 变体分别实现相同 operation 名称，测试集中于后者及对象适配器，未形成主发布链集成 oracle。 |
| 验证/回滚 | 在隔离 PostgreSQL/对象存储构造 application/binding：覆盖 stale expectedVersion、invalid version、对象写入失败后的 job retry、重复 inbox 与最终单一 active publication；修复必须从最新主线独立小分支进行，回滚为撤回该测试/实现小批次。 |
| 独立复核 | 否 |

## F-0145｜Marketing 预算预留与释放主链没有行为测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | marketing / order / payment；P2；高 |
| 位置 | `01_core_hexin/services/commerce/src/modules/marketing/05_interface_jieru/MarketingPort.ts:12-36`；现有测试仅 `.../modules/marketing/06_tests_ceshi/module.manifest.test.ts` |
| 当前/预期 | 条件预算抢占、redemption 去重、付款提交以及订单超时/支付关闭释放构成实际折扣资金状态机，但模块没有对应测试；唯一测试只断言 manifest。预期是用真实 PostgreSQL/RLS 或等价事务 fixture 覆盖预留、重复、并发、提交、释放和二次释放。 |
| 影响 | 预算竞争、退款/超时回收或状态迁移变化可能在订单运行时才暴露，导致活动预算被错误占用或订单无法完成。未见已发生线上事故。 |
| 根因 | Marketing 的写入能力被建模为跨模块 Port，测试所有权未随 Port 的关键状态机建立。 |
| 验证/回滚 | 隔离数据库以 `zhudataanpurchaseapi` 与 `shopjob` 分别运行：同一预算并发 reserve、同 order retry、commit 后 release、reserved release 后再次 release；核对 spent/redemption/RLS 结果。修复必须从最新主线独立小分支进行，回滚为撤回该测试/实现小批次。 |
| 独立复核 | 否 |

## F-0146｜购物车批量接口不能创建或新增项目

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | cart；P2；高 |
| 位置 | `01_core_hexin/services/commerce/src/modules/cart/03_application_yingyong/CartOperations.ts:49-69`；`01_core_hexin/packages/sdk/src/operations/cart.ts:47-52`；`.../modules/webbusiness/WebBusinessOperationIds.ts:31-35` |
| 当前/预期 | batch 非零项目只更新既有 `cart.item`，不创建 active cart、不插入 item、不验证 listing；空购物车或新 listing 零更新。预期为该公开批量 API 能建立或更新输入项目，或明确拒绝不支持的输入。 |
| 影响 | 用 batch 初始化/同步购物车的客户端会保持空购物车，后续报价和下单缺少项目。线上调用量未验证。 |
| 根因 | batch 绕开 single put 的 application/listing/cart upsert 路径，只保留既有行 update/delete。 |
| 验证/回滚 | 隔离 PostgreSQL 对无 cart、新 listing、既有 listing、quantity=0、converted cart 分别请求 batch；核对 HTTP body、cart/item 行、scope 与 RLS。修复必须从最新主线独立小分支进行，回滚为撤回修复提交。 |
| 独立复核 | 否 |

## F-0149｜支付回调、退款恢复与人工 recovery 缺少行为测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | payment；P2；高 |
| 位置 | `01_core_hexin/services/commerce/src/modules/payment_zhifu/05_interface_jieru/http/PaymentWebhook.ts:16-75`；`.../PaymentOperations.ts:218-278`；现有 `.../06_tests_ceshi/{PaymentJobs,PaymentWebhookDatabaseBoundary,PaymentMallIdentity}.test.ts` |
| 当前/预期 | 回调 target 核验、inbox 接受后 job 路由、退款完成的资金恢复以及 deadletter 的受控重放均为真实金融恢复路径；现有测试只对 Job 的 provider time/effect 做 mock 断言、对 webhook 做两条源码正则、对 mall SQL 做记录型 mock。预期至少以隔离 PostgreSQL 或等价事务 fixture 覆盖已验签重复通知、target 不匹配、退款成功后的 tender/payment/order/outbox、deadletter replay/retryrefund 与同幂等键重复请求。 |
| 影响 | 对回调接收、恢复状态或资金结算的回归可能只能在运行时发现，可能造成支付状态长期未知、退款未完成或人工恢复无法执行。未见已发生线上事故。 |
| 根因 | 核心 Job 的 provider evidence 断言已有覆盖，但 HTTP webhook 与 recovery command 被视作薄接线，未随其数据库副作用建立行为 oracle。 |
| 验证/回滚 | 隔离 PostgreSQL 分别注入已验签 payment/refund receipt：核对一次 inbox/job、重复通知 no-op、target 错误拒绝、退款所有 tender 恢复/余额/订单/outbox，以及 deadletter replay/retryrefund 幂等；修复必须从最新主线独立小分支进行，回滚为撤回测试或实现小批次。 |
| 独立复核 | 否 |

## F-0150｜供应商提交失败仍被履约状态伪装为已受理

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | fulfillment / provider；P2；高 |
| 位置 | `01_core_hexin/services/commerce/src/modules/fulfillment/05_interface_jieru/jobs_renwu/FulfillmentJobs.ts:47-58,138`；`01_core_hexin/packages/contract/src/provider/Ports.ts:29-31` |
| 当前/预期 | Provider `RemoteOrderReceipt.state` 为开放 string。submit 后 fulfillment 无条件更新为 `accepted`、保存 external reference 并入 tracking；`success(receipt.state)` 只影响 channel operation 是 `succeeded` 还是 `processing`。预期仅 accepted/submitted/succeeded 能转 accepted，拒绝/失败/未知回执应保持可重试状态或进入明确恢复状态。 |
| 影响 | 供应商拒单或返回未识别状态时，本地履约不再被 fulfillment worker 选中重提；tracking 可能没有可用外部单号或长期无进展，订单可能无法正常履约。当前启用供应商与线上回执状态未验证。 |
| 根因 | submit 的 state 判断未参与 fulfillment 状态机，只服务于 channel operation 的记录标签。 |
| 验证/回滚 | 隔离 PostgreSQL 注入 `failed`、`rejected`、未知和 `accepted` receipt：核对 fulfillment state、provider operation、job 重试与 tracking 行为；修复必须从最新主线独立小分支进行，回滚为撤回该修复提交。 |
| 独立复核 | 否 |

## F-0151｜财务对账、发票和死信恢复没有行为测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | finance；P2；高 |
| 位置 | `01_core_hexin/services/commerce/src/modules/finance/03_application_yingyong/command/ReconcileStatement.ts:10-72`；`.../05_interface_jieru/job/{InvoiceJob,FinanceDeadletter}.ts`；现有 `06_tests_ceshi` 只覆盖 `SettlementJob`、referral payout 与 gateway |
| 当前/预期 | provider statement 的 hash/CSV/匹配/difference、invoice 的 KMS/issuer/object/状态机、deadletter 对 withdrawal/reconciliation/invoice 的状态收口均无模块专用行为测试。预期至少以隔离对象存储、KMS/issuer fixture 和 PostgreSQL 覆盖正常、重复、hash/CSV/外部失败、事务失败和重试/死信后的状态。 |
| 影响 | 对账差异、发票签发和财务任务失败恢复的回归可能只在运行中发现，可能留下错误差异、issued/issuing 状态或不可恢复的提现状态。未见已发生线上事故。 |
| 根因 | 结算的 frozen basis 获得 PGlite 测试所有权，但相邻异步 job 只保留实现，测试所有权未扩展。 |
| 验证/回滚 | 使用隔离对象存储/KMS/issuer 与 PostgreSQL：覆盖 hash 不符、CSV 行错、匹配/差异、invoice upload/DB 失败、重复 issue、withdrawal/reconciliation/invoice deadletter 后 retry；修复必须从最新主线独立小分支进行，回滚为撤回测试或实现小批次。 |
| 独立复核 | 否 |

## F-0152｜财务周期关闭与 backfill 签核缺少行为测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | finance；P2；高 |
| 位置 | `01_core_hexin/services/commerce/src/modules/finance/FinanceLifecycleOperations.ts:75-147`；现有 `.../06_tests_ceshi/module.manifest.test.ts` |
| 当前/预期 | period 请求/批准/拒绝涉及 journal hash、四眼签核、period 状态、statement final 和 outbox；backfill 决策涉及 source/target hash/count/minor 与签核分离。现有测试仅断言 operation 名称。预期以隔离 PostgreSQL 覆盖申请、同人批准、hash 变化、statement 缺失、重复/并发批准、拒绝恢复及 backfill mismatch/outbox。 |
| 影响 | 会计期间关闭或数据回填审批的回归可能仅在运行中暴露，造成 period 卡 closing、statement 未 final 或错误回填签核。未见已发生线上事故。 |
| 根因 | 生命周期 SQL 汇聚在 operation factory，未随高风险状态转换建立集成测试所有权。 |
| 验证/回滚 | 使用隔离 PostgreSQL 构造 period/journal/statement/backfill，验证上述成功/失败路径与完整事务回滚；修复必须从最新主线独立小分支进行，回滚为撤回测试或实现小批次。 |
| 独立复核 | 否 |

## F-0153｜提现申请与审批关键边界缺少行为测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | finance；P2；高 |
| 位置 | `01_core_hexin/services/commerce/src/modules/finance/03_application_yingyong/command/RequestWithdrawal.ts:16-66`；现有 `.../06_tests_ceshi/command/RequestWithdrawal.test.ts` |
| 当前/预期 | 创建依赖 settlement 可支付余额和 version，审批依赖四眼、version 和 stable job，恢复按 source kind 处理 uncertain/failed；现有测试只覆盖 referral uncertain 的一条恢复分支。预期以隔离 PostgreSQL 覆盖余额耗尽、并发申请、同人审批、版本冲突、批准/拒绝入队、partner/referral 的 failed/uncertain 恢复与 deadletter 交互。 |
| 影响 | 提现余额、审批和失败恢复回归可能在支付资金流程中才暴露，造成重复申请、无法恢复或错误状态转换。未见已发生线上事故。 |
| 根因 | 测试所有权集中于最特殊的 referral recovery 分支，主申请与决策状态机未有行为 oracle。 |
| 验证/回滚 | 使用隔离 PostgreSQL 与 runtime.job 构造上述状态，核对 withdrawal、settlement、job 和 evidence；修复必须从最新主线独立小分支进行，回滚为撤回测试或实现小批次。 |
| 独立复核 | 否 |

## F-0154｜发票审批、红冲与读取边界缺少行为测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | finance / invoice；P2；高 |
| 位置 | `01_core_hexin/services/commerce/src/modules/finance/03_application_yingyong/{command/RequestInvoice,query/GetInvoices}.ts`；现有 `.../06_tests_ceshi/command/RequestInvoice.test.ts` |
| 当前/预期 | 发票 create/cancel/approve/reject/red 与 member/operator queries 都是实际申请和签发前的契约边界；现有测试只用 mock 断言 create 和受管过程拒绝。预期以隔离数据库验证组织/profile/settlement line、version、分离审批、stable job、red 前置条件、member/operator 隔离与 cursor。 |
| 影响 | 发票审批、红冲或读取范围的回归可能仅在运营/用户请求时发现，可能导致请求卡状态、红冲失效或错误可见性。未见已发生线上事故。 |
| 根因 | 命令将复杂性委托给数据库过程，但过程契约和应用层 job/read 交接没有共同的行为测试。 |
| 验证/回滚 | 使用隔离 PostgreSQL 构造 profile/settlement/request/document，覆盖上述成功与拒绝路径；修复必须从最新主线独立小分支进行，回滚为撤回测试或实现小批次。 |
| 独立复核 | 否 |

## F-0155｜财务政策工作流缺少数据库行为测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | finance；P2；高 |
| 位置 | `modules/finance/03_application_yingyong/{command/FinancePolicyWorkflow,query/GetFinancePolicies}.ts` |
| 当前/预期 | preview/manage 依赖受管数据库过程的 revision、四眼、hash、scope delegation 和 read 投影；现有测试只验证参数/领域输入。预期以隔离 PostgreSQL 覆盖 draft/submit/approve/reject、stale preview、mall delegation/threshold、revision read 与并发。 |
| 影响 | 政策审批或可见性回归可能只在运营时暴露。未见已发生线上事故。 |
| 验证/回滚 | 隔离 PostgreSQL 验证完整工作流；修复必须从最新主线独立小分支进行，回滚为撤回测试或实现小批次。 |
| 独立复核 | 否 |

## F-0156｜对账差异处置命令缺少行为测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | finance / reconciliation；P2；高 |
| 位置 | `01_core_hexin/services/commerce/src/modules/finance/03_application_yingyong/command/ResolveDifference.ts:9-52` |
| 当前/预期 | retry、resolve、approveitem 与 approve 直接改变 reconciliation/item 状态，并写入 reconciliation/settlement job；未找到调用 `resolveDifferenceOperations` 的模块专用测试。预期以隔离 PostgreSQL 覆盖 scope、状态转换、不同处理/批准人、未清差异拒绝、重复 retry/job 幂等、并发与 job 失败恢复。 |
| 影响 | 对账差异处置和结算排队的回归可能仅在运营处置时暴露，导致无法重试、错误批准或遗漏结算任务。未见已发生线上事故。 |
| 根因 | repair workflow 有独立 wrapper/integration 测试，但 legacy reconciliation manage command 没有相同的行为 oracle。 |
| 验证/回滚 | 从最新主线的独立小分支以隔离 PostgreSQL 构造 difference/balanced/resolved item，核对 reconciliation、runtime.job 和 version；回滚为撤回测试或实现小批次。 |
| 独立复核 | 否 |

## F-0157｜财务报表读取在两个运行模块中语义不一致

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | finance / read boundary；P2；高 |
| 位置 | `01_core_hexin/services/commerce/src/modules/finance/03_application_yingyong/query/GetBills.ts:18-24`；`.../FinanceReadOperations.ts:19-42`；`.../FinanceRoutes.ts:22-38`；`.../IdentityOperatorFinanceModule.ts:1-6` |
| 当前/预期 | 完整 Finance module 的 `finance.statements.read` 返回 scope 闭包内 `draft`/`final` statement；Identity selected Finance module 对同一 operation id 额外要求 `calculation_version=2 and balanced`，并加入 account projection。预期同 operation id 的跨运行单元契约明确统一，或在合同/operation 中明确分离。 |
| 影响 | 调用者因命中不同运行单元而得到不同 state 集合和响应形状，可能展示未平衡草稿、遗漏 account 明细或导致客户端兼容回归。未见已发生线上事故。 |
| 根因 | 为完整 Commerce 与 selected operator module 保留了两套直接 SQL 实现，但未维护等价性测试或显式契约分叉。 |
| 验证/回滚 | 从最新主线独立小分支以隔离数据库对两个 ModuleOperations 执行相同 request，比较 draft/final/balanced/账户行/cursor 结果；确定目标契约后小批次收敛一侧或拆分 operation。回滚为撤回该单一批次。 |
| 独立复核 | 是；P2 跨运行单元契约差异需重新追踪 module registry 和实际 API host。 |

## F-0158｜发票签发 worker 与受控数据库写边界断裂

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | finance / invoice jobs；P1；高 |
| 位置 | `01_core_hexin/services/commerce/src/modules/finance/05_interface_jieru/job/InvoiceJob.ts:18-73`；`02_platform_pingtai/database/supabase/migrations/20260828094000_finance_invoice_issue_integrity.sql:990-1043`；`src/bootstrap/CommerceRuntime.ts:70-81` |
| 当前/预期 | worker 以 `shopjob` 运行，却直接 update `invoice.request`、insert `invoice.document` 与 `invoice.statusevent`；迁移撤销该角色对上述表的 direct write，并仅授予 `invoice.claim_issue/register_issue_artifact/finalize_issue/release_issue_claim/fail_issue`。预期 worker 用这些受控函数完成 claim、冻结快照、artifact、finalize/fail 生命周期。 |
| 直接证据 | current job SQL 与 migration 的 `revoke`/assert 直接冲突；`InvoiceIssueIntegrity.test.ts` 把完整 job 行为标为 `it.skip`/“未实现”；jobs runtime 的 expected role 是 `shopjob`。 |
| 影响 | 已批准发票可能在 worker 执行时因权限拒绝而无法签发；即使临时存在越权角色，缺少 claim/snapshot/artifact lifecycle 会使并发、provider 后失败、红票与 outbox 冲突无法按既定契约收口。 |
| 根因 | 发票完整性迁移引入了受控数据库函数和最小权限边界，但 `InvoiceJobProcessor` 未同步迁移到该协议。 |
| 验证/回滚 | AU-077 已独立重查 worker startup role、migration ledger/后续 grant 覆盖、job 调用链和 test skip，三者一致确认。修复必须从最新主线独立小分支改为受控函数生命周期并以 shopjob/PGlite 验证。回滚为撤回该独立修复批次。 |
| 独立复核 | 是；AU-077 已完成，结论一致。 |

## F-0159｜已发布 Pricing Rule 未参与报价金额计算

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | pricing / checkout；**P1**；高 |
| 类型 | 核心业务规则与报价结果断链 |
| 位置 | `01_core_hexin/services/commerce/src/modules/pricing/03_application_yingyong/PricingOperations.ts:23-36`；`01_core_hexin/services/commerce/src/modules/checkout_jiesuan/03_application_yingyong/queries_duqu/QuoteReader.ts:50-81,158-181,223-225`；`01_core_hexin/services/commerce/src/modules/webbusiness/WebPricingOperations.ts:10-20` |
| 当前/预期 | `pricing.rules.create/publish` 可将规则置为 published；QuoteReader 查询这些规则并把整行放进 `evidence.pricing`，但行价仍只取 `pricing.price.amount_minor`，`discountMinor` 只由 marketing campaign 分配，整个模块不存在 price rule 的 condition/effect 求值或金额写回。预期已发布的定价规则应按其公开的业务契约影响报价，或者相应管理接口不应承诺该能力。 |
| 直接证据 | QuoteReader 的并行读取包含 `priceRules`，随后仅在第 74 行放入 evidence；第 60-64 行的 subtotal/payable 仅由 raw line price 与 promotion 计算；`rg` 覆盖 Commerce 源码的 `pricing.rule` 命中除该读取、写入/发布与声明外无任何规则求值实现。 |
| 调用链/影响 | Operator `POST /api/v1/pricing/rules` → `PUT .../publication` → `pricing.rule`；Member/Checkout quote → QuoteReader 读取 published rule → quote amount 保持不变；独立 WebBusiness API 的 `pricing.offers.read` 也只显示原始 pricebook price。运营人员发布加价/折扣规则后，会员展示及结算金额都不会随规则变化，可能形成商品定价与后台承诺不一致。 |
| 根因 | 规则的持久化、发布和 evidence 快照先于实际规则解释器/价格调整算法落地，接口、权限与数据状态已可运行但业务效果未闭合。 |
| 验证/回滚 | AU-082 已独立复查 rule 创建→发布→QuoteReader 金额演算、`kind/condition/effect` 的全仓消费者、runtime registry、openapi 和行为测试；结论一致。后续必须从当时最新主线单独小分支实现规则解释/金额调整或正式收窄管理契约，并用多规则、优先级、幂等报价和失败回滚测试验证；回滚为撤回该小批次。 |
| 独立复核 | 是；AU-082 已完成，结论一致。 |

## F-0160｜库存 Availability 同一契约在完整与 WebBusiness API 的范围语义不一致

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | inventory / webbusiness；**P2**；高 |
| 类型 | 跨运行单元 API 契约与数据范围差异 |
| 位置 | `01_core_hexin/services/commerce/src/modules/inventory/03_application_yingyong/InventoryOperations.ts:12-27`；`01_core_hexin/services/commerce/src/modules/webbusiness/WebInventoryOperations.ts:8-25`；`02_platform_pingtai/database/supabase/migrations/20260828173000_zhudatuan_web_business_access.sql:244,329-331` |
| 当前/预期 | 两个入口都注册同一 `inventory.availability.read`（同 path/SDK contract）。完整 Commerce 取得 `access.mall_id`，缺失即拒绝，并按 `stock.scope_id=$mall` 查询；WebBusiness 按 `organization.unitclosure` 从 `access.scope.id` 查询 descendant stock。预期同一 operation 的范围投影应由明确、可验证的契约区分，或两个 runtime 对等。 |
| 直接证据 | 两个 handler 的 SQL 与参数直接显示 mall-only vs hierarchy closure；Web runtime 的 role 仅获 stock/reservation select，RLS 使用 `access.web_scope_allowed`。没有 WebInventory 专用测试，现有 scope test 只断言 resolver SQL；未见跨 host/role 的等价性测试。 |
| 影响 | 相同 SDK operation 在不同 API host/actor scope 下可返回不同库存集合：上层 console/组织操作可能看到下级库存，而完整 API 只返回明确 mall。调用方无法仅凭 operation contract 判断返回边界，后续迁移/聚合改动可能造成漏库存或意外扩大可见集合。当前线上请求分布未验证。 |
| 根因 | WebBusiness 为部署单元复制了 availability query 并引入 closure scope，未将差异提升为独立 operation/版本化投影或以等价性测试锁定。 |
| 验证/回滚 | 后续独立审阅应以同一 membership 在 complete/web host、mall/store/ancestor scope、SKU cursor 下比较结果和 RLS，确认设计后用新 operation 或一致实现收敛；修复必须从当时最新主线独立分支进行，回滚为撤回该批次。 |
| 独立复核 | 否；P2，待 Inventory 完整模块与 scope-contract 专项交叉复核。 |

## F-0161｜WebBusiness 订单 payment/finance 聚合投影缺少该运行角色的 RLS 可见性

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | webbusiness / order payment finance；**P2**；高 |
| 类型 | 运行角色权限与聚合读模型断链 |
| 位置 | `01_core_hexin/services/commerce/src/modules/webbusiness/WebOrderOperations.ts:57-76,104-123`；`02_platform_pingtai/database/supabase/migrations/20260911153500_allow_web_order_four_flow_read.sql:3-4`；`02_platform_pingtai/database/supabase/migrations/20260821021000_create_payment_voucher_benefit.sql:398`；`20260821022000_create_finance_channel.sql:278` |
| 当前/预期 | Order read 对每笔订单 lateral 查询 payment intent/payment/allocation/refund 和 finance journal/entry，并将结果放进 `payment_fact`/`finance_facts`。后续迁移仅授予 `zhudatuanwebapi` payment/finance schema usage 和表 select；这些 RLS-enabled table 的 policy 检索未见该 role 的 select policy（现有 policy 仅为其他运行角色）。预期合法 Web order read 应能按订单/范围得到已声明的四流事实，或接口不应投影这些字段。 |
| 直接证据 | payment 与 finance 创建迁移启用 RLS；web order role 的 grant 没有配套 policy；WebOrder query 的 `paymentfact`/`financefacts` 都依赖这些 table。PostgreSQL 对启用 RLS 且无适用 policy 的 role 默认拒绝行。现有 WebOrder test 只检查 SQL 片段/参数，未执行该 role 的真实数据库读取。 |
| 影响 | WebBusiness order 页面可能仍返回主订单，却把 payment fact 置空、finance facts 置空，造成支付/退款/会计状态缺失或被误判。当前是否已有替代 read 或线上受影响请求未验证。 |
| 根因 | 为四流 read 增加了 table grant，但未同步以 web order scope 定义 RLS policy，也未用 `zhudatuanwebapi` 真实角色重放该聚合。 |
| 验证/回滚 | 后续从受控数据库以实际 `zhudatuanwebapi`、owner/supplier/store/mall scope 执行该 operation，确认 payment/finance/fulfillment 子投影及拒绝边界；修复须从最新主线独立小分支在最小数据范围内增加受控 read contract 或调整 projection，并用 role/RLS 集成测试验证。回滚为撤回该单一批次。 |
| 独立复核 | 否；P2，待 payment/finance web read policy 专项复核。 |

## F-0162｜公开目录 cursor 的 HTTP 参数上限宽于数据库函数 integer 类型

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | webbusiness / public catalog；P2；高 |
| 类型 | 输入边界、错误传播、API 可用性 |
| 位置 | `01_core_hexin/services/commerce/src/modules/webbusiness/PublicCatalogHttpHandler.ts:55,98-100`；`02_platform_pingtai/database/supabase/migrations/20260903111000_publish_canonical_guest_catalog.sql:6-10,87-88`；`PublicCatalogHttpHandler.test.ts:6-82` |
| 当前/预期 | handler 接受任意不超过 JavaScript `Number.MAX_SAFE_INTEGER` 的 cursor；其后将数值传入 SQL 函数的 `p_offset integer`。PostgreSQL integer 最大为 2,147,483,647，较大的 safe integer 不能绑定为该参数并会使 query rejection 逃离 handler。预期 API 应在数据库调用前把不能表示为参数类型的 cursor 判为 `PAGINATION_INVALID`，或函数契约改用可承载的类型。 |
| 直接证据 | handler 的 `integer(..., Number.MAX_SAFE_INTEGER)` 在第55行决定接纳范围；函数签名第9行是 `integer`，第88行直接用 p_offset；handler 第59-62行没有 query rejection 处理。现有测试只验证默认 cursor、host 绑定和跨 mall 拒绝，没有参数类型上界反事实。 |
| 调用链/影响 | public GET → PublicCatalogHttpHandler → zhudatuanwebapi → catalog.public_storefront_catalog。任何公开客户端可提交该范围内的过大 cursor，使预期的客户端输入错误变为运行时数据库错误/5xx；未验证线上是否已有该请求。 |
| 根因 | TypeScript 入口以 JavaScript 数值安全范围作为数据库 integer 输入范围，未将跨边界类型约束提升到接口验证。 |
| 验证/回滚 | 从最新主线建立单一修复分支，补 `2147483647/2147483648` 两个 HTTP 反事实并确认后者稳定返回 400、无 query；若改函数类型则同步测试和 query 计划。回滚为撤回该单一变更。 |
| 独立复核 | 否；P2，后续 public API 输入边界专项可复查。 |

## F-0163｜Identity 已过期 challenge 的失败请求仍会递增 attempts

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | identity / challenge；P3；高 |
| 类型 | 过期状态处理、失败路径副作用 |
| 位置 | `01_core_hexin/services/commerce/src/modules/identity/05_interface_jieru/http/IdentitySecurity.ts:34-53` |
| 当前/预期 | 第一条条件消费 SQL 要求 `expires_at>clock_timestamp()`；若它未返回行，第二条失败记数 SQL 只要求未消费和其余身份/realm 条件，未再要求未过期。因此已过期但未消费的 challenge 每次带错 code 请求仍会更新 `attempts`。预期过期 challenge 应作为不可变的历史记录被拒绝，或明确将该写入设计为审计行为并以测试锁定。 |
| 直接证据 | 两条 update 的 where 条件直接对比：第35行包含 expiry，第45-53行没有 expiry；现有 PGlite 测试只覆盖 realm 不匹配时不写和同 realm 错码递增，未覆盖 expiry 反事实。 |
| 调用链/影响 | password reset、phone change、step-up 与 registration 的 consumeChallenge 调用 → 过期 challenge 失败路径。攻击或陈旧客户端可不断改变过期行 attempts；不会完成认证/重置，也未见权限或数据泄露证据。 |
| 根因 | 主消费与失败审计更新使用了两套条件，过期约束没有同步到第二条更新。 |
| 验证/回滚 | 从最新主线独立小分支补已过期 challenge 的错误 code 反事实，确认请求保持 `CHALLENGE_INVALID` 且 attempts 不变；若产品确认必须计数，则将其标为显式审计契约并更新测试。回滚为撤回该单一批次。 |
| 独立复核 | 否；P3，后续 Identity challenge 专项可复查。 |

## F-0164｜后台创建的含大写用户名无法被正常 password 登录查找

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | identity / member management；P2；高 |
| 类型 | 身份主体契约不一致、登录正确性 |
| 位置 | `01_core_hexin/services/commerce/src/modules/identity/05_interface_jieru/http/MembershipInvitationOperations.ts:186-210`；`SessionTicketOperations.ts:46-58,77-84`；`IdentitySubject.ts:17-22` |
| 当前/预期 | 后台 `identity.members.manage` create 将 `username.trim()` 直接送入 `digest(username)`，并将该 hash 写入 password credential；password 登录先经 `canonicalIdentitySubject`，会对非手机号 username trim/lowercase 后再 hash。输入 `Alice` 会写入 digest(Alice)，登录时查 digest(alice)，账号存在却无法定位。预期所有 credential subject 写入应使用与登录一致的 canonical identity subject。 |
| 直接证据 | create 分支第188、201、208-210行未调用 canonicalIdentitySubject；登录准备第46-49行调用它；函数第17-22行固定 lowercase。当前 invitation 测试覆盖 operator invitation/revoke，但未构造 members.manage create 后的 password login 反事实。 |
| 调用链/影响 | Console 后台成员创建 → password credential subject_hash；随后 Identity session create/provider=password → canonical subject lookup → credential not found → CREDENTIAL_INVALID。大小写用户名在后台界面可被创建，但用户无法使用同样拼写的用户名登录。 |
| 根因 | 两条创建入口使用不同的 subject canonicalization：注册路径已用 canonicalMobile，而后台 employee create 保留手工 trim/hash。 |
| 验证/回滚 | 从最新主线独立小分支，以含大写 username 创建后分别用原始/小写登录验证；将写入统一到 canonicalIdentitySubject 并补大小写/空白反事实。回滚为撤回该单一修复批次。 |
| 独立复核 | 否；P2，待 Identity registration/credential 写入全链复查。 |

## F-0165｜Benefit 核心资金状态机只有 policy/manifest 静态测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | benefit / 发放与资金状态；P2；高 |
| 类型 | 测试覆盖缺口、异步资金正确性 |
| 位置 | `01_core_hexin/services/commerce/src/modules/benefit/03_application_yingyong/BenefitOperations.ts:112-255`；`05_interface_jieru/job/BenefitJobs.ts:22-269`；`06_tests_ceshi/` |
| 当前/预期 | create/approve/reserve/grant/revoke/expiry 触及预算、lot、reservation、finance journal 和 outbox，但模块内仅有 GrantPolicy 与 manifest 测试。预期至少以 transaction/PGlite 或等价集成测试覆盖批准、worker 重试、撤销、到期与 budget reserve/granted 余额守恒。 |
| 直接证据 | 模块测试目录仅含 `policy/GrantPolicy.test.ts` 和 `module.manifest.test.ts`；前者只断言状态/时区/四眼，后者只断言声明。两者不导入 BenefitOperations、BenefitJobProcessor、BenefitPort 或 BenefitDeadletter。 |
| 调用链/影响 | Console grant create/decide/control/revoke → runtime job benefitgrant → BenefitJobProcessor → benefit/finance/runtime outbox；checkout → BenefitPort reserve/consume/refund。状态或并发回归不会由当前单测直接捕获。 |
| 根因 | 业务状态机与 worker 在实现时没有同步行为级测试夹具。 |
| 验证/回滚 | 从最新主线建立独立测试批次，最小覆盖四眼 approve、同一 batch retry、pending/active revoke、expiry 有/无 reservation、reserve-consume-refund 守恒；回滚为撤回该测试批次。 |
| 独立复核 | 否；P2，后续 Benefit 数据/Worker 专项可复查。 |

## F-0166｜已取消的 Channel 同步可被在途 Worker 回写为运行或完成

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | channel / 同步任务状态；P2；高 |
| 类型 | 异步取消竞态、状态正确性 |
| 位置 | `01_core_hexin/services/commerce/src/modules/channel/03_application_yingyong/command/RunSync.ts:26-31`；`05_interface_jieru/job/ChannelSyncJob.ts:42-51,162-176,183-189` |
| 当前/预期 | cancel 将 queued/running run 更新为 cancelled；已在途 Worker 的 run() 已先将同一记录标为 running，随后 catalog/price/stock/statement 完成时 finish 不检查当前状态，直接写 running/completed；无 key 时 completeEmpty 也无条件写 completed。预期取消须成为终态：Worker 在外部调用与每次持久化前确认仍可运行，finish/completeEmpty 只在 state='running' 时更新，或明确规定 cancel 不能取消在途执行。 |
| 直接证据 | cancel SQL 的 `run.state in('queued','running')` 在 `RunSync.ts:28-30`；Worker runnable SQL 同样允许 queued/running 并把它设为 running（`ChannelSyncJob.ts:42-45`）。两条事务之间可执行 cancel；finish 的 `where id=$1`（第164-166行）和 completeEmpty 的 `where id=$1`（第183行）均没有 `state='running'` 条件。 |
| 调用链/影响 | Console/API `channel.syncruns.cancel` → channel.syncrun cancelled；并发 runtime job `catalogsync/pricesync/inventorysync/statementsync` → provider pull → catalog/pricing/inventory/finance 写入 → finish/outbox。用户已取消的同步仍可改变投影、创建 reconciliation、重投分页 job 或发 completed event。 |
| 根因 | 取消命令与 Worker 完成路径使用独立 transaction，最终状态更新没有将 cancelled 作为终态比较。 |
| 验证/回滚 | 从最新主线建立独立小分支，以受控 provider 在 run() 后、finish 前执行 cancel；断言 run 保持 cancelled、无 completed outbox/续页 job，并决定是否允许中断已开始的 provider 调用。回滚为撤回该单一状态条件与测试批次。 |
| 独立复核 | 是；P2 异步状态机，需按实际 JobRunner retry/claim 行为重新检查调用链。 |

## F-0167｜Channel connection、同步与 Webhook Worker 仅有 manifest 静态测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | channel / connection、同步与 Webhook；P2；高 |
| 类型 | 测试覆盖缺口、异步集成正确性 |
| 位置 | `01_core_hexin/services/commerce/src/modules/channel/03_application_yingyong/command/{CreateConnection,EnableConnection,RunSync,ApplyWebhook}.ts`；`05_interface_jieru/job/{ChannelSyncJob,ChannelWebhookJob}.ts`；`06_tests_ceshi/module.manifest.test.ts` |
| 当前/预期 | connection create/test/enable/disable、sync start/cancel、Webhook accept 及五类 Worker 会写 connection、extension、runtime job/outbox、catalog/pricing/inventory/finance/provider operation；模块测试只断言 manifest 的 operation/job/event 字符串。预期至少有 transaction/integration 覆盖状态转移、enabled gate、cancel 与 Worker finish 竞态、续页、statement reconciliation、Webhook 重放/验签/claim 和 provider 失败重试。 |
| 直接证据 | `rg` 在 Channel 测试目录只找到 `module.manifest.test.ts`；该文件逐项比较 manifest string，未导入 CreateConnection、EnableConnection、RunSync、ApplyWebhook、ChannelSyncJobProcessor 或 ChannelWebhookJobProcessor。 |
| 调用链/影响 | Channel HTTP operation/Webhook → ModuleOperations 或 ApplyWebhook transaction → runtime.job → ChannelSyncJobProcessor/ChannelWebhookJobProcessor → provider extension、下游投影/finance/provider operation。状态、幂等和队列回归不能由当前测试直接捕获。 |
| 根因 | 模块以声明完整性测试替代命令和 Worker 行为测试。 |
| 验证/回滚 | 从最新主线建立独立测试批次，以最小 PGlite/transaction fixture 覆盖 create→test→enable、disabled/non-enabled 拒绝、cancel race、分页续跑、statement outbox，以及 Webhook 验签/重放、inbox job 原子性和 claim；回滚为撤回该测试批次。 |
| 独立复核 | 否；P2，后续 Channel Worker 专项可复查。 |

## F-0168｜Channel 两个 API runtime 维护重复的 connection/sync read 实现

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | channel / operator read；P3；高 |
| 类型 | 重复实现、跨运行单元契约漂移风险 |
| 位置 | `01_core_hexin/services/commerce/src/modules/channel/03_application_yingyong/query/GetConnections.ts:6-20`、`GetSyncRuns.ts:5-14`；`ChannelReadOperations.ts:14-51` |
| 当前/预期 | 完整 ChannelModule 的两项 read 使用 GetConnections/GetSyncRuns；IdentityRegistrationApi 的 selected Channel module 在 ChannelReadOperations 内重新维护相同的 scope/keyset SQL，connection summary 也只是将 extension repository query 内联。当前投影一致。预期共享同一个 query action/factory，或为两个 runtime 明确建立契约测试，避免一个入口更新后另一个入口陈旧。 |
| 直接证据 | GetConnections 第9-18行与 ChannelReadOperations 第17-32行的 connection select、scope/id keyset、summary projection 等价；GetSyncRuns 第8-12行与第35-40行的 sync select/keyset 等价。两个文件分别由 ChannelRoutes 与 IdentityOperatorChannelModule 装配。 |
| 调用链/影响 | Commerce 完整 API → ChannelRoutes → query files；sovereign Identity Registration API → IdentityOperatorChannelModule → ChannelReadOperations。任一未来字段脱敏、cursor 或 extension health 语义改动可能使同 operation id 在不同部署单元返回不同结果。 |
| 根因 | 为 selected deployment module 复制 read action，而未抽出共享 query factory。 |
| 验证/回滚 | 从最新主线建立独立小分支，先用同一数据库 fixture 对两运行单元逐字段/分页反事实比较，再抽取最小共享 action 或保留双实现并加入契约同构测试。回滚为撤回该单一治理批次。 |
| 独立复核 | 否；P3，后续 Channel read/entrypoint 专项可复查。 |

## F-0169｜Channel provider-operation 的请求哈希冲突被静默吞掉

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | channel / provider operation；P2；高 |
| 类型 | 幂等冲突、状态可观测性与正确性 |
| 位置 | `01_core_hexin/services/commerce/src/modules/channel/01_public_gongkai/ChannelOperationPort.ts:17-23`；调用者 `fulfillment/.../FulfillmentJobs.ts:54-57`、`payment_zhifu/.../PaymentJobs.ts:276-279` |
| 当前/预期 | `record` 以 `(provider,kind,idempotency_key)` 唯一键写入；已存在但 request_hash 不同，`on conflict ... do update ... where request_hash=excluded.request_hash` 返回零行。方法声明 `Promise<void>` 且忽略该结果，调用者继续提交 fulfillment/refund 业务状态。预期 hash 不匹配须显式抛出稳定幂等冲突，或由调用端判定和记录该反事实。 |
| 直接证据 | SQL 第18-21行仅在 hash 相等时更新；无 `returning`、行数检查或异常。Fulfillment submit 在该调用后继续 enqueue tracking 并 commit；Payment refund attempt 在调用后继续 provider 调用和后续状态迁移。 |
| 调用链/影响 | fulfillment job → provider Order submit → provideroperation record → tracking；payment refund job → providerattempt → provideroperation record/update → provider observation。相同 idempotency key 的不同请求可能产生实际外部效果或内部状态变化，却保持旧 operation 记录且没有冲突信号。 |
| 根因 | 把 SQL 条件冲突当作不抛错的幂等成功，但没有区分同 hash 的安全重放和不同 hash 的语义冲突。 |
| 验证/回滚 | 从最新主线建立独立小分支，以相同 provider/kind/key、不同 request hash 的 fixture 断言 record 拒绝；再分别覆盖 fulfillment 与 refund 调用端不会提交后续 side effect。回滚为撤回该单一端口契约/测试批次。 |
| 独立复核 | 否；P2，后续 Channel operation/fulfillment-payment 专项可复查。 |

## F-0170｜Extension health 降级与恢复状态机没有行为测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | extension/channel / health Worker；P2；高 |
| 类型 | 测试覆盖缺口、异步状态机正确性 |
| 位置 | `01_core_hexin/services/commerce/src/modules/extension/05_interface_jieru/job/ExtensionHealthJob.ts:11-63`；`modules/channel/04_adapters_shixian/persistence/PgExtensionStateSink.ts:4-9`；`modules/extension/06_tests_ceshi/` |
| 当前/预期 | health Worker 控制 provider stage、installation transition、connection degraded、health evidence、registry activation/discard 和一分钟调度；模块测试仅验证 manifest/public export。预期至少以 transaction fixture 覆盖不健康 enabled 降级、candidate version stale、degraded 后显式 test/enable 恢复、stage exception discard、scan 续投和 job abort。 |
| 直接证据 | `rg` 只在 Extension manifest test 找到 ExtensionHealthJobProcessor/HealthRecord 的间接提及；该测试不导入、实例化或模拟 Worker。Channel manifest 也只断言 `channelExtensionSink` 不进入 public entry。 |
| 调用链/影响 | runtime job extensionhealth → ExtensionHealthJobProcessor → ExtensionRepository health/transition → PgExtensionStateSink → channel.connection；其结果决定 provider 是否能继续用于新连接与操作。Worker 状态回归目前无专门测试捕获。 |
| 根因 | 运行控制面由 manifest 静态测试覆盖，未建立状态机 transaction fixture。 |
| 验证/回滚 | 从最新主线建立独立测试批次，用 fake loader/repository + transaction spy 或 PGlite 覆盖全部状态分支和 rollback/discard；回滚为撤回该测试批次。 |
| 独立复核 | 否；P2，后续 Extension Worker 专项可复查。 |

## F-0171｜Extension 安装与启停生命周期没有行为测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | extension / installation lifecycle；P2；高 |
| 类型 | 测试覆盖缺口、事务与运行时状态正确性 |
| 位置 | `modules/extension/03_application_yingyong/command/{InstallExtension,EnableExtension,DisableExtension}.ts`；`04_adapters_shixian/persistence/PgExtensionRepository.ts`；`06_tests_ceshi/` |
| 当前/预期 | install/reconfigure/test/enable/disable 控制签名 manifest、secret/configuration、DB transition/history/outbox、延后 loader activation/discard/disable，但测试只有 ContractPolicy 两个断言和 manifest 静态清单。预期最少覆盖签名/host mismatch、secret/config invalid、disabled reconfigure version conflict、stale candidate、active replacement、execute rollback 后 discard、commit 后 activate/disable。 |
| 直接证据 | 测试目录除 `module.manifest.test.ts` 外只有 `policy/ContractPolicy.test.ts`；后者只实例化 ContractPolicy，未导入 InstallExtension、EnableExtension、DisableExtension 或 PgExtensionRepository。 |
| 调用链/影响 | Channel connection create/update/test/enable/disable → Extension lifecycle → extension.installation/history/health/runtime outbox → ExtensionRegistry loader。回归可能造成 configuration、数据库状态或进程内 registry 不一致而不被模块测试捕获。 |
| 根因 | command/adapter 实现未配套 transaction 和 loader lifecycle fixture。 |
| 验证/回滚 | 从最新主线建立独立测试批次，以 fake loader/repository 或 PGlite 覆盖上述状态和 finalize/discard 边界；回滚为撤回该测试批次。 |
| 独立复核 | 否；P2，后续 Extension lifecycle 专项可复查。 |

## F-0172｜Notification 管理与读取 HTTP operation 没有行为级测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | notification / preference、endpoint、template、announcement、read；P2；高 |
| 类型 | 测试覆盖缺口、权限与并发写入正确性 |
| 位置 | `01_core_hexin/services/commerce/src/modules/notification/03_application_yingyong/{command/ChangePreference,command/SaveTemplate,command/SaveAnnouncement,query/GetNotifications,query/GetTemplates,query/GetAnnouncements}.ts`；`06_tests_ceshi/` |
| 当前/预期 | 八项 HTTP operation 已在 module manifest 声明；现有测试只验证 manifest string、identity job/backlog 和 delivery adapters。预期至少有 operation/transaction fixture 验证 access scope、membership owner changed、endpoint KMS envelope/revoke、WeChat subscription authorization、template immutable/version transition、announcement expected version，以及 storefront/operator read visibility/keyset。 |
| 直接证据 | 全服务 `rg` 八项 operation id 在测试文件中只命中 `module.manifest.test.ts` 的字符串清单，以及 IdentityRegistration entrypoint 的两条 route match；未命中 ChangePreference、SaveTemplate、SaveAnnouncement 或三条 query action 的实例化/行为断言。 |
| 调用链/影响 | NotificationModule → NotificationRoutes → ModuleOperations → preference/endpoint/template/announcement repositories；IdentityRegistrationApi → selected notification read operations。权限、加密端点、乐观并发或分页变更可能不会被当前模块测试捕获。 |
| 根因 | 模块测试覆盖 manifest inventory，而没有为 HTTP operation 建立 repository/transaction fixture。 |
| 验证/回滚 | 从最新主线建立独立测试批次，用最小 fake repository/KMS 或 PGlite 覆盖每项拒绝/成功路径、scope/version 与 keyset反事实；回滚为撤回该测试批次。 |
| 独立复核 | 否；P2，后续 Notification management 专项可复查。 |

## F-0173｜Catalog 媒体 Worker 对 provider source URL 无网络与容量边界

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | catalog / media replication Worker；P1；高；双轮确认 |
| 类型 | SSRF、资源耗尽、外部输入边界 |
| 位置 | `01_core_hexin/services/commerce/src/modules/catalog/03_application_yingyong/CatalogSourceProjection.ts:97-101,149-184`；`05_interface_jieru/job/CatalogMediaReplicationJob.ts:46-65,81-93` |
| 当前/预期 | Cake source projection 将 provider `imagePaths` 原样写入 `catalogmediareplication` job；Worker 只检查每个 source URL 为非空字符串，以原生 `fetch(sourceUrl)` 顺序访问，随后无字节上限地 `arrayBuffer()`。预期只允许明确的 HTTPS/host allowlist 与安全解析后的公网地址，限制/流式读取 response，拒绝重定向到非允许地址。 |
| 直接证据 | `cakeSource` 的 `stringArray(imagePaths)` 只检验非空 string；job `mediaPayload` 同样只检验非空 string；`download` 将该值直接传给 fetch 且没有 URL 解析、scheme/host/private address、redirect 或 content-length/body limit 检查。现有 job 测试只用两个 HTTPS provider URL、source unavailable/incomplete/payload 空值反事实。 |
| 调用链/影响 | provider Cake catalog source → CatalogSourceProjection → runtime.job `catalogmediareplication` → CatalogMediaReplicationProcessor.download → process network fetch → OSS replication/coverUrl。若上游 provider 或其返回字段遭篡改，Worker 可对其可达网络发起请求，或为大响应分配内存；实际网络可达性和线上 source 数据尚未验证。 |
| 根因 | Provider media URL 被当作已可信的资源标识，进入通用 worker 前没有网络 egress 与体积边界。 |
| 验证/回滚 | 先独立复核 job runtime 的 egress/DNS/redirect policy 与 provider payload trust boundary；从最新主线建立单一修复分支，用 injectable URL policy/streamed fetch 测试覆盖 http、localhost/private IP、redirect、oversize 与允许 CDN。回滚为撤回该单一输入边界批次。 |
| 独立复核 | 是；AU-134 已从 ChannelSyncJob→CatalogSourceProjection→runtime.job→CatalogJobsRuntime→Worker 和两项局部测试独立重查，仍无 URL/egress/redirect/body-size 边界；P1 保持。 |

## F-0174｜Purchase quote 与 order composition 没有行为级测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | purchase / quote、order composition；P2；高 |
| 类型 | 测试覆盖缺口、会话与写入组合正确性 |
| 位置 | `01_core_hexin/services/commerce/src/modules/purchase/PurchaseOperations.ts:52-103`；`PurchaseCheckoutContext.ts`；`PurchaseOrderQuoteStore.ts`；`PurchaseOperations.test.ts` |
| 当前/预期 | `purchaseCheckoutOperations` 生成并持久化 quote、checkout session、evidence、outbox；`purchaseOrderOperations` 先读 session-bound stored quote 后进入 `PlaceOrder`。现有本模块测试只直接调用 payment action/operation 和 response mapper，入口测试只验证 quote/order route。预期至少以受控数据库 fake/PGlite 覆盖 storefront/session scope、cart expected version、address/invoice invalid、quote expiry、写入原子性、outbox 及 order quote conflict。 |
| 直接证据 | `rg` 对 `checkout.quote.create`/`order.orders.create` 的测试命中仅为 Purchase API route assertion 与其他模块 manifest string；没有测试直接实例化 `purchaseCheckoutOperations`、`purchaseOrderOperations`、`PurchaseCheckoutContext` 或 `PurchaseOrderQuoteStore`。 |
| 调用链/影响 | PurchaseApiRuntime → PurchaseSessionResolver → selected checkout/order modules → `access.purchase_checkout_context`/`access.purchase_order_quote` → quote/session/evidence/outbox 或 PlaceOrder。会话 SQL contract、过期与版本条件或写入组合若回归，当前 Purchase local suite 可能不捕获。 |
| 根因 | 测试集中在更高风险的 payment internal-capture 逻辑和 gateway boundary，未为 quote/order composition 建 fixture。 |
| 验证/回滚 | 从最新主线建立独立测试批次，以最小 transaction fake 或 PGlite 证明上述成功/拒绝/rollback 边界；回滚为撤回该测试批次。 |
| 独立复核 | 否；P2，后续 Purchase quote/order 专项复查。 |

## F-0175｜Runtime 专用健康探针没有行为级测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | runtime / specialized API health；P2；高 |
| 类型 | 测试覆盖缺口、部署就绪性可观测 |
| 位置 | `01_core_hexin/services/commerce/src/modules/runtime/{PurchaseRuntimeOperations,WebBusinessRuntimeOperations,IdentityRegistrationRuntimeOperations,MallProvisioningRuntimeOperations}.ts`；`RuntimeOperations.test.ts` |
| 当前/预期 | 四项专用 profile 对 live 返回 profile/node evidence，对 ready/startup 调 bootstrap compatibility，异常归一为 503。现有测试仅运行 shared dependency probe 并核对一段 SQL FILTER 语法；manifest test 只核对 module id。预期为每个 profile 验证 ready/startup 成功、compatibility failure 的 503、live evidence，以及 unknown operation reject。 |
| 直接证据 | 专用 operation 函数名在 `*.test.ts` 中零命中；`RuntimeOperations.test.ts` 只导入 `runtimeOperations`，唯一断言为 `min(created_at) filter(where state='queued')`；manifest test 没有 invoke。 |
| 调用链/影响 | 专用 `*ApiMain` → `*ApiRuntime` → selected Runtime module → profile health operation → bootstrap compatibility。profile health 改动可影响 process readiness/rollout 判定，当前 module tests 不会直接捕获状态码/evidence regression。 |
| 根因 | Runtime test 最初为 shared dependency SQL 回归而建，未扩展到部署 profile variants。 |
| 验证/回滚 | 从最新主线建立独立测试批次，用 fake pool/context 覆盖四个 profile 的成功/失败/liveness/unknown request；回滚为撤回该测试批次。 |
| 独立复核 | 否；P2，后续 Runtime profile 专项复查。 |

## F-0176｜Voucher HTTP operation 没有行为级测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | voucher / HTTP operation；P2；高 |
| 类型 | 测试覆盖缺口、权限/并发/异步写入正确性 |
| 位置 | `01_core_hexin/services/commerce/src/modules/voucher/03_application_yingyong/{VoucherImportOperations,VoucherOperations,VoucherQueries,VoucherReadOperations}.ts`；`06_tests_ceshi/` |
| 当前/预期 | 模块拥有 19 项 HTTP operation，涵盖 cardpool、program、reserve、issue/retry、status、binding、redemption 和历史读取。现有测试只断言 manifest inventory 和 VoucherPolicy transition。预期至少覆盖 scope predicate、expected version、pool/allocation capacity、reserve requester/decider separation、worker-job enqueue/retry、status/reversal state、import object lifecycle 与 keyset cursor。 |
| 直接证据 | 对四个 operation factory、19 个 operation id 的 `*.test.ts` 检索没有 action invoke/transaction fixture 命中；唯一命中为 `module.manifest.test.ts` 的 operation string 和 `VoucherPolicy.test.ts` 的 domain transition。 |
| 调用链/影响 | VoucherModule/IdentityOperatorVoucherModule → ModuleOperations → voucher table writes/queries → runtime voucherissue/voucherstatus/voucherimport jobs。权限、并发乐观锁、allocation 记账或 queued work 的回归可能不被本模块 suite 捕获。 |
| 根因 | 测试投入于 manifest/public surface 与纯状态策略，没有为 HTTP composition 建立 fake database/PGlite fixture。 |
| 验证/回滚 | 从最新主线建立独立测试批次，以最小 transaction fake/PGlite 为每类成功、scope 拒绝、version conflict、approval separation、job enqueue 和 keyset 反事实建断言；回滚为撤回测试批次。 |
| 独立复核 | 否；P2，后续 Voucher HTTP 专项复查。 |

## F-0177｜Voucher 导入与异步生命周期没有行为级测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | voucher / adapter、import、issue/status/expiry Worker、deadletter；P2；高 |
| 类型 | 测试覆盖缺口、资金/库存式凭证状态与异步恢复正确性 |
| 位置 | `01_core_hexin/services/commerce/src/modules/voucher/04_adapters_shixian/{VoucherPort,persistence/PgVoucherImport}.ts`；`05_interface_jieru/job/{VoucherImportJob,VoucherJobs,VoucherDeadletter}.ts` |
| 当前/预期 | 代码实现 voucher reserve/consume/refund/redeem、encrypted import shard/continuation、issue/status/expiry chunk 与 failure deadletter。预期至少用 fake transaction/PGlite 覆盖 repeated reserve/consume/refund、金额/状态/finance idempotency、KMS/encrypted staging、invalid row/savepoint、cursor resume、issue accounting/outbox、status per-item recovery、expiry/void、deadletter capacity release。 |
| 直接证据 | 测试检索没有 `VoucherJobProcessor`、`VoucherDeadletter`、`VoucherImportProcessor`、`PgVoucherImport` 或 VoucherPort method 的实例化/行为断言；唯一跨模块 VoucherPort 使用位于 `QuoteReader.mall.test.ts`，fixture 的 voucher selection 为空。 |
| 调用链/影响 | Checkout/Order/Payment/Verification → VoucherPort；Voucher HTTP action → runtime.job → VoucherImportProcessor/VoucherJobProcessor → finance/outbox/deadletter。凭证余额、卡码导入、批量发放、状态迁移或失败补偿回归无法由当前模块测试直接检出。 |
| 根因 | 现有测试停在 public/manifest/state policy，未对适配器和异步运行单元建立 transaction fixture。 |
| 验证/回滚 | 从最新主线建立独立测试批次，按上述最小 transaction/PGlite matrix 验证成功、并发/重复、failure/retry/replay；回滚为撤回该测试批次。 |
| 独立复核 | 否；P2，后续 Voucher async 专项复查。 |

## F-0178｜Mall Provisioning HTTP action 没有行为级测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | provisioning / mall create-read HTTP composition；P2；高 |
| 类型 | 测试覆盖缺口、独立 API 权限/事务响应正确性 |
| 位置 | `01_core_hexin/services/commerce/src/modules/provisioning/03_application_yingyong/ProvisioningOperations.ts:13-45`；`06_tests_ceshi/` |
| 当前/预期 | create validates code/public slug, derives plan, preflights conflict, then writes mall graph; read returns 404 when port has no mall. Existing CreateMall tests cover application engine and route test covers operation registration. Expected is direct operation fixture for access context, invalid body, parent/code/slug conflict status, successful write response, read scope and absent result. |
| 直接证据 | `provisioningOperations` 在 `*.test.ts` 中零 direct invoke；operation ids 只命中 manifest/entrypoint route assertions。 |
| 调用链/影响 | MallProvisioningApiMain → MallProvisioningModule → provisioningOperations → CreateMall/MallOwnerProvisioningPort → organization/catalog/experience/access writes。API validation/status/access integration can regress without current local suite detection. |
| 根因 | Tests focus on reusable engine, public ports and policy rather than ModuleOperations HTTP composition. |
| 验证/回滚 | From latest mainline create a separate test-only branch with fake transaction/context covering the stated success/reject/read paths; rollback by reverting that test batch. |
| 独立复核 | 否；P2，后续 Provisioning API 专项复查。 |

## F-0179｜Member 导入报告读取被同名 action 覆盖，未投影授权下载

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | member / import report read；P2；高 |
| 类型 | 正确性、API 响应契约与对象访问投影 |
| 位置 | `01_core_hexin/services/commerce/src/modules/member/03_application_yingyong/MemberOperations.ts:19-22`；`MemberImportOperations.ts:24-33`；`MemberReadOperations.ts:247-256`；`IdentityOperatorMemberModule.ts:15-21` |
| 当前/预期 | `MemberImportOperations` 为 `member.imports.read` 定义 `finalize: projectImport(result, objects)`，其职责是移除内部 `report_object_ref/report_sha256/report_size` 并给已完成报告生成短时授权下载。完整 MemberModule 先 spread import actions、再 spread read actions；后者同名 key 覆盖前者。Identity selected module 也只装配 read action。因此两个实际 API 都返回未投影行，预期的 `report.download` 不会生成。 |
| 直接证据 | JavaScript object spread 为后项覆盖同名 key；两处 module composition 的最后同名项均为 `memberOperatorReadActions()`。`projectImport` 仅由被覆盖的 action 调用，仓内无另一调用。 |
| 调用链/影响 | Commerce main/IdentityRegistrationApiMain → MemberModule/IdentityOperatorMemberModule → ModuleOperations → `member.imports.read`。完成导入的 operator 无法获得设计中的授权 report download；响应还携带内部 object reference metadata。 |
| 根因 | import read 与 operator read 为相同 operation 建立了重复实现，模块装配无 duplicate-action guard。 |
| 建议方向 | 从修复时最新 `zdt-next` 单独建立小分支，将 read 的 scope/query 固化为唯一实现，并保留 `projectImport` finalize；补充 completed report、无 report、跨 scope、selected/full module 两种装配的行为测试。 |
| 验证/回滚 | 以 fake ObjectStore/transaction fixture 断言 output 只含 `report.download` 且 authorization TTL 为 300，断言 raw reference 不在响应；回滚为撤回该独立修复批次。 |
| 独立复核 | 否；P2。 |

## F-0180｜Risk 运行组合没有直接行为测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | risk / persistence、HTTP、Worker composition；P2；高 |
| 类型 | 测试覆盖缺口、策略激活与异步处置正确性 |
| 位置 | `01_core_hexin/services/commerce/src/modules/risk/{04_adapters_shixian,05_interface_jieru}/**`；`06_tests_ceshi/**` |
| 当前/预期 | 现有三项测试只覆盖 mocked EvaluateRisk、纯 RiskEngine/RiskCase 与 manifest。预期覆盖 scoped API transaction、policy candidate/replay/activate guard、case review/outbox、riskscan replay threshold 与 catalog deny consumer 的成功/重放/失败路径。 |
| 直接证据 | `*.test.ts` 中没有 `PgRiskRepository`、`RiskCheckAdapter`、`riskRoutes`、`RiskReplayJobProcessor` 实例或调用；仅 WebBusiness 的不同 adapter 有测试。 |
| 调用链/影响 | RiskCheckAdapter → PgRiskRepository → risk decision/outbox/case；RiskModule → riskRoutes；jobs catalog → RiskReplayJobProcessor → replay/Catalog action。策略变更、拒绝处置或回放门槛回归无法由本模块测试直接发现。 |
| 根因 | 测试停留于 domain/mocked evaluator，未建立 transaction fixture。 |
| 建议方向 | 从修复时最新 `zdt-next` 建立独立测试批次，使用 PGlite/fake transaction 覆盖上述路径；回滚为撤回该测试批次。 |
| 独立复核 | 否；P2。 |

## F-0181｜Inventory 导入与 HTTP 组合没有直接行为测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | inventory / import、HTTP、worker；P2；高 |
| 类型 | 测试覆盖缺口、库存事实与异步恢复正确性 |
| 位置 | `01_core_hexin/services/commerce/src/modules/inventory/{03_application_yingyong,04_adapters_shixian,05_interface_jieru}/**` |
| 当前/预期 | 现有 InventoryPort test 覆盖 reservation lock/mall fact/commit-release/return sync；未直接调用 availability/import operation、PgInventoryImport、StockImport 或 ImportProcessor。预期覆盖 import object validation、scope/availability cursor、committed quantity 拒绝、per-row savepoint、continuation、report projection 与 return retry。 |
| 直接证据 | 所列 factory/processor/import function 在 `*.test.ts` 中零 direct invoke；仅 InventoryPort 与 InventorySyncJobProcessor 被测试实例化。 |
| 调用链/影响 | InventoryModule → inventoryOperations；jobs catalog → InventoryImportProcessor/PgInventoryImport 和 InventorySyncJobProcessor。导入或 API/worker 组合回归可能造成库存事实、report 或恢复行为未被当前套件发现。 |
| 建议方向 | 从修复时最新 `zdt-next` 单独建立测试批次，以 fake transaction/PGlite 覆盖上述路径；回滚为撤回该测试批次。 |
| 独立复核 | 否；P2。 |

## F-0182｜Partner 与供应关系写入没有直接行为测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | partner / HTTP、关系版本端口；P2；高 |
| 类型 | 测试覆盖缺口、scope/version/KMS 写入正确性 |
| 位置 | `01_core_hexin/services/commerce/src/modules/partner/{01_public_gongkai/SupplierRelationshipPort,03_application_yingyong/PartnerOperations}.ts` |
| 当前/预期 | Partner/Store manage 实现 version/scope/KMS 地址写入；供应关系/合同实现 supersede+insert 版本链。现有测试仅断言 manifest。预期覆盖 scope拒绝、version conflict、KMS prepare failure、store create/update、relationship/contract predecessor 和重复版本。 |
| 直接证据 | `*.test.ts` 中没有 `partnerOperations` 或 `SupplierRelationshipPort` 的调用/实例；唯一 test 是 manifest inventory。 |
| 调用链/影响 | Commerce main → PartnerModule → HTTP operations；Checkout/Order → partner.supplierrelationship。写入或版本链回归不会被当前模块测试直接发现。 |
| 建议方向 | 从修复时最新 `zdt-next` 建立独立测试批次；回滚为撤回该测试批次。 |
| 独立复核 | 否；P2。 |

## F-0183｜Reporting projection/export Worker 没有直接行为测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | reporting / async worker；P2；高 |
| 类型 | 测试覆盖缺口、投影幂等/缓存/导出恢复正确性 |
| 位置 | `01_core_hexin/services/commerce/src/modules/reporting/05_interface_jieru/job/{ProjectionJob,ExportJobRunner}.ts` |
| 当前/预期 | 实现包含 inbox claim→transaction projection→versioned cache invalidation，以及 export pagination→object scan/integrity→complete/fail。现有 test 只调用 `ProjectEvent` 内存仓储与 export document helpers。预期应直接覆盖两个 processor 的 success/replay/abort/retry/integrity/cache paths。 |
| 直接证据 | `*.test.ts` 没有 `new ExportJobRunner`、`new ProjectionJobProcessor` 或其 `process` 调用。 |
| 调用链/影响 | jobs catalog → projection/export JobProcessor → reporting fact/export/object/cache。异常恢复、重复 delivery、object abort 或 stale cache 回归无法被当前 suite 直接发现。 |
| 建议方向 | 从修复时最新 `zdt-next` 独立建立 worker test batch；回滚为撤回该测试批次。 |
| 独立复核 | 否；P2。 |

## F-0184｜Verification 核心 challenge/device 行为没有直接测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | verification / challenge-device；P2；高 |
| 类型 | 测试覆盖缺口、nonce 幂等与兑换边界正确性 |
| 位置 | `01_core_hexin/services/commerce/src/modules/verification/03_application_yingyong/VerificationOperations.ts`，现有 `06_tests_ceshi/module.manifest.test.ts` |
| 当前/预期 | 实现包含 nonce hash/expiry、trusted-device scope、原子 consume、attempt log、voucher redeem/outbox、device version update；现有测试只断言 manifest 操作列表。预期应有 operation-level 成功、过期、replay、错误 device/scope、voucher conflict 与 version conflict fixture。 |
| 直接证据 | `verification/06_tests_ceshi` 只有 `module.manifest.test.ts`；未找到 `verificationOperations` 的 direct action 调用。 |
| 调用链/影响 | Commerce app modules → VerificationModule → verificationOperations → verification nonce/session/device、Voucher/Finance Port、runtime.outbox。对重复使用或范围错误的回归只能在集成环境发现。 |
| 建议方向 | 从修复时最新 `zdt-next` 独立建立 verification test batch；回滚为撤回该测试批次。 |
| 独立复核 | 否；P2。 |

## F-0185｜Support case create/message 成功副作用没有直接测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | support / case-message write；P2；高 |
| 类型 | 测试覆盖缺口、事务副作用和授权边界正确性 |
| 位置 | `01_core_hexin/services/commerce/src/modules/support/03_application_yingyong/command/{OpenConversation,SendMessage}.ts`；现有 `06_tests_ceshi/command/SendMessage.test.ts` |
| 当前/预期 | create 组合 order/benefit/SLA/assignment/outbox/job/history/message；send 组合 version-lock、encrypted append、state/history。现有 test 仅验证 send 缺 expected-version 和 SQL conflict。预期应直接覆盖 create 成功/授权拒绝/KMS failure/assignment/SLA jobs，以及 send 成功 member-agent state、scope 和 side-effect atomicity。 |
| 直接证据 | Support test 仅一个 `SendMessage.test.ts` action fixture；没有 `openConversationOperations` 调用，也没有 send success fixture。 |
| 调用链/影响 | ConsoleSupportMain → SupportRoutes → operations → KMS/PgSupportRepository/order/queue/outbox。工单创建或回复的部分写入、错误 scope、状态回归只能靠集成环境发现。 |
| 建议方向 | 从修复时最新 `zdt-next` 独立建立 support write test batch；回滚为撤回该测试批次。 |
| 独立复核 | 否；P2。 |

## F-0186｜Support message read 的附件元数据查询绕过调用者授权条件

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | support / message read；P1；高；待独立复核 |
| 类型 | 身份与权限、潜在跨 scope 附件元数据披露 |
| 位置 | `01_core_hexin/services/commerce/src/modules/support/03_application_yingyong/query/GetConversations.ts:29-31` |
| 当前/预期 | message 主查询以 `conversation.member_id=$3 or organization.unitclosure` 限定调用者；随后 attachment 查询只使用 `ticket.id=$1 and evidence.state='clean'`。预期附件查询必须与同一工单的 message query 使用等价 member/scope predicate，或先以已授权 ticket context 驱动查询。 |
| 直接证据 | 同一 lifecycle 的第一条 query 参数为 `[caseid, access.scope.id, member,...]`；第二条 attachment query 的过滤只有 case id、clean state，未传 access scope/member。 |
| 调用链/影响 | ConsoleSupportMain → SupportRoutes → `support.messages.read`。知道任意 case id 的已认证调用者可取得 clean attachment 的 id/object_ref/hash/kind/size/created_at 元数据；对象内容是否还能被单独下载尚未验证，故未定为 P0。 |
| 数据/安全影响 | 跨成员或跨组织 support evidence 元数据可能泄露；`object_ref` 还可能扩大后续对象访问面。 |
| 根因 | 一个 operation 内两条关联查询的 authorization predicate 不一致，第二条未从已经授权的 ticket/conversation context 取数。 |
| 建议方向 | 从修复时最新 `zdt-next` 建立独立最小修复批：复用同一授权 predicate，并加入跨 member/scope negative test；回滚为撤回该批。 |
| 验证/回滚 | 定向 PGlite/integration fixture：未授权 case 必须同时返回零 message 和零 attachment；授权 member/ancestor 保持原结果。回滚为 revert 独立修复提交。 |
| 独立复核 | 是，AU-163 已完成且结论一致；`records/AU-163-support-attachment-independent-review/summary.md`。 |

## F-0187｜Support close/reopen 版本冲突仍写入成功 history

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | support / ticket transition；P2；高 |
| 类型 | 正确性、审计 history 与持久状态不一致 |
| 位置 | `01_core_hexin/services/commerce/src/modules/support/03_application_yingyong/command/CloseTicket.ts:32-37` |
| 当前/预期 | `transition` 以 `where version=$4` 更新 ticket，却未检查 `result.rows[0]`；随即调用 `ports(...).history`，最后 `rowResult` 才因没有 row 抛 `RESOURCE_NOT_FOUND`。预期必须确认 ticket transition 成功后才写 history，并把 version conflict 作为 conflict。 |
| 直接证据 | 同文件 `update` 路径在 line 22-25 明确检查无 row 后抛 `VERSION_CONFLICT`；`transition` 路径没有该检查且 history 位于 `rowResult` 之前。 |
| 调用链/影响 | SupportRoutes → `support.cases.close` / `support.cases.reopen` → ticket update/history。并发旧版本请求可令客户端得到失败，同时 history 记录 closed/open，误导审计、运营和后续事件处理。 |
| 建议方向 | 从修复时最新 `zdt-next` 独立建立最小修复批：先检查 update row，再写 history，并添加 version conflict negative test；回滚为撤回该批。 |
| 验证/回滚 | 定向 fixture：stale version 不新增 history；success transition 恰增一条 history。回滚为 revert 独立修复提交。 |
| 独立复核 | 否；P2。 |

## F-0188｜Compatibility HTTP error/body/scope helper 没有直接行为测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce-api / HTTP transport；P3；中 |
| 类型 | 测试覆盖缺口、稳定错误契约与输入边界回归风险 |
| 位置 | `01_core_hexin/services/commerce-api/src/api/{errorResponse,routerSupport}.ts` |
| 当前/预期 | `errorResponse` 以业务错误标记映射稳定 HTTP status/code，`routerSupport` 承担32KB JSON size/parse和server-RPC resource scope。`http.test.ts`只测试response factory。预期对上述两文件直接覆盖known/unknown error、declared/actual size、invalid JSON及三个resource scope RPC参数。 |
| 直接证据 | `src/api` 仅有`http.test.ts`导入transport helpers；未找到`knownApiError`、`readJsonBody`、`loadResourceScope`的direct fixture。生产`readJsonBody`有29处调用，`knownApiError`只由顶层router catch调用。 |
| 调用链/影响 | compatibility full router → known error response；compat order/member/product routes → request body/resource scope。未来error mapping或size/scope helper回归不能由当前transport test直接发现。 |
| 建议方向 | 从修复时最新`zdt-next`建立独立transport test批，只新增fixture；回滚为撤回该测试提交。 |
| 验证/回滚 | 断言所有known/unknown error和四种body边界、每个RPC参数及null scope；回滚为revert独立测试提交。 |
| 独立复核 | 否；P3。 |

## F-0189｜PII crypto adapter 缺少直接 round-trip 与篡改拒绝规格

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce-api / PII crypto；P2；高 |
| 类型 | 测试覆盖缺口、个人信息加解密正确性 |
| 位置 | `01_core_hexin/services/commerce-api/src/api/crypto.ts:1-49` |
| 当前/预期 | adapter实现32-byte key、AES-256-GCM、随机12-byte IV、version/algorithm envelope，订单/注册/地址/安全中心均使用。现有route tests只间接执行部分encrypt，未将cipher解回或验证篡改/错误key失败。预期直接固定round-trip、不同IV、tamper、非法cipher、错误key和base64 key长度。 |
| 直接证据 | 仓内没有`crypto.test.ts`，没有生产/测试文件直接调用`decryptJson`验证加密输出；`orderRoutes.test.ts`和`registrationRoutes.test.ts`只mock后续RPC成功。 |
| 调用链/影响 | registration/order/address/security-center → encryptJson；address read → decryptJson。key/cipher envelope或认证标签处理回归会在写入后才暴露为PII读取失败或数据不可用。 |
| 建议方向 | 从修复时最新`zdt-next`建立独立crypto adapter test批，不改变算法或密钥策略；回滚为撤回该测试提交。 |
| 验证/回滚 | 定向test：round-trip、same input differing IV、bit-flip/invalid schema/wrong key reject；回滚为revert独立测试提交。 |
| 独立复核 | 否；P2。 |

## F-0190｜WeChat prepay 关键写入与 Provider 失败路径没有直接测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce-api / WeChat payment prepay；P2；高 |
| 类型 | 测试覆盖缺口、支付幂等与失败补偿正确性 |
| 位置 | `01_core_hexin/services/commerce-api/src/api/wechatPaymentRoutes.ts:60-139`；现有`wechatPaymentRoutes.test.ts` |
| 当前/预期 | 实现先验证phone/scope/idempotency，创建prepay attempt，随后创建或复用provider prepay；异常时best-effort记录失败。现有test只覆盖状态映射、order read和status read route。预期直接覆盖attempt状态、provider成功/reuse、record result、provider/config failure与`api_mark_wechat_prepay_failed`。 |
| 直接证据 | `wechatPaymentRoutes.test.ts`只导入`handleOrderByNumber`和`handleWechatPaymentStatus`，不调用`handleWechatPrepay`。 |
| 调用链/影响 | authenticated storefront route → prepay → attempt RPC → WeChat provider → result/failure RPC。幂等复用、provider异常和失败记录回归不能由现有测试直接发现。 |
| 建议方向 | 从修复时最新`zdt-next`建立独立payment prepay test批；回滚为撤回该测试提交。 |
| 验证/回滚 | mock provider/RPC验证create/reuse/failure顺序和body，覆盖scope/assurance/idempotency拒绝；回滚为revert独立测试提交。 |
| 独立复核 | 否；P2。 |

## F-0191｜Public WeChat callback route 没有直接 RPC/response 测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce-api / public payment callback；P2；高 |
| 类型 | 测试覆盖缺口、支付通知入库与协议响应正确性 |
| 位置 | `01_core_hexin/services/commerce-api/src/api/wechatPaymentNotificationRoute.ts:11-47`；现有`wechatPayNotification.test.ts` |
| 当前/预期 | parser有验签/decrypt/tamper/stale/mismatch fixture；公开route承担POST/64KB/config/verification→`api_apply_wechat_payment_notification` RPC→provider success response，但无同层fixture。预期验证route不会在验签失败时调用RPC、RPC body只含hash/summary、success返回微信协议响应、配置与上游失败传播。 |
| 直接证据 | `wechatPayNotification.test.ts`只导入parser/assert helper；没有`handleWechatPaymentNotification`调用或RPC URL/body断言。 |
| 调用链/影响 | WeChat → publicRouter → `handleWechatPaymentNotification` → verification → idempotent payment notification RPC。route级回归可能令合法通知没有按provider期望确认，或映射错误难以及时发现。 |
| 建议方向 | 从修复时最新`zdt-next`建立独立callback route test批；回滚为撤回该测试提交。 |
| 验证/回滚 | 临时RSA通知fixture验证合法/invalid/stale/config/RPC failure和exact success response；回滚为revert独立测试提交。 |
| 独立复核 | 否；P2。 |

## F-0192｜Address book PII read/write/delete 没有直接行为测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce-api / address book；P2；高 |
| 类型 | 测试覆盖缺口、PII加解密与用户scope正确性 |
| 位置 | `01_core_hexin/services/commerce-api/src/api/addressRoutes.ts:11-61` |
| 当前/预期 | 处理器校验order.create/PII key，GET以当前user scope读取并decrypt，PUT校验地址后加密入库，DELETE同样传scope。没有route test。预期使用真实AES-GCM key与RPC fixture覆盖permission/key、每种method、cipher/parse与跨user scope。 |
| 直接证据 | `src/api` 未找到`addressRoutes.test.ts`或`handleAddresses`/`handleDeleteAddress`测试调用。 |
| 调用链/影响 | authenticated storefront route → address routes → delivery address RPC/PII ciphertext。字段或scope回归可能使个人地址无法读取、写入未加密或误读其他用户数据，且现有suite不能直接发现。 |
| 建议方向 | 从修复时最新`zdt-next`建立独立address route test批；回滚为撤回该测试提交。 |
| 验证/回滚 | direct fixture断言RPC参数包含当前user scope和cipher envelope，GET decrypt round-trip，跨scope/invalid input拒绝；回滚为revert独立测试提交。 |
| 独立复核 | 否；P2。 |

## F-0193｜Cart 写入与删除边界没有直接测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce-api / cart；P2；高 |
| 类型 | 测试覆盖缺口、购物车资格和成员scope写入正确性 |
| 位置 | `01_core_hexin/services/commerce-api/src/api/cartRoutes.ts:9-59`；现有`cartRoutes.test.ts` |
| 当前/预期 | 实现把GET/PUT/DELETE绑定order.create、server membership/user scope，PUT限制SKU和1–99数量。现有test只断言GET snapshot/media URL。预期对PUT/delete和拒绝分支直接断言RPC参数与结果。 |
| 直接证据 | `cartRoutes.test.ts`仅导入/调用`handleCart` GET；未调用PUT或`handleDeleteCartItem`。 |
| 调用链/影响 | authenticated storefront route → cart handlers → qualified cart RPC。数量、资格、scope或删除状态回归不由当前测试直接发现。 |
| 建议方向 | 从修复时最新`zdt-next`建立独立cart route test批；回滚为撤回该测试提交。 |
| 验证/回滚 | fixture覆盖GET/PUT/DELETE、invalid input、permission和exact RPC body；回滚为revert独立测试提交。 |
| 独立复核 | 否；P2。 |

## F-0194｜Order/after-sale 多条关键写入路径没有直接测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce-api / order-after-sale-payment；P2；高 |
| 类型 | 测试覆盖缺口、订单状态/资金/售后写入正确性 |
| 位置 | `01_core_hexin/services/commerce-api/src/api/orderRoutes.ts:11-187`；现有`orderRoutes.test.ts` |
| 当前/预期 | 实现处理after-sale、ship、internal pay、refund和finance reconciliation；全部依赖server scope/RPC，写入附idempotency/hash/evidence。现有tests仅断言phone assurance和create-order cart closure。预期每条写入的成功、拒绝、scope、idempotency和RPC body均有direct fixture。 |
| 直接证据 | `orderRoutes.test.ts`只导入`handleCreateOrder`、`handleInternalPayment`；没有after-sale/ship/refund/reconciliation调用，internal payment也只覆盖未验证phone。 |
| 调用链/影响 | authenticated storefront/admin route → order routes → order/after-sale/account/finance RPC。写入状态、资金扣退、resource scope或审计evidence回归无法在当前suite直接捕获。 |
| 建议方向 | 从修复时最新`zdt-next`拆成订单、售后、发货退款三个独立test批；回滚为撤回对应测试提交。 |
| 验证/回滚 | 每批以mock RPC/assert body验证permission/scope/idempotency/success/conflict；回滚为revert独立测试提交。 |
| 独立复核 | 否；P2。 |

## F-0195｜账户余额、流水与首页组合没有直接行为测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce-api / storefront account-bootstrap；P2；高 |
| 类型 | 测试覆盖缺口、账户财务可见性与首页聚合正确性 |
| 位置 | `01_core_hexin/services/commerce-api/src/api/accountRoutes.ts:73-94`；`homeRoutes.ts:12-24`；现有`accountRoutes.test.ts` |
| 当前/预期 | 账户和流水只允许`order.read`并传current membership/user scope；home并发组合四个handler且失败即透传。现有test仅覆盖bootstrap使用数据库profile和profile缺失403。预期余额/流水permission、scope、numeric mapping、home success与任一子handler失败均有direct fixture。 |
| 直接证据 | `accountRoutes.test.ts`只导入并调用`handleBootstrap`；未导入`handleAccounts`或`handleAccountLedgers`，且未找到`handleHomeSnapshot` direct test。 |
| 调用链/影响 | Storefront worker → storefront router → account/home routes → account/ledger/profile RPC。权限、scope、余额映射或home失败传播回归不能由当前suite直接发现。 |
| 建议方向 | 从修复时最新`zdt-next`拆成account/ledger route tests与home composition tests两个独立小批；回滚为撤回对应测试提交。 |
| 验证/回滚 | fixture断言拒绝、exact RPC scope、balance mapping、home组合与失败传播；回滚为revert独立测试提交。 |
| 独立复核 | 否；P2。 |

## F-0196｜成员运营高风险写入分支没有完整直接测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce-api / member operations；P2；高 |
| 类型 | 测试覆盖缺口、成员生命周期/批量导入正确性 |
| 位置 | `01_core_hexin/services/commerce-api/src/api/memberOperationsRoutes.ts:25-138`；现有`memberOperationsRoutes.test.ts` |
| 当前/预期 | 邀请、停用、建档、资料更新和导入均由capability、fresh step-up、server scope及actor evidence约束；建档/导入对password执行hash/脱敏。现有tests只覆盖读侧PII开关、create invite的step-up拒绝、建档password脱敏及无效导入行回执脱敏。预期每种写入的成功/拒绝/input、RPC body、导入行数/大小和部分失败返回均有direct fixture。 |
| 直接证据 | test仅导入`handleMemberOperations`、`handleCreateMemberInvite`、`handleAdminCreateMember`、`handleMemberImport`；未导入`handleDisableMemberInvite`或`handleUpdateMemberProfile`，且没有invite success/valid import/size boundary调用。 |
| 调用链/影响 | authenticated admin compatibility router → member operations routes → member/invite/import RPC。邀请状态、成员资料、导入计数与错误回执回归不能被当前suite直接捕获。 |
| 建议方向 | 从修复时最新`zdt-next`按invite-profile与member-import分成两个独立test批；回滚为撤回对应测试提交。 |
| 验证/回滚 | fixture断言method/permission/step-up/input、exact RPC scope/evidence、password hash/脱敏、有效/部分失败导入与大小边界；回滚为revert独立测试提交。 |
| 独立复核 | 否；P2。 |

## F-0197｜会员状态成功变更没有直接行为测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce-api / permission admin membership status；P2；高 |
| 类型 | 测试覆盖缺口、成员停用/恢复生命周期正确性 |
| 位置 | `01_core_hexin/services/commerce-api/src/api/permissionAdminRoutes.ts:52-75`；现有`permissionAdminRoutes.test.ts` |
| 当前/预期 | status handler禁止自改，根据`offboarded`或其他status选择独立permission，向带actor scope/evidence的RPC写入。现有tests覆盖self禁止与缺offboard permission拒绝。预期active/suspended/offboarded成功、method/input、disable permission和exact RPC body均有direct fixture。 |
| 直接证据 | test中只有`handleMembershipStatus`的self-status和offboard-denied调用；未见mock RPC成功、`suspended`/`active`或`memberDisable` success断言。 |
| 调用链/影响 | authenticated admin compatibility router → membership status route → `api_update_membership_status` RPC。成员状态、审计evidence或授权映射回归不能由当前suite直接捕获。 |
| 建议方向 | 从修复时最新`zdt-next`建立独立membership status route test批；回滚为撤回测试提交。 |
| 验证/回滚 | fixture覆盖self/permission/input/active-suspended-offboarded与exact RPC scope/evidence；回滚为revert独立测试提交。 |
| 独立复核 | 否；P2。 |

## F-0198｜商品发布状态关键写入没有直接行为测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce-api / admin product status；P2；高 |
| 类型 | 测试覆盖缺口、商品上下架授权与幂等写入正确性 |
| 位置 | `01_core_hexin/services/commerce-api/src/api/adminRoutes.ts:52-84`；现有`adminRoutes.test.ts` |
| 当前/预期 | 状态写入先验证product.publish，再以product ID加载server resource scope，要求idempotency key、status和request hash/evidence。现有test只有粗粒度permission拒绝。预期验证resource scope拒绝、缺/过长idempotency、invalid status与active/inactive成功RPC body。 |
| 直接证据 | `adminRoutes.test.ts`只调用`handleSetProductStatus`一次且无publish permission；没有mock resource scope或write RPC、headers/body成功断言。 |
| 调用链/影响 | authenticated admin compatibility router → product status route → authorization scope RPC → status mutation RPC。越权、重复或状态映射回归不能由当前suite直接捕获。 |
| 建议方向 | 从修复时最新`zdt-next`建立独立product status route test批；回滚为撤回测试提交。 |
| 验证/回滚 | fixture覆盖coarse/resource denial、idempotency/input、active/inactive exact RPC scope/hash/evidence；回滚为revert独立测试提交。 |
| 独立复核 | 否；P2。 |

## F-0199｜安全中心兼容写入分支缺少完整直接测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce-api / security center compatibility；P2；高 |
| 类型 | 测试覆盖缺口、账号凭据/手机号/session生命周期正确性 |
| 位置 | `01_core_hexin/services/commerce-api/src/api/securityCenterRoutes.ts:16-134`；现有`securityCenterRoutes.test.ts` |
| 当前/预期 | handler覆盖安全资料读取、password reset、phone change、单设备撤销与其他设备撤销；现有tests仅覆盖password change、OTP未配置拒绝、phone-change匿名拒绝和revoke others。预期每个剩余handler的session/OTP/credential/PII/RPC响应边界均有direct fixture。 |
| 直接证据 | test只导入`handleChangePassword`、`handleSecurityOtp`、`handleRevokeOtherSessions`；未导入`handleSecurityCenter`、`handleResetPassword`、`handleChangePhone`或`handleRevokeSession`。 |
| 调用链/影响 | 这些是当前未注册的compatibility auth handlers（DC-0048/G1），故未将其未测分支判为当前线上事故；一旦兼容路由恢复，密码找回、换绑与设备撤销回归不能被现有suite直接捕获。 |
| 建议方向 | 从修复时最新`zdt-next`先决定是否继续承诺这些auth API；若保留，按reset/phone与session-center分成独立test批。 |
| 验证/回滚 | fixture覆盖session缺失、OTP成功/失败/限流、password/phone hash与cipher、single/current session cookie和RPC状态映射；回滚为revert独立测试提交。 |
| 独立复核 | 否；P2。 |

## F-0200｜OTP 投递与交付记录没有直接行为测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce-api / OTP delivery；P2；高 |
| 类型 | 测试覆盖缺口、验证码送达状态和失败传播正确性 |
| 位置 | `01_core_hexin/services/commerce-api/src/api/otpDelivery.ts:12-35`；现有`otpDelivery.test.ts` |
| 当前/预期 | adapter调用SMS provider，并在成功/失败时写`api_record_phone_challenge_delivery`；失败记录自身失败被吞掉以保留provider error。现有test仅断言30秒重发常量。预期直接覆盖debug/aliyun结果、record成功/失败、provider failure及原error code传播。 |
| 直接证据 | `otpDelivery.test.ts`只导入`OTP_RESEND_AFTER_SECONDS`；未导入`deliverOtp`或`otpDeliveryAvailable`，未mock send/provider或delivery RPC。 |
| 调用链/影响 | registration route / security compatibility route → OTP delivery → SMS provider + challenge delivery RPC。验证码用户体验、失败回执与后续challenge审计回归不能由当前suite直接捕获。 |
| 建议方向 | 从修复时最新`zdt-next`建立OTP delivery adapter test批；回滚为撤回测试提交。 |
| 验证/回滚 | fixture覆盖provider success/throw、delivery record success/fail、error code不被覆盖及availability；回滚为revert独立测试提交。 |
| 独立复核 | 否；P2。 |

## F-0201｜SMS provider 配置与传输异常映射没有直接测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce-api / SMS provider；P3；高 |
| 类型 | 测试覆盖缺口、配置错误/上游异常语义 |
| 位置 | `01_core_hexin/services/commerce-api/src/api/smsProvider.ts:39-63,91-104`；现有`smsProvider.test.ts` |
| 当前/预期 | provider在无Aliyun配置时以稳定`SMS_PROVIDER_NOT_CONFIGURED`拒绝，client throw时映射为`ALIYUN_SMS_UNAVAILABLE`。现有tests覆盖debug、成功request/timeout与provider rejection。预期缺失sign/template和client transport throw均有direct fixture。 |
| 直接证据 | `smsProvider.test.ts`没有未配置Aliyun `sendVerificationSms`调用，也没有令`sendSmsWithOptions` throw的fixture。 |
| 调用链/影响 | registration/security OTP → delivery adapter → SMS provider。异常文本/错误码回归将降低故障诊断与前端重试一致性，但不改变现有核心授权或持久化边界。 |
| 建议方向 | 从修复时最新`zdt-next`补两条adapter fixture；回滚为撤回测试提交。 |
| 验证/回滚 | 断言两种缺失配置和transport throw产生稳定错误code/message，不泄露provider detail；回滚为revert测试提交。 |
| 独立复核 | 否；P3。 |

## F-0202｜测试资金模拟路由没有直接行为测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce-api / payment simulation；P2；高 |
| 类型 | 测试覆盖缺口、测试资金状态/权限/环境隔离正确性 |
| 位置 | `01_core_hexin/services/commerce-api/src/api/paymentSimulationRoutes.ts:12-117` |
| 当前/预期 | routes在router和handler双重环境模式下才可调用；recharge/benefit/mixed payment均含permission、scope、idempotency/hash/evidence。未找到同层fixture。预期验证production 404、AUTH_MODE mismatch、target/permission/resource拒绝及每个成功RPC body。 |
| 直接证据 | `src/api`未找到`paymentSimulationRoutes.test.ts`或`handleSimulation*`调用；现有`validation.test.ts`仅测试本地parser。 |
| 调用链/影响 | API router → simulation router → simulation routes → test-only wallet/benefit/payment RPC。测试环境的资金状态、权限隔离或幂等参数回归无法被当前suite直接捕获；生产路径由two-layer 404 gate排除。 |
| 建议方向 | 从修复时最新`zdt-next`建立simulation route test批；回滚为撤回测试提交。 |
| 验证/回滚 | fixture覆盖环境/target/permission/scope/idempotency/input与四类success RPC body；回滚为revert测试提交。 |
| 独立复核 | 否；P2。 |

## F-0203｜运行时依赖容器不变量没有直接测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce / bootstrap Container；P3；高 |
| 类型 | 测试覆盖缺口、启动期依赖注册正确性 |
| 位置 | `01_core_hexin/services/commerce/src/bootstrap/Container.ts:1-29` |
| 当前/预期 | Container在configure期允许一次性token绑定、读取/has，freeze后拒绝新绑定；重复/缺失token立即抛错。现有ApiBootstrap test只验证NodeContext请求，未直接验证Container本身。预期所有不变量各有fixture。 |
| 直接证据 | 仓内未找到`Container.test.ts`、`new Container()`或`CONTAINER_FROZEN/BINDING_DUPLICATE/BINDING_MISSING`的direct test断言。 |
| 调用链/影响 | entry runtime configure → Container → module extension/node registry bindings → bootstrapApi。容器不变量回归将使运行进程在启动或首请求时出现难诊断的绑定错误，现有bootstrap test不能精确定位。 |
| 建议方向 | 从修复时最新`zdt-next`建立Container unit test批；回滚为撤回测试提交。 |
| 验证/回滚 | 分别断言bind/get/has、duplicate、missing与freeze后bind失败；回滚为revert测试提交。 |
| 独立复核 | 否；P3。 |

## F-0204｜扩展 manifest 签名校验没有直接密码学测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce / bootstrap SignatureVerifier；P2；高 |
| 类型 | 测试覆盖缺口、扩展信任边界 |
| 位置 | `01_core_hexin/services/commerce/src/bootstrap/SignatureVerifier.ts:1-22` |
| 当前/预期 | verifier以configured public key验证canonical `manifestPayload` 与base64 signature；CommerceRuntime注入后被extension install与Channel HTTP消费者读取。预期有效签名、payload篡改、signature篡改、错误public key与无效base64都有direct fixture。 |
| 直接证据 | 仓内未找到`SignatureVerifier.test.ts`或`new SignatureVerifier`的测试调用；`SignatureVerifier`仅在生产CommerceRuntime中构造。 |
| 调用链/影响 | CommerceRuntime → MANIFEST_VERIFIER token → extension install / channel route。签名参数、payload canonicalization或错误处理回归不能由当前suite在这一安全边界直接捕获。 |
| 建议方向 | 从修复时最新`zdt-next`建立临时签名密钥的verifier unit-test批；回滚为撤回测试提交。 |
| 验证/回滚 | 断言valid=true以及四类invalid=false/受控错误，不向日志写入key或signature；回滚为revert测试提交。 |
| 独立复核 | 否；P2。 |

## F-0205｜Catalog Operator API runtime 启动依赖和清理分支没有直接测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce / Catalog Operator API runtime；P2；高 |
| 类型 | 测试覆盖缺口、运行启动/资源清理正确性 |
| 位置 | `01_core_hexin/services/commerce/src/bootstrap/CatalogOperatorApiRuntime.ts:63-143`；现有`CatalogOperatorApiRuntime.test.ts` |
| 当前/预期 | runtime读取secrets、建立pool/object store，失败时结束pool；成功时暴露close以停止extensions并结束pool。现有test只覆盖node manifest和compatibility query的一种role失配。预期secrets缺失、object readiness失败/pool end、successful configure和close均有direct fixture。 |
| 直接证据 | test只导入`assertCatalogNodeManifest`、`bindCatalogOperatorNodeManifest`、`catalogOperatorRuntimeCompatibility`；没有`createCatalogOperatorApiRuntime`调用或secret/object/pool close mock。 |
| 调用链/影响 | CatalogOperatorApiMain/ReadyMain → runtime → secret store/database/object store/access pipeline。依赖失效或启动失败后的连接泄漏/错误语义回归不能由当前suite直接捕获。 |
| 建议方向 | 从修复时最新`zdt-next`拆为runtime dependency failure与successful-close两条test批；回滚为撤回测试提交。 |
| 验证/回滚 | fixture验证required config、secret read、object probe、compatibility failure pool end、configure bindings和close stops/ends；回滚为revert测试提交。 |
| 独立复核 | 否；P2。 |

## F-0206｜Provider factory 清单和未知 ID 拒绝没有直接测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce / ProviderFactories；P3；高 |
| 类型 | 测试覆盖缺口、外部provider注册一致性 |
| 位置 | `01_core_hexin/services/commerce/src/bootstrap/ProviderFactories.ts:1-32` |
| 当前/预期 | 静态factory表声明11个provider，`providerFactory`按ID返回或抛出`PROVIDER_FACTORY_MISSING`；ProviderLoader以它构造数据库中已启用provider。预期验证ID唯一、既定factory集合和unknown ID拒绝。 |
| 直接证据 | 未找到`ProviderFactories.test.ts`、`providerFactory(`测试调用或针对`PROVIDER_FACTORY_MISSING`的断言。 |
| 调用链/影响 | CommerceRuntime → ProviderLoader → providerFactory → channel extension registration。新增/改名provider后，映射错误只能在启动/加载时暴露。 |
| 建议方向 | 从修复时最新`zdt-next`补factory catalog与unknown-ID两条unit fixture；回滚为撤回测试提交。 |
| 验证/回滚 | 断言factory IDs唯一、预期ID能解析、unknown ID稳定抛错；回滚为revert测试提交。 |
| 独立复核 | 否；P3。 |

## F-0207｜CommandBus 注册与分派不变量没有直接测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce / foundation CommandBus；P3；高 |
| 类型 | 测试覆盖缺口、命令分派启动正确性 |
| 位置 | `01_core_hexin/services/commerce/src/foundation/application/CommandBus.ts:1-23` |
| 当前/预期 | bus拒绝freeze后注册和重复type，缺handler返回rejected promise，其他命令转交匹配handler。预期这些不变量各有direct fixture。 |
| 直接证据 | 未找到`CommandBus.test.ts`或针对`COMMAND_BUS_FROZEN`、`COMMAND_HANDLER_DUPLICATE`、`COMMAND_HANDLER_MISSING`的断言。 |
| 调用链/影响 | API/Jobs bootstrap → module registration → CommandBus freeze → HTTP/job command handler。注册或分派回归会在启动/请求时暴露且不易定位。 |
| 建议方向 | 从修复时最新`zdt-next`建立CommandBus unit test批；回滚为撤回测试提交。 |
| 验证/回滚 | 断言registration/execute、duplicate、missing及freeze语义；回滚为revert测试提交。 |
| 独立复核 | 否；P3。 |

## F-0208｜QueryBus 注册与分派不变量没有直接测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce / foundation QueryBus；P3；高 |
| 类型 | 测试覆盖缺口、读取分派启动正确性 |
| 位置 | `01_core_hexin/services/commerce/src/foundation/application/QueryBus.ts:1-23` |
| 当前/预期 | bus拒绝freeze后注册和重复type，缺handler返回rejected promise，其他查询转交匹配handler。预期这些不变量各有direct fixture。 |
| 直接证据 | 未找到`QueryBus.test.ts`或针对`QUERY_BUS_FROZEN`、`QUERY_HANDLER_DUPLICATE`、`QUERY_HANDLER_MISSING`的断言。 |
| 调用链/影响 | API/Jobs bootstrap → module registration → QueryBus freeze → HTTP/job query handler。注册或分派回归会在启动/请求时暴露且不易定位。 |
| 建议方向 | 从修复时最新`zdt-next`建立QueryBus unit test批；回滚为撤回测试提交。 |
| 验证/回滚 | 断言registration/execute、duplicate、missing及freeze语义；回滚为revert测试提交。 |
| 独立复核 | 否；P3。 |

## F-0209｜ModuleOperations 边界拒绝与生命周期异常没有直接测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce / foundation ModuleOperations；P3；高 |
| 类型 | 测试覆盖缺口、公共操作调度边界 |
| 位置 | `01_core_hexin/services/commerce/src/foundation/application/ModuleOperations.ts:83-120`；`.../ModuleOperations.test.ts:1-313` |
| 当前/预期 | 实现拒绝deadline/abort、module catalog不匹配、缺action和write short-circuit；lifecycle异常时调用discard。预期这些入口及异常清理契约有direct fixture。 |
| 直接证据 | 同目录fixture覆盖审计脱敏、read prepare/finalize和write idempotency replay，但未找到针对`DEADLINE_EXCEEDED`、`MODULE_OPERATION_CATALOG_MISMATCH`、`MODULE_OPERATION_OWNER_MISMATCH`、`OPERATION_ACTION_MISSING`、`WRITE_SHORT_CIRCUIT_FORBIDDEN`或`discard`的断言。 |
| 调用链/影响 | API/Jobs bootstrap → 各module ModuleOperations → read/write action。公共层边界回归会使错误操作进入错误workload或使预处理资源在异常时未清理，通常在请求或任务执行时才暴露。 |
| 建议方向 | 从修复时最新`zdt-next`建立仅测试小批次，覆盖catalog/owner/action拒绝、abort/deadline、write short-circuit与execute/finalize失败后的discard；回滚为撤回测试提交。 |
| 验证/回滚 | 断言各拒绝码、没有连接/写入副作用及discard接收原始cause；回滚为revert测试提交。 |
| 独立复核 | 否；P3。 |

## F-0210｜Generic BatchImport 生产状态机没有直接行为测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce / foundation BatchImport；P2；高 |
| 类型 | 测试覆盖缺口、异步批量导入状态与失败恢复 |
| 位置 | `01_core_hexin/services/commerce/src/foundation/application/BatchImport.ts:24-63` |
| 当前/预期 | 同一processor处理member/inventory/voucher导入的文件校验、stage、process、failure report、complete及permanent/retry失败分类。预期对每个状态分支和ObjectStore/port副作用有direct fixture。 |
| 直接证据 | 未找到`BatchImportProcessor`、`IMPORT_STATE_INVALID`、`IMPORT_PROCESSING_FAILED`或`JOB_KIND_MISMATCH`的测试断言；`app/jobs.ts:102-105,158-161`实际把三个生产job注册到对应子类，三者均继承该processor。 |
| 调用链/影响 | import queue → JobRunner → member/inventory/voucher BatchImportProcessor → ImportFile/ObjectStore/Pg*Import。回归可能让有效导入停在中间状态、把永久错误交给无效重试，或遗漏失败报告；线上是否发生未验证。 |
| 建议方向 | 从修复时最新`zdt-next`建立仅测试批次，以fake ObjectStore/BatchImportPort覆盖uploaded、ready、reporting、terminal early return、permanent reject、transient fault/rethrow、abort和wrong kind；回滚为撤回测试提交。 |
| 验证/回滚 | 断言state顺序、每个port调用、report object及permanent/transient分类；回滚为revert测试提交。 |
| 独立复核 | 否；P2。 |

## F-0211｜ExecutionKernel 特殊写入分支没有直接测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce / foundation ExecutionKernel；P3；高 |
| 类型 | 测试覆盖缺口、transactional write durability |
| 位置 | `01_core_hexin/services/commerce/src/foundation/application/ExecutionKernel.ts:39-58,75-130,158-166`；`.../ExecutionKernel.test.ts:15-85` |
| 当前/预期 | 现有fixture验证并发、replay、rollback、retry、key及write context；实现还支持provider无显式idempotency key的fallback、OperationRejection作为可持久化业务结果及checkpoint row-count丢失拒绝。预期每个特殊语义有direct assertion。 |
| 直接证据 | 未找到`providerBusinessKey`、`EXECUTION_CHECKPOINT_LOST`或OperationRejection→completed result的ExecutionKernel direct assertion。PaymentOperationSupport和IdentityPersistence直接调用claim/complete helper。 |
| 调用链/影响 | ModuleOperations → ExecutionKernel → idempotency/outbox/audit；PaymentOperationSupport/IdentityPersistence也复用helper。特殊分支回归会在provider callback或业务拒绝时暴露，当前线上影响未验证。 |
| 建议方向 | 从修复时最新`zdt-next`建立仅测试批次，覆盖request-id/hash fallback、OperationRejection持久化/replay及checkpoint 0-row拒绝；回滚为撤回测试提交。 |
| 验证/回滚 | 断言idempotency key、outbox、response与throw semantics；回滚为revert测试提交。 |
| 独立复核 | 否；P3。 |

## F-0212｜Step-up action proof 的一次性回放没有直接测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce / identity step-up / ModuleOperations；P3；高 |
| 类型 | 测试覆盖缺口、一次性业务授权凭据 |
| 位置 | `01_core_hexin/services/commerce/src/foundation/application/ModuleOperations.ts:255-258`；`.../OwnerActionCredentialPersistence.test.ts:8-75` |
| 当前/预期 | 当`identity.stepup.complete`成功结果含`actionProof.proof`时，replay projection应持久化固定`ACTION_PROOF_ONE_TIME_RESPONSE`而不是proof。预期该分支经真实ModuleOperations有direct fixture。 |
| 直接证据 | OwnerActionCredentialPersistence只请求`access.ownership.transfers.preview`并断言`IDENTITY_CREDENTIAL_RESPONSE_ONE_TIME`；仓内未找到`ACTION_PROOF_ONE_TIME_RESPONSE`或`identity.stepup.complete`结合`actionProof`的direct ModuleOperations assertion。 |
| 调用链/影响 | Identity step-up complete → ModuleOperations idempotency replay → owner/high-risk action proof consumer。回归可能使proof可从replay读取或错误地改变repeat行为；线上影响未验证。 |
| 建议方向 | 从修复时最新`zdt-next`建立仅测试批次，构造带`actionProof.proof`的stepup completion，经真实ModuleOperations断言首次可见、persisted response无proof、second request固定409且action单次执行；回滚为撤回测试提交。 |
| 验证/回滚 | 断言replay JSON/audit中不含proof，message为`ACTION_PROOF_ONE_TIME_RESPONSE`；回滚为revert测试提交。 |
| 独立复核 | 否；P3。 |

## F-0213｜VersionedKey 跨缓存目录与值边界没有直接测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce / foundation cache VersionedKey；P3；高 |
| 类型 | 测试覆盖缺口、缓存命名空间隔离 |
| 位置 | `01_core_hexin/services/commerce/src/foundation/cache/VersionedKey.ts:5-17`；`.../Cache.test.ts:4-12` |
| 当前/预期 | 实现从generated CACHE_CATALOG取字段并拒绝集合偏差，所有值base64url编码且拒绝空/超长。预期对experience与reporting catalog、extra/missing field和value边界都有direct fixture。 |
| 直接证据 | Cache.test只断言experience active/version区分与missing field；未找到`CACHE_KEY_VALUE_INVALID`、reporting `VersionedKey.create`或extra field的direct assertion。 |
| 调用链/影响 | Experience jobs/read、Reporting projection/read、WebBusiness dashboard → Cache → Redis。键形状回归可能导致缓存miss、意外共享或运行时错误；线上影响未验证。 |
| 建议方向 | 从修复时最新`zdt-next`建立仅测试批次，覆盖每个CACHE_CATALOG entry、extra/missing field、empty/512/513 length、字符编码和稳定namespace；回滚为撤回测试提交。 |
| 验证/回滚 | 断言全catalog键唯一且输入边界稳定抛错；回滚为revert测试提交。 |
| 独立复核 | 否；P3。 |

## F-0214｜Release HealthProbe 未验证请求探针与返回状态一致

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce / release smoke HealthProbe；P2；高 |
| 类型 | 发布验证正确性、运行状态误通过 |
| 位置 | `01_core_hexin/services/commerce/src/foundation/http/HealthProbe.ts:7-16`；`.../entry/SmokeMain.ts:4-9` |
| 当前/预期 | SmokeMain顺序请求`/health/live`、`/health/startup`、`/health/ready`；HealthProbe仅确认response `status`属于live/started/ready任一值。预期每个probe严格对应live→live、startup→started、ready→ready。 |
| 直接证据 | 代码的集合校验为`['live','started','ready'].includes(body.status)`，未引用`probe`决定期望status；例如live endpoint意外接到ready handler并返回200 `{status:'ready'}`会通过。仓内未找到HealthProbe direct test或`SMOKE_PROBE_INVALID`断言。 |
| 调用链/影响 | release smoke → SmokeMain → HealthProbe → production candidate `/health/*`。路由错配、错误的ready/live handler或代理映射可能让发布冒烟误判成功；未核验线上是否发生。 |
| 建议方向 | 从修复时最新`zdt-next`建立最小修复/测试批，显式映射probe→期望status并覆盖正确、2xx错误status、非2xx、无JSON状态与redirect拒绝；回滚为revert该独立批。 |
| 验证/回滚 | 以fake fetch断言每个请求只接受其预期status；回滚为revert提交。 |
| 独立复核 | 否；P2。 |

## F-0215｜HttpClient 超时、外部取消与重定向失败没有直接测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce / foundation HttpClient；P2；高 |
| 类型 | 测试覆盖缺口、外部依赖失败恢复 |
| 位置 | `01_core_hexin/services/commerce/src/foundation/http/HttpClient.ts:18-44`；`.../HttpClient.test.ts:4-32` |
| 当前/预期 | 实现分离connection/response timer、propagate外部deadline abort、默认redirect error并将三类传输失败交给Executor retry。预期这些可观察错误类型和retry边界有direct fixture。 |
| 直接证据 | 测试只覆盖throw→read retry、throw→none write single attempt、204 response；未找到`HTTP_CONNECTION_TIMEOUT`、`HTTP_RESPONSE_TIMEOUT`、`DEADLINE_EXCEEDED`或redirect的断言。 |
| 调用链/影响 | HealthProbe及provider/remote adapter → HttpClient → external HTTP dependency。超时或取消分支回归可能导致错误重试、错误分类或卡住的发布/业务调用；线上影响未验证。 |
| 建议方向 | 从修复时最新`zdt-next`建立fake-fetch/controlled signal测试批，覆盖connection timeout、response body timeout、external abort、redirect default/override和retry次数；回滚为撤回测试提交。 |
| 验证/回滚 | 断言每种错误码、signal状态和read/write retry次数；回滚为revert测试提交。 |
| 独立复核 | 否；P2。 |

## F-0216｜共享 CSV parser 没有直接格式与错误边界测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce / foundation Csv；P2；高 |
| 类型 | 测试覆盖缺口、导入与财务文件解析 |
| 位置 | `01_core_hexin/services/commerce/src/foundation/infrastructure/Csv.ts:1-27` |
| 当前/预期 | 解析器承担fatal UTF-8、BOM、quoted field、CRLF、row limit、header与column-count错误语义。预期正常与每种格式失败有direct fixture。 |
| 直接证据 | 未找到`parseCsv`、`CSV_ROW_LIMIT_EXCEEDED`、`CSV_QUOTE_UNTERMINATED`、`CSV_HEADER_INVALID`或`CSV_COLUMN_COUNT_INVALID`的测试断言。 |
| 调用链/影响 | ObjectStore import file → BatchImportProcessor；Finance ReconcileStatement → parseCsv。格式回归可能影响批量导入或对账解析并只在提交文件时暴露；线上影响未验证。 |
| 建议方向 | 从修复时最新`zdt-next`建立仅测试批，覆盖UTF-8/BOM/CRLF、quoted/escaped quote、empty rows、row limit、unterminated quote、invalid/duplicate header及column mismatch；回滚为撤回测试提交。 |
| 验证/回滚 | 断言解析records及每个稳定错误码；回滚为revert测试提交。 |
| 独立复核 | 否；P2。 |

## F-0217｜并行映射原语没有直接并发、顺序与失败契约测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce / foundation Parallel；P3；高 |
| 类型 | 测试覆盖缺口、并发任务失败传播 |
| 位置 | `01_core_hexin/services/commerce/src/foundation/performance/Parallel.ts:1-13` |
| 当前/预期 | 实现拒绝非法并发度、固定最多`min(concurrency, values.length)`个worker、按索引保持结果顺序。任一operation拒绝即使调用方失败，但运行中的operation没有取消输入。预期这些行为由direct fixture固定。 |
| 直接证据 | 未找到`mapParallel`的测试引用或performance fixture。生产仅在`VoucherJobProcessor.issue`与`PgVoucherImport.stage`的KMS加密阶段以并发度16调用。 |
| 调用链/影响 | Voucher issue/import → mapParallel → KMS encrypt。实现回归可使加密任务串行化、超出上限、结果错位或在首次失败后继续不受调用方控制的在途KMS操作；未核验线上影响。 |
| 建议方向 | 从修复时最新`zdt-next`建立仅测试批，覆盖非法/空输入、最大并发、输入顺序、同步/异步失败和失败后已启动operation的明确行为；若产品需取消语义，另立设计批而非把它隐式加入通用函数。 |
| 验证/回滚 | 用controlled deferred operation断言峰值并发、结果顺序、拒绝传播和失败后的完成数；回滚为revert该独立批。 |
| 独立复核 | 否；P3。 |

## F-0218｜CursorCodec 测试未覆盖其声明的非规范游标与位置边界

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce / foundation CursorCodec；P3；高 |
| 类型 | 测试可信度、分页契约边界 |
| 位置 | `01_core_hexin/services/commerce/src/foundation/interface/CursorCodec.ts:8-31`；`.../CursorCodec.test.ts:13-18` |
| 当前/预期 | 实现拒绝非版本1、非字符串、空值、超过512字符和不等于canonical re-encode的cursor。预期测试标题中声明的non-canonical场景与这些输入边界有具体断言。 |
| 直接证据 | 第二个test标题写有`non-canonical cursors`，正文只断言`plain`与version 2；未构造padding/等价JSON等non-canonical值，也未调用encode/decode验证空值、非字符串或长度边界。 |
| 调用链/影响 | Validation → risk/reporting/support/audit keyset query → API nextCursor。游标拒绝或规范化回归可能让分页请求出现错误分类、接受歧义位置或只在真实客户端cursor输入时暴露；线上影响未验证。 |
| 建议方向 | 从修复时最新`zdt-next`建立仅测试批，构造带padding或字段顺序变化的可解码非canonical cursor，并覆盖empty/oversize/non-string sort/id和freeze后的不可变结果；不改变已声明的游标协议。 |
| 验证/回滚 | 断言稳定错误码`CURSOR_INVALID`/`CURSOR_POSITION_INVALID`及decode正常值；回滚为revert该测试提交。 |
| 独立复核 | 否；P3。 |

## F-0219｜共享输入验证与分页解析只有部分 keyset 返回路径测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce / foundation Validation；P2；高 |
| 类型 | 测试覆盖缺口、公共请求输入与分页边界 |
| 位置 | `01_core_hexin/services/commerce/src/foundation/interface/Validation.ts:7-87`；`.../Pagination.test.ts:8-25` |
| 当前/预期 | 实现统一校验object body、文本/secret/整数、limit/cursor和keyset的lookahead/nextCursor。预期每个公共输入分支、query重复值处理和cursor position错误有direct fixture。 |
| 直接证据 | 唯一foundation fixture仅断言Date sort时有lookahead cursor和无lookahead时无cursor；未直接调用bodyRecord、各field helper、limit、queryPage、cursor，也未覆盖number sort、invalid result position或repeated query value。 |
| 调用链/影响 | HTTP OperationController → OperationRequest → Validation → 多个benefit/verification/qualification/voucher/notification/channel/risk/reporting操作。公共验证回归可能跨多个写入或列表API产生接受/拒绝差异、分页错误或运行时异常；线上影响未验证。 |
| 建议方向 | 从修复时最新`zdt-next`建立仅测试批，覆盖body类型、trim/empty/max、secret保留空白、integer安全范围、limit默认/上下界/repeated value、cursor解码和keyset string/number/invalid position；回滚为撤回该测试批。 |
| 验证/回滚 | 断言稳定error code、冻结page和分页body/cursor；回滚为revert提交。 |
| 独立复核 | 否；P2。 |

## F-0220｜NodeServer ingress fixture 未覆盖请求体、取消、错误和响应写回边界

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce / foundation NodeServer；P2；高 |
| 类型 | 测试覆盖缺口、HTTP ingress/egress失败边界 |
| 位置 | `01_core_hexin/services/commerce/src/foundation/interface/NodeServer.ts:23-108`；`.../NodeServer.test.ts:11-145` |
| 当前/预期 | 实现限制body为2MiB、把request/response close映射为abort、将body过大→413、节点Host错误→421、其余→500，并写回headers/set-cookie。预期每个可观察边界有端到端fixture。 |
| 直接证据 | 测试仅覆盖node context一次解析、未知Host 421、health不解析node与trustedPeerAddress；未发送oversize body、断开客户端、handler exception/listen failure或header/set-cookie response。 |
| 调用链/影响 | Caddy loopback reverse proxy → NodeServer → HttpApp → 全部API入口。转换或响应边界回归可能在高负载、断连、异常或cookie/header响应时造成错误状态/资源处理异常；线上影响未验证。 |
| 建议方向 | 从修复时最新`zdt-next`建立受控local socket/handler fixture批，覆盖2MiB阈值、request abort、413/421/500 body、set-cookie重复header与close/ready error；回滚为撤回测试提交。 |
| 验证/回滚 | 断言status、稳定JSON code、handler是否调用、AbortSignal reason与response headers；回滚为revert提交。 |
| 独立复核 | 否；P2。 |

## F-0221｜ErrorMapper fixture 只固定冲突与未知错误，遗漏公共映射分支

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce / foundation ErrorMapper；P2；高 |
| 类型 | 测试覆盖缺口、HTTP错误契约稳定性 |
| 位置 | `01_core_hexin/services/commerce/src/foundation/interface/ErrorMapper.ts:5-24`；`.../ErrorMapper.test.ts:4-25` |
| 当前/预期 | Mapper以contract errorStatus决定可暴露错误，普通Error截取冒号前code，DomainError保留details，未注册、500或非Error统一为internal。预期各输入类别和主要status族有direct fixture。 |
| 直接证据 | 三个fixture只验证IDEMPOTENCY/库存等409和unregistered 500；未构造DomainError、`VALIDATION_FAILED:field`、非Error、contract的400/401/403/404/422/429等code或contract明确为500的code。 |
| 调用链/影响 | Route/Operation handler throw → HttpApp catch → ErrorMapper → public JSON response。映射漂移可能将可处理错误错误地隐藏为500、丢失合法details或暴露错误code，并跨所有API生效；线上影响未验证。 |
| 建议方向 | 从修复时最新`zdt-next`建立fixture-only批，枚举每个status族代表code、冒号截取、DomainError details、non-Error和registered-500防泄漏；回滚为撤回测试提交。 |
| 验证/回滚 | 断言status/body的code/requestId/details存在性及internal fallback；回滚为revert提交。 |
| 独立复核 | 否；P2。 |

## F-0222｜QueryMetrics 没有直接聚合与快照契约测试

| 字段 | 记录 |
| --- | --- |
| 模块/级别 | commerce / foundation QueryMetrics；P3；高 |
| 类型 | 测试覆盖缺口、运行可观测性 |
| 位置 | `01_core_hexin/services/commerce/src/foundation/persistence/QueryMetrics.ts:13-32` |
| 当前/预期 | 实现按workload累计执行/失败/总耗时/最大耗时，并排序、冻结snapshot。预期多次成功/失败、workload排序及snapshot不可变性有direct fixture。 |
| 直接证据 | 未找到QueryMetrics或`databaseQueries`直接断言。RuntimeOperations fixture只构造空metrics用于其它SQL文本断言，未调用observe/snapshot。 |
| 调用链/影响 | PoolSet connect/query/client proxy → QueryMetrics → runtime.health.dependency databaseQueries。指标回归可能误导运维诊断、隐藏失败数或产生非确定性快照；不改变业务数据库执行，线上影响未验证。 |
| 建议方向 | 从修复时最新`zdt-next`建立仅测试批，覆盖跨workload累计、failed count、total/max、字母排序、snapshot/entry冻结及后续observe不回写旧snapshot；回滚为撤回测试提交。 |
| 验证/回滚 | 断言完整QueryMetric数组、Object.isFrozen与旧/新snapshot隔离；回滚为revert提交。 |
| 独立复核 | 否；P3。 |

## 30. AU-030 新增未定级事项

- [UNKNOWN] 线上Jdfresh installation、库存任务和tracking失败状态未核验；F-0122保持P1候选而非P0。

## 31. AU-031 新增未定级事项

- [UNKNOWN] Jdproduct线上是否enabled、是否有Return固定caller、以及Return语义是否由外部流程承接；未核验线上installation与实际订单/退单链路。

## 32. AU-032 新增未定级事项

- [UNKNOWN] Movie provider线上是否启用、履约/退货/售后调用是否由外部caller承接；未核验已覆盖的`F-0130`到`F-0132`外部定级影响。

## 33. AU-033 新增未定级事项

- [UNKNOWN] Private provider 线上是否有启用实例、是否有进行时 tracking 查询请求；未核验时上述P1候选的真实事故边界。

## 34. AU-034 新增未定级事项

- [UNKNOWN] Tmallmarket 线上是否有 Return caller 及退货能力正式流程；未核验时`F-0130`为 P2候选不等于P0。

## 35. AU-035 新增未定级事项

- [UNKNOWN] Tmall vendor 适配器是否有仓外消费者、兼容导出或历史接线；未核验时`F-0133`定位为 P3 候选不等于 P0。

## 36. AU-036 新增未定级事项

- [UNKNOWN] JD vendor 适配器是否有仓外消费者、兼容导出或历史接线；未核验时`DC-0043`定位为 G1 候选不等于立即删。

## 37. AU-037 新增未定级事项

- [UNKNOWN] Wanlian vendor 转发导出是否存在外部兼容消费者；未核验时`DC-0044`仅为 G1 候选不等于立即删。

## 38. AU-038 新增未定级事项

- [UNKNOWN] Wenxuan vendor 是否存在外部兼容消费路径；未核验时`DC-0045`仍是保守 G1 候选，不等于立即删。

## 39. AU-039 新增未定级事项

- [UNKNOWN] 无新增问题条目；本批次主要复核既有结论 `F-0130/F-0131/F-0132` 对 `movie` 的口径闭合影响边界。

## 40. AU-040 新增未定级事项

- [UNKNOWN] 无新增问题条目；本批次主要复核既有结论 `F-0130/F-0131` 对 `tmallmarket` 实施边界与 `providerLoader` 映射一致性。

## 41. AU-041 新增未定级事项

- [UNKNOWN] 无新增问题条目；本批次主要复核既有结论 `F-0127/F-0128/F-0129` 与 `private` 本地端口实际调度一致性。

## 42. AU-042 新增未定级事项

- [P3] `services/commerce-api`、`api-contract`、`smart-wing-authz`、`auth-web`、`storefront-web` 为“无 extends”配置，继承策略与根基线不同；本批次仅形成治理项，不影响当前可复现运行路径结论。[UNKNOWN] 未见直接生产事故。
- [P3] 归档目录 `05_docs_ziliao/VI_shijue/version-upgrades/ZHU-VI-1.2|1.3/source/packages/design/tsconfig.json` 指向缺失 `extends` 基文件；当前仅落在归档区，未见 build/test 入口引用。

## 43. AU-043 新增未定级事项

- [P3] Console 个人信息页存在 `access.center.read` 分页 cursor 未消费风险（F-0137）；建议补充分页冒烟与修复验证后再定级。未发现 P0 级证据。

## 44. AU-044 新增未定级事项

- [P3] `AccessQuery` 本身支持 cursor，但 `settings/profile`、`settings/access` 和 `settings/members` 的 access 补充数据未形成连续取页：前两者固定首屏，成员页仅推进 member cursor。对应既有 `F-0137`；本批次未新增独立问题。未发现 P0 级证据。

## F-0234｜Compatibility 用户名注册限流与项目既定身份规则冲突

| 字段 | 记录 |
| --- | --- |
| 模块 | Compatibility 注册 / 身份 |
| 类型 | 可用性、身份流程治理 |
| 严重级别 | **P2** |
| 置信度 | 高 |
| 文件和精确位置 | `commerce-api/src/api/registrationRoutes.ts:16-41,94-110`；`storefront-compatibility/.../20260812250000_username_password_registration.sql:1-78`；`storefront-compatibility/.../20260815123000_wechat_registration_aliyun_sms.sql:38-91` |
| 当前行为 | 用户名注册路由先调用 `api_username_registration_allowed`，migration 按 IP hash 记录一小时窗口，十次以上返回 429/阻断；短信注册和账户安全挑战再按手机号十五分钟五次、IP 一小时二十次返回 429，错误验证码也会增加最多五次的尝试计数。测试明确固定用户名限流及短信 challenge 创建路径。 |
| 预期行为 | 项目既定规则要求不保留登录/注册失败限流、锁定或冷却。 |
| 直接证据 | AU-291 的源码、迁移和 `registrationRoutes.test.ts:121-160`；AU-292/AU-293 的手机挑战与账户安全迁移；AU-304 的发送状态迁移、`registrationRoutes.test.ts:20-34` 和 `otpDelivery.ts:13-29`。 |
| 用户影响 | 合法用户可因同 IP 既往尝试被拒绝注册一小时，或因已有手机号验证码发送、错误码尝试记录被暂时阻断。 |
| 建议方向 | 后续从修复时最新主线建立单一用途修复分支，同时移除 API 与数据库两层注册/验证码限流及对应测试，再做真实注册、短信发送和账户安全验证。 |
| 验证与回滚 | 以受控注册、验证码发送和错误验证码请求验证不返回 429 或因累计次数锁定；回滚为独立提交恢复原规则。 |

## F-0235｜Compatibility 登录失败锁定与项目既定身份规则冲突

| 字段 | 记录 |
| --- | --- |
| 模块 | Compatibility 登录 / 二次验证 / 微信绑定 |
| 类型 | 可用性、身份流程治理 |
| 严重级别 | **P2** |
| 置信度 | 高 |
| 文件和精确位置 | `database/supabase/migrations/20260817190000_login_attempt_limit_ten.sql:5-49`；`commerce-api/src/api/publicRoutes.ts:76-110`；`commerce-api/src/api/wechatAuthRoutes.ts:84-94`；`commerce-api/src/api/stepUpRoutes.ts:11-29` |
| 当前行为 | `login_attempts` 按 IP hash 计数；第 10 次失败在 15 分钟窗口内设置 `blocked_until`，所有共用 `api_login_allowed` 的登录、微信绑定、二次验证和初始密码变更请求在此期间返回 429。 |
| 预期行为 | 项目既定规则要求不保留登录失败锁定、限流或冷却。 |
| 直接证据 | AU-305 调用链与 `loginRateLimitBypass.test.ts:91-111`，以及 AU-386 的当前函数定义；前者明确断言非白名单地址被 limiter storage 阻断时返回 `LOGIN_RATE_LIMITED` 429。 |
| 调用链/运行入口 | Console/公开登录与微信绑定、二次验证路由 → `api_login_allowed` / `api_record_login_failure` → `login_attempts`。 |
| 用户影响 | 同一出口网络中的合法用户可因其他人连续输错密码而在 15 分钟内无法登录、绑定或完成二次验证。 |
| 数据/安全影响 | 仅记录哈希化 IP 和失败次数；主要影响是可用性，未见本批次证据表明已造成线上事故。 |
| 根因 | 共享的 IP 失败累计器被设计为身份尝试门禁，并被多个入口复用。 |
| 建议方向 | 待第二轮独立复核后，从修复时最新 `zdt-next` 建立单一用途修复分支，移除该累计阻断及入口 429 分支，并同步调整测试。 |
| 预计修改范围 | Compatibility 数据库登录尝试 RPC、其直接路由调用方和定向测试；不得在审计分支修复。 |
| 验证/回滚 | 受控连续失败请求不再触发 `blocked_until` 或 429；回滚为 revert 独立修复提交。 |
| 独立复核 | **是（P2）**；需重新检查所有 `api_login_allowed` 与 `api_record_login_failure` 调用入口。 |

## F-0236｜模拟资金写入的并发幂等响应不稳定

| 字段 | 记录 |
| --- | --- |
| 模块 | Compatibility 测试支付模拟 |
| 类型 | 正确性、并发、幂等 |
| 严重级别 | **P2** |
| 置信度 | 高 |
| 文件和精确位置 | `storefront-compatibility/.../20260810160000_test_payment_simulation.sql:167-178,195-214,243-290`；`.../20260724070000_production_mvp.sql:321-332` |
| 当前行为 | 充值、发放和混合支付 RPC 都先查询 `idempotency_keys`，但未取得同一幂等键的事务锁，也未在后续资金/订单行锁返回后重读；三者最后才插入拥有 `(mall_id, scope, idempotency_key)` 主键的记录。 |
| 预期行为 | 同一幂等键、同一请求哈希的并发重试应稳定返回首次响应，不能以唯一键冲突作为正常重试的结果。 |
| 直接证据 | 充值行 167→169→178、发放行 195→203/200→214、混合支付行 243→245→290 的顺序；幂等键主键定义见 20260724070000:321-332。迁移中未出现对应的 `pg_advisory_xact_lock`，且未发现并发幂等测试。 |
| 调用链/运行入口 | 仅 development/test：simulation router → paymentSimulationRoutes → service-role RPC。 |
| 用户影响 | 双击、网络重试或并发回放同一模拟操作时，第二个请求可在等待账户/订单锁后因唯一键冲突返回失败，而非返回首个成功结果。 |
| 数据影响 | PostgreSQL 事务会回滚第二个请求，未见双重资金扣记的静态证据；但调用方获得的幂等结果不稳定。 |
| 根因 | 幂等存在性检查与唯一键写入之间缺乏以请求键为粒度的串行化。 |
| 建议方向 | 经第二轮独立复核后，从修复时最新 `zdt-next` 建立单一用途分支，在每个模拟 RPC 的幂等检查前增加一致的请求键事务锁或等价的原子占位/重读模式，并添加并发重试测试。 |
| 预计修改范围 | 三个模拟 RPC 与其定向数据库/路由并发测试；不得在审计分支修复。 |
| 验证/回滚 | 并发提交相同 key 与 hash，断言两个请求返回同一响应且仅一组账本/支付事实；回滚为 revert 独立修复提交。 |
| 独立复核 | **是（P2）**；需重新检查 PostgreSQL `READ COMMITTED` 锁等待后的可见性和三条 RPC 的最终实现。 |

## F-0237｜成员资料写入未以目标成员范围重新授权

| 字段 | 记录 |
| --- | --- |
| 模块 | Compatibility 成员运营 / 授权范围 |
| 类型 | 权限边界、跨商城数据写入 |
| 严重级别 | **P2** |
| 置信度 | 高（静态调用链）；真实跨商城请求未验证 |
| 文件和精确位置 | `commerce-api/src/api/memberOperationsRoutes.ts:81-105`；`commerce-api/src/api/auth.ts:18-36`；`storefront-compatibility/.../20260813010000_member_operations_center.sql:188-213` |
| 当前行为 | `handleUpdateMemberProfile` 对 `member.update` 调用不传目标资源范围，因而使用当前操作者的 `contextResourceScope`。随后把 URL 中的 `membershipId` 直接交给 RPC；RPC 对目标仅限定 `tenant_id` 与 `enterprise_id`，没有限定 `target.mall_id = p_mall_id`，也没有核对操作人对目标范围的授权。 |
| 预期行为 | 资源特定写入应先加载目标 membership 的服务器范围并以其调用授权，数据库写入也应拒绝当前商城/授权范围之外的目标。 |
| 直接证据 | `auth.ts:18-20` 明确要求资源特定路由先加载目标行并把其 scope 传给 `authorize()`；本路由未执行该步骤。`api_update_member_profile` 的目标查询为同租户同企业 membership，而更新用户资料及审计写入均不比较 target mall。`member_operations_contract.sql:35-51` 仅验证同商城 Owner 的正常更新与 Owner 保护，未构造跨商城拒绝场景。 |
| 调用链/运行入口 | `adminRouter` 的 `/api/v1/admin/member-operations/members/:id` → `handleUpdateMemberProfile` → service-role `api_update_member_profile` → `users` / `memberships` / audit log。 |
| 用户影响 | 若商城范围管理员取得同一企业其他商城的 membership ID，可能修改该会员显示名、邮箱或部门；部门变更还会递增该成员所有 membership 的授权版本。目标 ID 的实际跨商城可获得性尚未验证。 |
| 数据/安全影响 | 用户资料、部门归属和审计记录可能在越权范围内被改写；未见本次静态审计证据表明已造成线上事故。 |
| 根因 | 当前操作人 scope 被误当作目标资源 scope，且数据库包装 RPC 未作对应的目标商城/授权范围校验。 |
| 建议方向 | 独立复核确认后，从修复时最新 `zdt-next` 建立单一用途修复分支：先加载 target membership 的受信范围并传入授权决策；在 RPC 内增加与目标商城和操作人 scope 一致的防御性校验，并补充跨商城拒绝测试。不得在审计分支修复。 |
| 预计修改范围 | `memberOperationsRoutes`、受信 target scope lookup/契约、`api_update_member_profile` 与定向授权测试。 |
| 验证/回滚 | 构造同租户同企业、不同商城的 mall-scoped 管理员和目标；断言 API/RPC 不改写目标，且同范围更新仍成功。回滚为 revert 独立修复提交。 |
| 独立复核 | **是（P2）**；复核必须重新检查 API 授权 scope 与数据库目标约束，不能只复述本报告。 |

## F-0238｜售后提交 RPC 与数据库迁移/发布来源脱节

| 字段 | 记录 |
| --- | --- |
| 模块 | Compatibility Storefront 售后 / Supabase 发布契约 |
| 类型 | API 契约、迁移与运行单元边界 |
| 严重级别 | **P2** |
| 置信度 | 高（静态调用和权限演进）；线上实际数据库来源未验证 |
| 文件和精确位置 | `commerce-api/src/api/routes/storefrontRouter.ts:31-37`；`commerce-api/src/api/orderRoutes.ts:20-45`；`commerce-api/src/api/supabase.ts:8-27`；`database/supabase/migrations/20260820120000_after_sale_refund_approval.sql:311-314,469-473`；`infrastructure/release/zdt-next.remote-policy.json:57`；`config/owner-approved-ui.json:28-32` |
| 当前行为 | Storefront 的 `POST /api/v1/after-sales` 调用 `api_create_after_sale`，且 `callRpc` 始终携带 service-role key。canonical 后续迁移撤销旧函数对 service_role 的执行权，只授权 `api_create_after_sale_authorized`；固定基线未找到该授权包装器的 Commerce API 调用。正式迁移政策指定 canonical `database/supabase/migrations`，但业主批准 UI 清单要求 compatibility 迁移，兼容制品清单又标记为不可发布。 |
| 预期行为 | 已发布服务、实际迁移序列与被授权 RPC 必须形成唯一、可验证的组合；售后提交不能依赖已撤权 RPC，也不能因数据库源选择不明而获得不确定行为。 |
| 直接证据 | 路由和 handler 的直接调用；`callRpc` 的 service-role Authorization header；旧函数在 canonical 迁移中 `revoke ... from service_role`，新 wrapper 获唯一 grant；三个发布/批准配置的数据库来源声明。 |
| 调用链/运行入口 | Storefront 请求 → `routeStorefrontRequest` → `handleCreateAfterSale` → service-role REST RPC → `api_create_after_sale`；canonical migration runner → `database/supabase/migrations`。 |
| 用户影响 | 若当前 Storefront API 使用 canonical 已迁移数据库，提交售后会因无执行权限失败；若继续使用 compatibility 数据库，则实际服务数据库与正式迁移控制面不一致。实际线上组合尚未只读核验。 |
| 数据/安全影响 | 未见静态证据表明会产生部分写入；主要风险是售后申请不可用、迁移事实漂移和后续回滚无法可靠判定。 |
| 根因 | 旧 RPC 被安全包装替代后，调用方未同步到新契约；同一服务的数据库来源在发布控制资料中未收敛为单一事实。 |
| 建议方向 | 先进行只读独立复核，确定生产服务使用的数据库、已应用 migration ledger 与目标 RPC grant；确认后从当时最新主线建立单一用途分支，同步唯一的服务调用和迁移来源声明，不在审计分支处理。 |
| 预计修改范围 | 售后服务路由/RPC 参数、对应数据库授权包装器、迁移/发布配置和定向售后集成测试；具体范围取决于独立复核的实际数据库来源。 |
| 验证/回滚 | 在隔离数据库应用目标迁移序列，以 service-role 调用 Storefront 售后提交并验证 201、售后/订单/审计原子事实；回滚为撤回独立修复提交。 |
| 独立复核 | 建议；必须先取证实际部署数据库与 ledger，不能将任一配置文件单独视为线上事实。 |

## F-0239｜退款与财务对账 RPC 同样脱离 canonical 迁移契约

| 字段 | 记录 |
| --- | --- |
| 模块 | Compatibility Admin 退款/财务对账 / Supabase 发布契约 |
| 类型 | API 契约、迁移与运行单元边界 |
| 严重级别 | **P2** |
| 置信度 | 高（静态调用和权限演进）；线上实际数据库来源未验证 |
| 文件和精确位置 | `commerce-api/src/api/orderRoutes.ts:165-185`；`commerce-api/src/api/supabase.ts:8-27`；`database/supabase/migrations/20260820120000_after_sale_refund_approval.sql:460-463`；`database/supabase/migrations/20260820128000_wechat_refund_closure.sql:1228-1232,1404-1416` |
| 当前行为 | 管理员退款仍调用 `api_execute_internal_refund`，财务对账仍调用 `api_finance_reconciliation`；调用使用 service-role key。canonical 迁移先撤权/删除旧退款 RPC，随后撤权/删除旧对账 RPC，只授权 `api_finance_reconciliation_authorized` 等新契约；固定基线没有发现 Commerce API 调用替代包装器。 |
| 预期行为 | 实际运行服务应只调用已应用数据库迁移序列中仍获授权的退款与对账契约，并向其提供所需成员身份/授权证据。 |
| 直接证据 | 两个 `callRpc` 调用、service-role header、两段后续 `revoke`/`drop` 和新授权函数定义/授予。F-0238 已记录同一服务的数据库来源控制面分歧。 |
| 调用链/运行入口 | 管理后台退款/对账请求 → `orderRoutes` → service-role REST RPC → 旧内部退款/对账函数；canonical 后续 migration runner → 删除旧函数。 |
| 用户影响 | 若运行服务指向 canonical 已迁移数据库，管理员退款和财务对账将因函数不存在或无执行权失败；若继续使用 compatibility 数据库，服务与正式迁移控制面继续分裂。实际线上组合未验证。 |
| 数据/安全影响 | 未见静态证据表明会产生部分退款写入；主要风险是运营退款不可用、对账不可用和授权审计事实未进入新包装器。 |
| 根因 | 旧内部退款/对账 RPC 被授权闭环替代后，服务路由未同步；发布数据库来源未收敛为单一事实。 |
| 建议方向 | 与 F-0238 合并进行只读部署/ledger 复核后，从当时最新主线建立单一用途修复分支，统一数据库来源并把路由切至实际目标授权 RPC，补充真实 service-role 契约测试；不得在审计分支修复。 |
| 预计修改范围 | Admin 路由、退款/对账 RPC 参数与授权证据、迁移/发布配置、定向退款与对账集成测试。 |
| 验证/回滚 | 隔离数据库应用目标迁移，以最小管理员身份调用退款和对账，验证成功、幂等回放及审计事实；回滚为撤回独立修复提交。 |
| 独立复核 | 建议；先确认实际部署数据库、migration ledger、函数定义和 grant。 |

## F-0240｜登录快速路径投影未被应用消费

| 字段 | 记录 |
| --- | --- |
| 模块 | Supabase 登录候选 / Commerce API 本地登录 |
| 类型 | 性能、维护性、契约漂移 |
| 严重级别 | **P3** |
| 置信度 | 高 |
| 文件和精确位置 | `database/supabase/migrations/20260817120000_login_runtime_fast_path.sql:7-47`；`commerce-api/src/api/publicRoutes.ts:230-257` |
| 当前行为 | 候选 RPC 为每个 active entrance 构建 `runtime=api_resolve_membership_context(...)`；应用仅检查 entrances 是否为单项，随后仍调用 `resolveMembershipRuntimeByIds` 取得会话运行时。 |
| 预期行为 | 若保留快速路径，应用应消费经验证的 runtime 投影；若继续单独解析，则候选 RPC 不应计算且返回未消费的每入口 runtime。 |
| 直接证据 | SQL 的 `entrances.runtime` 字段；TypeScript 只读取 `Array.isArray(candidate.entrances)` 与 `length`，最后无条件调用 `resolveMembershipRuntimeByIds`。 |
| 用户影响 | 多 entrance 成员登录多出无效数据库计算和一次 runtime RPC；未见静态证据表明改变身份或权限结果。 |
| 根因 | 数据库快速路径与应用会话创建路径未一起迁移。 |
| 建议方向 | 独立小批次选择唯一方案：消费并校验候选 runtime，或删除未消费的 runtime 子投影；先核验仓外 service-role 消费者。 |
| 验证/回滚 | 对单/多入口登录测量 RPC 数与会话身份一致性；回滚为 revert 独立提交。 |
| 独立复核 | 否；若改动公共候选响应，需兼容性复核。 |

## F-0241｜券资金写入 RPC 未在数据库边界校验动作权限

| 字段 | 记录 |
| --- | --- |
| 模块 | Supabase 券运营 / 备券、审批、发行、状态变更、核销、冲正与对账 |
| 类型 | 身份与权限、资金正确性 |
| 严重级别 | **P1 候选**；需独立复核当前数据库迁移 ledger 与 service-role 调用者后定级。 |
| 置信度 | 高（固定基线 SQL 定义和权限表直接核验）；线上是否有调用者未验证。 |
| 文件和精确位置 | `database/supabase/migrations/20260820110000_voucher_operations_foundation.sql:14-58,710-1263`。 |
| 当前行为 | 迁移定义了 `voucher.reserve.create`、`voucher.reserve.approve`、`voucher.issue`、`voucher.status.manage`、`voucher.redeem`、`voucher.redemption.reverse`、`voucher.reconcile` 并分配给不同角色；七个对应的 `*_authorized` 写入 RPC 仅验证 membership 与 operator 匹配、同一经营范围、输入和幂等，不调用权限判定或授权证据校验。 |
| 预期行为 | 每个高风险写入动作应在数据库边界核验其对应 permission，且需要时校验会话授权证据；不能仅因调用者拥有任一 admin membership 和同一 scope 而放行。 |
| 直接证据 | 权限/角色映射位于 14–58 行；全文没有 `api_membership_has_permission` 或 `api_authorization_evidence_matches` 调用。各写入函数的共同 guard 是 `api_voucher_membership_actor_matches` 与 `api_voucher_membership_scope_allows`。 |
| 调用链或运行入口 | service-role → `api_create_voucher_reserve_authorized` / `api_decide_voucher_reserve_authorized` / `api_issue_voucher_batch_authorized` / `api_change_voucher_status_authorized` / `api_redeem_voucher_authorized` / `api_reverse_voucher_redemption_authorized` / `api_reconcile_voucher_void_hold_authorized`。固定基线未找到仓内 HTTP/Worker 调用者。 |
| 用户/数据/安全影响 | 若任意 service-role 调用路径可被低权限同范围 admin 到达，其可越过职责隔离申请、批准、发行、核销、冲正或完成对账，改变券余额和不可变审计链；当前线上可达性与历史影响未验证。 |
| 根因 | 将「授权」命名为函数后只实现身份和范围 guard，未将先前定义的动作权限接入写入条件。 |
| 建议方向 | 先独立复核实际迁移 ledger、service-role 网络边界与调用者；若链路启用，从当时最新主线建立单一修复分支，为每个动作接入对应 permission/授权证据检查并补充拒绝性集成测试。 |
| 验证/回滚 | 隔离数据库中为每个角色测试允许动作及相同 scope 但缺少目标 permission 的拒绝路径，验证余额、状态事件、审计和幂等；回滚为撤回独立修复提交。 |
| 独立复核 | 是；P1 候选必须重新追踪数据库 grant、调用者和所有动作权限。 |

## F-0242｜门店范围函数替换曾移除成员到组织的授权路径，后续迁移恢复

| 字段 | 记录 |
| --- | --- |
| 模块 | Access scope / Store management / Member operations |
| 类型 | 身份授权回归（已由后续迁移修复） |
| 严重级别 | P2 |
| 置信度 | 高：前序迁移与修复迁移的 SQL、注释和正反断言直接证明；未证实线上受影响量。 |
| 文件和精确位置 | `migrations/20260821069000_add_store_management.sql:3-14`、`20260821080000_restore_member_scope_authorization.sql:3-59`；消费者包括 `BenefitOperations.ts:58,93,176,231`、`VoucherQueries.ts:12-75`。 |
| 当前行为 | 固定基线已包含 800 修复：active membership 可访问自身 member、所属组织及其子树；无关 scope 返回 false。 |
| 预期行为 | 所有 scope 函数替换必须保留既有 audience 的授权语义，或在同一原子发布单元中显式迁移并验证。 |
| 直接证据 | [FACT][E-AU-476/486] 690 定义只检查 app.scope/组织/partner；800 明确写明其“accidentally removed the member-to-organization path”，补回 membership 分支，并断言 member/organization allow 与 unrelated deny。 |
| 调用链或运行入口 | AccessPipeline/DatabaseContext → `app.scope_id`/`app.membership_id` → `access.scope_allowed` → member、benefit、voucher 等 SQL 范围过滤。 |
| 用户影响 | [INFERENCE] 在 690 已执行且 800 未执行的窗口，成员路径可能被错误拒绝，表现为数据/权益/卡券查询不可用。 |
| 数据影响 | 证据指向 fail-closed 可用性回归，未证明越权写入或数据损坏。 |
| 安全影响 | 修复仍断言无关 scope 拒绝；未发现授权扩大证据。 |
| 根因 | 把 operator/partner scope 的函数替换当作完整实现，遗漏此前 member audience 分支。 |
| 建议方向 | 后续每次替换 shared authorization function 均以行为矩阵覆盖 operator、member、partner、无关 scope；作为独立修复/验证批次，不在审计分支修改。 |
| 预计修改范围 | 授权函数/迁移断言和定向 SQL 行为测试；不触及业务功能。 |
| 验证方式 | 隔离数据库按执行顺序验证 690→800，分别探测 member/self/organization/child/unrelated、operator/partner 路径，并核对实际 current definition。 |
| 回滚方式 | 回退单一已验证的 authorization migration 或恢复前一函数定义；须先确认当前 schema head。 |
| 是否需要独立复核 | 否（P2）；若查到线上窗口存在实际成员操作错误，复核影响范围与严重度。 |

## F-0243｜财务动作凭证签发后未接入命令事务消费

| 字段 | 记录 |
| --- | --- |
| 模块 | Identity step-up / AccessPipeline / Finance 与 Invoice 高风险操作 |
| 类型 | 身份与权限、重放防护、并发正确性 |
| 严重级别 | **P1 候选**；须完成独立复核后定级。 |
| 置信度 | 高（固定基线源码和迁移定义直接核验）；正式数据库 ledger、service-role 调用者及线上可达性未验证。 |
| 文件和精确位置 | `database/supabase/migrations/20260828092000_finance_security_boundaries.sql:218-361,365-375`；`commerce/src/modules/identity/05_interface_jieru/http/MobileWechatOperations.ts:205-235`；`commerce/src/foundation/security/AccessPipeline.ts:90-96`；`commerce/src/foundation/security/ActionProof.ts:21-55`。 |
| 当前行为 | step-up 会签发绑定到 session、操作、资源、幂等键、版本和 request hash 的 proof；但 AccessPipeline 仅调用 `validate` 做 bearer 字符串格式校验。全仓运行源码与迁移中没有实际调用 `access.consume_action_proof` 或 `finance.assert_expected_version`，只有函数定义、grant 和 helper 单测。 |
| 预期行为 | 每项受该机制保护的 Finance/Invoice 写入应在同一命令事务内、写入前原子消费 proof 并锁定/比较目标版本；伪造、过期、重放、跨 session/resource/request 的 proof 必须被数据库拒绝。 |
| 直接证据 | [FACT][E-AU-488-001] `issue_action_proof`/`consume_action_proof` 和 `assert_expected_version` 定义了完整绑定与 single-use 条件；[FACT][E-AU-488-002] Mobile step-up 返回 proof；[FACT][E-AU-488-003] Pipeline 只调用格式校验；[FACT][E-AU-488-004] 固定基线对两函数的运行调用检索结果为零，`ActionProof.ts` 的消费 helper 仅被自身单测调用；[FACT][E-AU-524-001] PGlite repository test 直接证明 DB function 的单次消费、回滚和授权重验规格，但未经过应用 command；[FACT][E-AU-525-001] Finance policy repository test 必须在测试 helper 手动 consume proof，生产 FinancePolicyWorkflow 仍直接调用 manage procedure。 |
| 调用链或运行入口 | 客户端 step-up → `identity.stepup.complete` → `access.issue_action_proof` → 后续 Finance/Invoice HTTP operation → AccessPipeline → 命令；设计中的 `consume_action_proof`/`assert_expected_version` 未出现在该实际命令链。 |
| 用户/数据/安全影响 | [INFERENCE] 若相关高风险命令可到达，攻击者或错误客户端可提交任意格式合法但未签发的 bearer，或重放已签发 bearer；该机制设计要保护的一次性授权、请求绑定和版本冲突防护不生效，可能扩大未经预期 step-up/确认的财务或发票状态变更风险。正常权限、scope 和 capability 检查仍在 Pipeline 中，实际线上影响未确认。 |
| 根因 | proof 被建模为 API 前置 header 校验，数据库消费/版本锁定 helper 没有被编排进命令 transaction；单元测试只验证 helper 自身的 SQL 参数。 |
| 建议方向 | 在独立修复分支先确定所有受 `requiresFinancialActionProof` 约束的命令，再让每条命令的同一 transaction 在 mutation 前消费 proof 并执行版本断言；不得只加强前端或格式校验。 |
| 验证/回滚 | 隔离数据库覆盖有效、伪造、过期、重复、跨 session/resource/request、权限撤销和版本冲突；确认失败不写业务状态/事件。回滚为撤回单一修复提交并保留可读审计记录。 |
| 是否需要独立复核 | 是；P1 候选必须重追 API、handler、transaction、DB grant/RLS、迁移 ledger 与 service-role 调用者。 |

## F-0244｜专用沙箱福利初始化引用未登记的会计事件

| 字段 | 记录 |
| --- | --- |
| 模块 | Finance accounting rule matrix / zdt 沙箱福利 bootstrap |
| 类型 | 正确性、初始化可用性、财务契约漂移 |
| 严重级别 | **P2** |
| 置信度 | 高（固定基线的调用、规则矩阵和拒绝条件直接核验）；目标数据库实际 ledger、执行历史和该沙箱通道是否仍启用未验证。 |
| 文件和精确位置 | `database/supabase/migrations/20260828093000_finance_accounting_integrity.sql:76-112,728-790`；`database/supabase/migrations/20260828180000_zhudatuan_purchase_access.sql:397-466`。 |
| 当前/预期 | 专用 `sandbox_member_welfare_bootstrap` 在写福利账户/lot 前后调用 `finance.post(..., 'benefit.sandbox.grant', ...)`；账务函数仅从 `finance.accountingeventrule` 查匹配事件，找不到时抛 `FINANCE_ACCOUNTING_EVENT_UNSUPPORTED`。当前基线没有该 event type 的规则。预期为启用的 bootstrap 事件在同一会计规则权威中登记，或不再调用受规则约束的 posting。 |
| 直接证据 | [FACT][E-AU-489-001] 规则 seed 只列 payment、benefit、voucher、settlement、withdrawal、distribution 和 journal event；[FACT][E-AU-489-002] `finance.post` 在 ruleversion 为 null 时中止；[FACT][E-AU-489-003] 后序 sandbox welfare 函数有唯一精确调用，仓内无对应 rule insert。 |
| 调用链或运行入口 | 受 `zhudatuansandboxbootstrap` session user、sentinel 及显式 owner confirmation 保护的 sandbox welfare bootstrap → `finance.ensure_account`/福利事实写入 → `finance.post` → rule lookup failure → 事务回滚。 |
| 用户/数据/安全影响 | 该一次性测试福利初始化会失败，阻塞对应沙箱购买 E2E 前置条件；由于函数事务中止，静态证据不支持部分福利/账本写入结论。未见常规用户资金路径或权限绕过证据。 |
| 根因 | 后续专用 bootstrap 新增 event name 时，没有同步扩展会计事件矩阵。 |
| 建议方向 | 先确认该 test-only bootstrap 是否仍为正式运营/验收依赖；若保留，在独立小批次中以审计认可的借贷账户角色和规则登记该事件，并做重复/失败/账平测试。 |
| 验证/回滚 | 隔离数据库以受限 bootstrap identity 执行一次与重放，核对 journal/entry、福利 lot、审计、outbox 和失败原子性；回滚为撤回规则与 bootstrap 的同一目的变更。 |
| 是否需要独立复核 | 否（P2）；若该通道承担生产验收或资金发放，再升级专项复核。 |

## F-0245｜Canonical API 环境模板遗漏 Secret Store bearer token

| 字段 | 记录 |
| --- | --- |
| 模块 | Commerce API 本地配置与 Secret Store bootstrap |
| 类型 | 配置/文档完整性、开发可用性 |
| 严重级别 | **P3** |
| 置信度 | 高 |
| 文件和精确位置 | `01_core_hexin/services/commerce/.env.example:1-22`；`01_core_hexin/services/commerce/src/entry/ApiMain.ts:7-10`；`.../bootstrap/CommerceRuntime.ts:62-76`。 |
| 当前/预期 | 模板提供 `SECRET_STORE_ENDPOINT` 与各 secret reference，却未提供 `SECRET_STORE_BEARER_TOKEN`。API 入口总是调用 `createRuntime(environment,'api')`，后者无条件要求该 bearer token。预期为 API workload 模板说明/提供该必填注入位，或明确指向生成它的权威 localinfra 流程。 |
| 直接证据 | [FACT][E-AU-502-001] 模板 41 行无 `SECRET_STORE_BEARER_TOKEN`；[FACT][E-AU-502-002] CommerceRuntime 在实例化 WorkloadSecretStore 时以 `SECRET_STORE_BEARER_TOKEN_MISSING` fail-fast。 |
| 调用链或运行入口 | `npm run dev:api` → `ApiMain` → `apiEnvironment` → `createRuntime(...,'api')` → WorkloadSecretStore。 |
| 用户/数据/安全影响 | 从该模板直接建立的本地 API 环境无法启动；没有生产 secret 注入失败、数据写入或凭据泄露证据。 |
| 根因 | 模板只列 secret ref 与 endpoint，没有同步列出 Secret Store 访问身份。 |
| 建议方向 | 在独立文档/配置小批次中确认 localinfra 的权威生成来源，再补充 placeholder/说明并覆盖 fail-fast 与生成路径；不在审计分支修改。 |
| 验证/回滚 | 隔离本地环境从模板生成变量，验证缺字段失败、补充安全 placeholder 后能到下一配置门槛且不打印 token；回滚为撤回单一模板/文档提交。 |
| 是否需要独立复核 | 否（P3）。 |

## F-0246｜Canonical Jobs 环境模板不满足任何有效运行档案

| 字段 | 记录 |
| --- | --- |
| 模块 | Commerce Jobs 配置/Worker bootstrap |
| 类型 | 配置/文档完整性、后台任务可用性 |
| 严重级别 | **P3** |
| 置信度 | 高 |
| 文件和精确位置 | `01_core_hexin/services/commerce/.env.jobs.example:1-19`；`01_core_hexin/packages/config/src/JobsEnvironment.ts:1-110`。 |
| 当前/预期 | 模板没有 `JOB_RUNTIME_PROFILE`、`SECRET_STORE_BEARER_TOKEN`、`KMS_BEARER_TOKEN`。jobsEnvironment 必须解析 profile；identity/payment profile 要求 bearer 且拒绝该模板携带的其它 profile-forbidden keys。预期为模板按一个明确 profile 完整给出 placeholder，或拆成明确的 profile-specific 示例。 |
| 直接证据 | [FACT][E-AU-503-001] 模板的 19 行缺三个变量；[FACT][E-AU-503-002] JobsEnvironment 强制 runtime profile，并在专用 profile 中校验 bearer/配置键白名单。 |
| 调用链或运行入口 | `JobsMain`/`PaymentJobsOnlyMain`/`IdentityNotificationJobsOnlyMain` → `jobsEnvironment` → profile validation → Commerce/专用 runtime bootstrap。 |
| 用户/数据/安全影响 | 由模板启动的 Jobs 环境会在配置验证阶段失败，后台任务无法开始；未证明生产 node 使用该模板、任务积压、数据损坏或凭据暴露。 |
| 根因 | 模板沿用旧的综合 Jobs 变量集合，未随 profile 隔离与 bearer 身份要求同步。 |
| 建议方向 | 从最新主线建立独立配置/文档小批次，先确定 full 是否仍允许，然后为 full/identity/payment 拆分可验证模板并由 localinfra 生成路径覆盖。 |
| 验证/回滚 | 隔离环境分别加载每个模板，断言允许档案可通过环境校验、禁止键 fail-fast、token 不打印；回滚为撤回单一模板变更。 |
| 是否需要独立复核 | 否（P3）。 |

## F-0247｜身份通知 Worker 查询运行契约却未以失败结果阻止启动

| 字段 | 记录 |
| --- | --- |
| 模块 | Commerce identity notification Worker startup/数据库兼容性门 |
| 类型 | 正确性、运行时契约兼容性 |
| 严重级别 | **P2** |
| 置信度 | 高 |
| 文件和精确位置 | `01_core_hexin/services/commerce/src/bootstrap/IdentityNotificationJobsRuntime.ts:108-133`；`.../IdentityNotificationJobsRuntime.test.ts:64-91`；`.../entry/IdentityNotificationJobsMain.ts:4-10`；`.../entry/IdentityNotificationJobsReadyMain.ts:4-5`。 |
| 当前/预期 | compatibility query 计算 `contract`（指定 `CONTRACT_SCHEMA_HEAD` 与 `RUNTIME_CONTRACT_CHECKSUM`），但错误门只检查 schema、registration、表和 identity，未检查 `state.contract`；测试把 `contract: false` 固化为 resolves。预期为 contract 失配在任何 queue claim 或通知投递前拒绝启动。 |
| 直接证据 | [FACT][E-AU-504-001] `exists(... version=$2 and checksum=$3) contract` 的查询结果没有加入拒绝条件；[FACT][E-AU-504-002] 测试明确断言 `pool({ ...healthy, contract: false })` resolves。 |
| 调用链或运行入口 | `IdentityNotificationJobsOnlyMain` → `runIdentityNotificationJobs` → `createIdentityNotificationJobsRuntime` → compatibility gate → `QueueJob('identitynotification')`；就绪入口也直接创建同一 runtime。 |
| 用户/数据/安全影响 | 在数据库 migration head 正确、但 runtime contract checksum 不一致时，身份挑战通知 Worker 仍可能开始认领和派发任务，造成部署版本与数据库契约不一致下的行为不可预测。没有生产不匹配、实际误投递、数据损失或越权证据。 |
| 根因 | gate 已获取 contract 状态，但布尔聚合条件及回归测试没有将它当作启动前置条件。 |
| 建议方向 | 从当时最新主线另建单一修复分支，先以隔离数据库证明 gate 必须 fail-closed，再将 `contract` 纳入条件并把测试改为 reject；不在审计分支修改。 |
| 验证/回滚 | 隔离 PostgreSQL 保留 target schema head、故意使用错误 contract checksum，断言 runtime 创建失败且无 claim/投递；回滚为撤回该单一 gate/test 提交。 |
| 是否需要独立复核 | 否（P2）；若该 Worker 已承担生产身份验证码投递，建议在修复前补运行环境复核。 |

## F-0248｜Purchase API 查询运行契约却未以失败结果阻止启动

| 字段 | 记录 |
| --- | --- |
| 模块 | Commerce purchase API startup/支付与购买契约边界 |
| 类型 | 正确性、运行时契约兼容性 |
| 严重级别 | **P2** |
| 置信度 | 高 |
| 文件和精确位置 | `01_core_hexin/services/commerce/src/bootstrap/PurchaseApiRuntime.ts:177-319`；`.../PurchaseApiRuntime.test.ts:43-97`；`.../entry/PurchaseApiMain.ts:11`。 |
| 当前/预期 | compatibility query 计算全局 contract version/checksum，但最终 fail-closed 条件检查 schema、purchase marker、表/函数/授予权限，遗漏 `state.contract`。测试覆盖若干 role/grant 失败，却没有 contract 失配拒绝。预期为 contract 失配在 API listen 和任何购买/支付写操作前拒绝。 |
| 直接证据 | [FACT][E-AU-505-001] SQL 以 `CONTRACT_SCHEMA_HEAD`/`RUNTIME_CONTRACT_CHECKSUM` 生成 `contract` 字段；[FACT][E-AU-505-002] 条件串未包含 `!state.contract`；[FACT][E-AU-505-003] 对应测试不存在 contract=false reject case。 |
| 调用链或运行入口 | `PurchaseApiMain` → `createPurchaseApiRuntime` → node/payment/secret checks → `assertPurchaseRuntimeCompatibility` → purchase API container。 |
| 用户/数据/安全影响 | 若 migration head 等其它检查仍满足但 runtime contract checksum 不一致，购买 API 仍可能处理 checkout/订单/payment 相关请求，行为可能与数据库契约不一致。未验证生产存在不一致、支付金额错误、实际数据损坏或权限扩大。 |
| 根因 | 启动门已查询 contract 状态，却没有将其加入健康状态的布尔聚合；negative regression 未覆盖。 |
| 建议方向 | 从当时最新主线另建单一修复分支，在隔离数据库证明需要 fail-closed 后，将 `contract` 加入条件及测试；与 F-0247 可作为同一模式的范围勘查输入，但不要在审计分支修复。 |
| 验证/回滚 | 隔离 PostgreSQL 保持 target head、purchase marker/roles 为健康，仅改坏 contract checksum；断言 runtime 创建失败、无 listen/写入；回滚为撤回单一 gate/test 提交。 |
| 是否需要独立复核 | 否（P2）；若验证发现生产环境有 contract drift，应升级专项复核。 |

## F-0249｜Web Business API 将兼容性失败降级为警告后仍开始监听

| 字段 | 记录 |
| --- | --- |
| 模块 | Commerce Web Business API startup/数据库安全边界 |
| 类型 | 正确性、可用性与权限启动门 |
| 严重级别 | **P1** |
| 置信度 | 高 |
| 文件和精确位置 | `01_core_hexin/services/commerce/src/bootstrap/WebBusinessApiRuntime.ts:92-95`；`.../entry/WebBusinessApiMain.ts:20-36`；`.../WebBusinessApiRuntime.test.ts:17-59`。 |
| 当前/预期 | runtime 对 `assertWebBusinessRuntimeCompatibility` 的任意 reject 使用 `.catch` 写出 warning，随后创建 handlers；entry 无额外健康门，继续 `bootstrapApi` 并 `listen`。预期为 dedicated role、recovery、schema/contract、表/函数、授权或 payment/finance 禁写边界不健康时在监听前 fail-closed。 |
| 直接证据 | [FACT][E-AU-506-001] 兼容性调用的 catch 只执行 `console.warn('WEB_BUSINESS_RUNTIME_COMPATIBILITY_WARNING', cause)`；[FACT][E-AU-506-002] 同一函数之后继续构建 runtime；[FACT][E-AU-506-003] deployed entry 无条件基于返回的 runtime 调用 `listen`。 |
| 调用链或运行入口 | `WebBusinessApiMain` → `createWebBusinessApiRuntime` → compatibility warning catch → `bootstrapApi` → `PublicCatalogHttpHandler` → `listen`。 |
| 用户/数据/安全影响 | 配置、迁移或 DB grant 漂移时，API 可在不满足其声明安全前置条件的状态下暴露服务；可能表现为错误响应、不可预期写入或受限边界偏离。未验证生产存在不健康实例、实际越权、数据错误或日志告警可见性。 |
| 根因 | 将启动兼容性断言视作非阻塞 observability warning，但没有独立的 fail-closed gate。 |
| 建议方向 | 从当时最新主线建立单一修复分支；先以隔离数据库和真实 entry 验证是否有外部 supervisor gate，若无则使 incompatibility 阻止 runtime 返回/listen，并保留结构化运维诊断。 |
| 验证/回滚 | 隔离数据库分别破坏 role、表/函数、forbidden grant、recovery 或 marker，断言进程在 listen 前退出；回滚为撤回单一 startup-gate 改动。 |
| 是否需要独立复核 | **是**；P1 已加入 `records/AU-506-web-business-api-runtime-test/independent-review-queue.csv`，复核必须重新走 runtime→entry→外部健康门。 |

## F-0250｜Web Business API 查询运行契约却未以失败结果阻止启动

| 字段 | 记录 |
| --- | --- |
| 模块 | Commerce Web Business API runtime contract compatibility |
| 类型 | 正确性、运行时契约兼容性 |
| 严重级别 | **P2** |
| 置信度 | 高 |
| 文件和精确位置 | `01_core_hexin/services/commerce/src/bootstrap/WebBusinessApiRuntime.ts:158-231`；`.../WebBusinessApiRuntime.test.ts:17-59`。 |
| 当前/预期 | helper 查询 `runtime.schemaversion` 的 contract version/checksum，但 reject 条件未包含 `!state.contract`。预期为 contract checksum 失配时 helper 拒绝，并由经过 F-0249 修正后的启动门阻止监听。 |
| 直接证据 | [FACT][E-AU-506-004] SQL 生成 `contract` 字段；[FACT][E-AU-506-005] 条件串只检查 schema、web_business、relations、functions 与权限字段；测试没有 contract=false case。 |
| 调用链或运行入口 | `WebBusinessApiMain` → `createWebBusinessApiRuntime` → `assertWebBusinessRuntimeCompatibility`。 |
| 用户/数据/安全影响 | 单独看会允许 contract drift 通过 helper；当前又受 F-0249 的 warning catch 放大。无生产 drift 或实际请求影响证据。 |
| 根因 | Boolean health aggregation 与 query 字段失配，negative regression 缺失。 |
| 建议方向 | 作为 F-0249 修复前的范围核对项，在独立小批次纳入 `contract` 条件和 contract=false reject regression；不在审计分支修改。 |
| 验证/回滚 | 隔离数据库仅破坏 contract checksum，验证 helper 与真实 startup 都在 listen 前失败；回滚为撤回该单一条件/测试变化。 |
| 是否需要独立复核 | 否（P2）；纳入 F-0249 独立复核时一并重走。 |

## F-0251｜Worker 正常停止被计为 Job 失败并可能耗尽重试次数

| 字段 | 记录 |
| --- | --- |
| 模块 | Commerce generic JobRunner / Worker shutdown 与 deadletter |
| 类型 | 异步正确性、重试与恢复 |
| 严重级别 | **P2** |
| 置信度 | 高 |
| 文件和精确位置 | `01_core_hexin/services/commerce/src/foundation/application/JobRunner.ts:43-103,109-133`；`.../tests/job/Job.test.ts:7-34`；多个 processor 的 `signal.aborted` guard，例如 `modules/benefit/05_interface_jieru/job/BenefitJobs.ts:27`。 |
| 当前/预期 | global stop signal 传入 Deadline/processor；多个 processor 在 signal aborted 时 throw。JobRunner 捕获任何 throw 后都进入 `fail` transaction，递增 attempts、requeue，达到上限则写 deadletter/failed。预期为已知的 process shutdown/cancellation 与业务处理失败区分，任务由 lease/reclaim 恢复而不消耗失败预算；deadline/business failure 仍保留重试策略。 |
| 直接证据 | [FACT][E-AU-522-001] `run` 将外部 signal 传入每个 processor 的 Deadline；[FACT][E-AU-522-002] processor 源码广泛 `if (signal.aborted) throw signal.reason`；[FACT][E-AU-522-003] process catch 无 cancellation 分支，直接调用 fail；[FACT][E-AU-522-004] fail 以 claimed attempts 判断 terminal 并更新 deadletter/source job。 |
| 调用链或运行入口 | Jobs runtime SIGINT/SIGTERM → AbortController → QueueJob → JobRunner → processor abort throw → `fail` → runtime.job retry/failed 与 runtime.deadletter。 |
| 用户/数据/安全影响 | 重复滚动重启、缩容或 shutdown 恰逢处理时，任务可能错误累积 attempts，最终进入 deadletter，造成导入、通知、订单、支付等异步工作延迟或需要人工恢复。未验证生产重启频率、实际 abort I/O 或已发生死信。 |
| 根因 | runner 将 lifecycle cancellation、deadline cancellation 与业务异常合并为单一 failure 路径。 |
| 建议方向 | 从最新主线建立独立小批次，先定义可识别 cancellation reason 与 lease/reclaim 语义；加入真实 runner integration 测试分别覆盖 graceful stop、deadline、业务可重试和 terminal failure，避免仅吞掉 abort。 |
| 验证/回滚 | 隔离 DB claim job 后在 processor 内触发 stop，断言不耗尽 attempts、不错误 deadletter、lease 后可 reclaim；再覆盖 deadline/业务失败仍退避；回滚为撤回该单一 shutdown handling change。 |
| 是否需要独立复核 | 否（P2）；若运行日志显示重启期间 deadletter，则升级专项复核。 |

## F-0252｜财务对账在歧义候选中按内部 ID 任意选择匹配项

| 字段 | 记录 |
| --- | --- |
| 模块 | Finance reconciliation matching → approval/settlement |
| 类型 | 财务正确性、数据完整性、异步结算前置条件 |
| 严重级别 | **P1 候选**；须完成独立复核后定级。 |
| 置信度 | 高（固定基线 match SQL 与同文件 skipped fail-closed scenario 直接矛盾）；生产候选唯一约束/ingestion 数据/settlement guard 未验证。 |
| 文件和精确位置 | `01_core_hexin/services/commerce/src/modules/finance/03_application_yingyong/command/ReconcileStatement.ts:57-83`；`.../tests/repository/FinanceReconciliation.test.ts:352-369`。 |
| 当前/预期 | candidate CTE 可为同一 statement line 产生多条 internal fact；`distinct on(line_id) order by line_id,priority,internal_id` 静默选内部 ID 排序第一条，再按金额将其标为 matched/difference。测试中明示的多对一 provider reference 场景预期生成 `MANY_TO_ONE_UNSUPPORTED` 且不任意选择，但该 test 是 `it.skip`。预期为歧义时 fail-closed，写出明确 difference/evidence，直到有确定性匹配规则。 |
| 直接证据 | [FACT][E-AU-526-001] match SQL 的 distinct-on 排序以 `internal_id` 作为候选决胜；[FACT][E-AU-526-002] skipped scenario 构造 ambiguous provider references 并断言不选任一 internal fact；[FACT][E-AU-526-003] current source 未含 MANY_TO_ONE_UNSUPPORTED 或多候选拒绝分支。 |
| 调用链或运行入口 | provider statement → `ReconcileStatement.execute` → `match` → `finance.reconciliationitem` state → reconciliation approve → settlement job。 |
| 用户/数据/安全影响 | 若 provider reference 对应多个可匹配的 payment/refund/journal 事实，系统可能错误标记一条为匹配，导致对账余额、人工审批依据及后续结算建立在错误对应关系上。未验证生产存在重复 reference、实际审批/结算已发生或 DB constraint/下游 guard 阻断。 |
| 根因 | 为选择单候选使用 deterministic sort，替代了业务所需的 ambiguity detection/explicit resolution 模型；原本计划的测试仍被跳过。 |
| 建议方向 | 从最新主线建立独立修复分支前，先在隔离 PostgreSQL 重现并核对 provider external-reference 唯一性、RLS、operator resolution 与 settlement guard；若无其它安全门，改为多候选时生成不可审批 difference 并启用该回归测试。 |
| 验证/回滚 | 注入同一 external reference 的多条 eligible internal facts，确认不产生 arbitrary matched item、无法 approve/settle且有明确审计 evidence；覆盖唯一候选仍可平衡；回滚为撤回单一 matching/test 小批次。 |
| 是否需要独立复核 | **是**；已加入 `records/AU-526-finance-reconciliation-pglite-test/independent-review-queue.csv`，必须重新追踪 candidate SQL 到 settlement。 |

## F-0253｜身份并发回归将六类独立竞态压入单一超大测试

| 字段 | 记录 |
| --- | --- |
| 模块 | Identity L0/L1 PostgreSQL concurrency test maintainability |
| 类型 | NIT：测试可维护性/失败定位 |
| 严重级别 | **NIT** |
| 置信度 | 高 |
| 文件和精确位置 | `01_core_hexin/services/commerce/tests/repository/IdentityConcurrency.test.ts:82-382`（单一 `it`，文件 662 行）。 |
| 当前/预期 | 一个环境条件的 DB test 连续执行 bulk registration/login、cross-realm、idempotency、challenge、invite 和 ticket 竞争；前段失败会遮蔽后段。预期是保留共享 fixture/真实并发强度的同时，按独立竞态拆分可定位 case。 |
| 直接证据 | [FACT][E-AU-529-001] 文件只有一个 300+ 行 `it` 包含六类语义不同的 Promise.all races 和各自 SQL evidence。 |
| 用户/数据/安全影响 | 不改变生产行为；测试失败诊断、局部重跑和后续并发规格维护成本上升。 |
| 建议方向 | 仅在未来测试维护小批次中拆分场景，保留同等真实 DB roles/fixture 和跨 Realm evidence；不在审计分支改动。 |
| 验证/回滚 | 分拆后分别运行各 case，确认每一 case 的并发数量、断言与 cleanup 不变；回滚为撤回纯测试重组织提交。 |
| 是否需要独立复核 | 否（NIT）。 |

## F-0254｜Password login stability 测试不清理随机身份 fixture

| 字段 | 记录 |
| --- | --- |
| 模块 | Identity PostgreSQL integration test data hygiene |
| 类型 | 测试可维护性、测试数据库数据生命周期 |
| 严重级别 | **P3** |
| 置信度 | 高 |
| 文件和精确位置 | `01_core_hexin/services/commerce/tests/repository/PasswordLoginStability.test.ts:36-46,102-135`。 |
| 当前/预期 | beforeAll 以随机 suffix 插入 principal、account、credential、member、membership、role/scope grants；test 还创建 session/authticket。afterAll 只结束 pools，没有删除任何 fixture。预期为单文件 finally cleanup，或明确由权威 test harness 在每次运行后重置 database。 |
| 直接证据 | [FACT][E-AU-533-001] `seedIdentity` 有多张表 insert；[FACT][E-AU-533-002] afterAll 仅 `end()` 两个 pool；[FACT][E-AU-533-003] suffix 每次随机，无法依赖同键 upsert 回收。 |
| 用户/数据/安全影响 | 仅在配置的 test DB 运行时累积测试身份/会话/票据，可能导致数据膨胀、查询干扰或后续测试不稳定。没有生产连接、生产数据污染或凭据泄露证据。 |
| 根因 | 稳定性 test 将 fixture 持久写入 shared DB，却没有与 seed 对称的 teardown。 |
| 建议方向 | 从最新主线建立独立测试维护分支，先确认全局 harness 是否重置 DB；若否，使用唯一 tag 在 finally 删除依赖顺序正确的 session/ticket/membership/credential/account/principal 事实，并验证失败中途同样清理。 |
| 验证/回滚 | 隔离 test DB 连续跑两次，按 tag 核对运行后 0 条 fixture；模拟 assertion 失败仍执行 cleanup；回滚为撤回纯测试 cleanup 提交。 |
| 是否需要独立复核 | 否（P3）；需先确认外部 harness reset 责任。 |

## F-0255｜Public Mall checkout 集成测试不清理完整随机业务 fixture

| 字段 | 记录 |
| --- | --- |
| 模块 | Purchase/payment/fulfillment PostgreSQL integration test data hygiene |
| 类型 | 测试可维护性、测试数据库数据生命周期 |
| 严重级别 | **P3** |
| 置信度 | 高 |
| 文件和精确位置 | `01_core_hexin/services/commerce/tests/repository/PublicMallCheckout.test.ts:73-142,380-589`。 |
| 当前/预期 | beforeAll 以随机 suffix seed organization、identity/access、catalog/pricing/inventory 及后续 cart/checkout/order/payment/fulfillment/refund 事实；afterAll 仅结束 pools/admin connection。预期为按 fixture dependency 顺序 cleanup，或明确由权威 harness 每次重置所有 test DB。 |
| 直接证据 | [FACT][E-AU-535-001] fixture 每个 id 都携带 random UUID suffix；[FACT][E-AU-535-002] `seed` 有跨多个业务 schema 的 insert；[FACT][E-AU-535-003] afterAll 仅调用 `end()`，文件没有 cleanup 函数或 delete。 |
| 用户/数据/安全影响 | 在配置的 shared test databases 运行时，会累积跨商城/购买/支付/履约事实，可能污染统计、触发后续唯一性/性能问题或令 DB reset 成本上升。没有生产连接、生产数据污染或外部支付调用证据。 |
| 根因 | 高价值 E2E fixture 缺少对称 teardown，依赖未在文件内证明的外部环境重置。 |
| 建议方向 | 在独立测试维护批次先明确 five DB role 是否同一物理 DB、harness reset 机制与 cleanup 权限；若无全局 reset，在 finally 以唯一 suffix 清理 job/outbox、payment/fulfillment/order/cart、catalog、identity/access、organization 的依赖图。 |
| 验证/回滚 | 隔离 test DB 连续跑两次并按 suffix 断言 0 残留；模拟中途失败仍 cleanup；回滚为撤回纯测试 teardown 提交。 |
| 是否需要独立复核 | 否（P3）；需先确认外部 harness reset 责任。 |

## F-0256｜Repository RLS 契约测试以空结果集作为隔离通过条件

| 字段 | 记录 |
| --- | --- |
| 模块 | Commerce repository / risk policy RLS test credibility |
| 类型 | 测试可信度、数据访问隔离回归保护 |
| 严重级别 | **P2** |
| 置信度 | 高 |
| 文件和精确位置 | `01_core_hexin/services/commerce/tests/repository/Repository.test.ts:56-60`。 |
| 当前/预期 | 以 `policies.rows.every(({ scope_id }) => scope_id === 'rls-scope-a')` 断言 RLS；JavaScript 对空数组的 `every` 返回 true，测试没有 seed/断言一条本 scope policy。预期为先建立至少两个跨 scope 的可见 fixture，断言本 scope 存在且另一 scope 不可见。 |
| 直接证据 | [FACT][E-AU-536-001] 查询只读 `risk.policy`，没有本文件 fixture insert；[FACT][E-AU-536-002] `every` 是唯一内容断言，未检查 rows 长度；[FACT][E-AU-536-003] endpoint 缺失时该 suite 才 fail-closed，但 endpoint 存在时此场景可在 0 rows 情况下通过。 |
| 调用链或运行入口 | PostgreSQL integration endpoint → `set local role shopapp`/`app.scope_id` → `risk.policy` → `Repository.test.ts` RLS regression assertion。 |
| 用户/数据/安全影响 | 不会直接改变生产访问控制；但 RLS policy、GUC 或 migration 回归时，空表/错误 fixture 状态可掩盖隔离测试失效，使跨 scope 数据泄露风险少一道回归检测。未验证生产 RLS 是否有缺陷或 test DB 是否实际为空。 |
| 根因 | test 将“所有返回行符合 scope”当作“RLS 隔离成立”，却未把非空的同 scope 数据与不可见的异 scope 数据作为前置事实。 |
| 建议方向 | 从最新主线建立独立测试维护分支，在隔离数据库显式插入/清理两个 scope 的 `risk.policy` 记录，断言本 scope 精确可见、另一 scope 不可见且结果非空；先确认该表的写权限和规范 fixture builder。 |
| 验证/回滚 | 先在可控 PostgreSQL 中将 RLS 临时放宽或改错，确认新断言失败；恢复 policy 后通过。回滚为撤回单一测试 fixture/assertion 提交。 |
| 是否需要独立复核 | 否；修复后须用故意失效的 RLS 反事实验证。 |

## F-0257｜Bundle 预算声明两项不会被质量门消费

| 字段 | 记录 |
| --- | --- |
| 模块 | 前端构建质量 / bundle budget config |
| 类型 | 配置可信度、性能回归保护缺口 |
| 严重级别 | **P3** |
| 置信度 | 高 |
| 文件和精确位置 | `02_platform_pingtai/config/bundles.yml:7-8`；`04_tools/scripts/check/bundles.mjs:8-13`。 |
| 当前/预期 | YAML 声明 `storeInitialGzipKb`、`supplierInitialGzipKb`；checker 只将 console/auth/storefront/commerce 放入 artifacts，miniapp 另测目录大小，固定基线内两 key 除 YAML 外无命中。预期为未受支持的预算字段不被保留，或 checker/正式 artifact manifest 明确消费它们。 |
| 直接证据 | [FACT][E-AU-545-001] 两个 key 全仓仅在 YAML 各出现一次；[FACT][E-AU-545-002] checker artifact list 未含 store/supplier；[FACT][E-AU-545-003] 当前 `01_core_hexin/apps` 无 store/supplier artifact tree。 |
| 调用链或运行入口 | `quality:canonical-hard-cut` → `check:bundles` → audit wrapper → bundle checker → YAML budgets。 |
| 用户/数据/安全影响 | 不直接影响运行、数据或访问控制；若未来恢复 store/supplier 制品，维护者可能误以为 90KB gzip 限制已生效，实际不会阻挡性能回归。当前是否存在仓外这两类制品未验证。 |
| 根因 | 旧应用预算字段与现行 checker 的 artifact set 未同步，且 YAML schema 未拒绝未消费字段。 |
| 建议方向 | 从最新主线建立独立质量配置小批次，先用 release/artifact 权威确认 store/supplier 是否仍是产品单元；若否删除废弃 keys，若是将真实产物及反事实超预算 test 加入 gate；不要只改数值。 |
| 验证/回滚 | 在隔离构建中人为超过对应 app budget，确认 gate 失败；若已下线，确认 config schema/文档不再宣称保护。回滚为撤回单一 quality-policy change。 |
| 是否需要独立复核 | 否。 |

## F-0337｜VI 1.1 证据链接把 viewport 标注与全页图尺寸混用

| 字段 | 记录 |
| --- | --- |
| 模块 | Historical design evidence / VI 1.1 |
| 类型 | 视觉验收元数据、证据可复核性 |
| 严重级别 | **P3** |
| 置信度 | 高（README 链接文本与 PNG 文件元数据为直接证据） |
| 文件和精确位置 | `05_docs_ziliao/docs_wendang/evidence/vi/2026-08-28/README.md:9-10`；`zhudatuan-vi-1.1-desktop.png`、`zhudatuan-vi-1.1-mobile.png`。 |
| 当前/预期 | README 将图像链接标为 Desktop 1440×1000、Mobile 390×844；实际 PNG 是 1440×2591 与 390×5715 的全页导出图。预期是明确标注为测试 viewport 与全页截图尺寸，或将链接文字改为实际图像尺寸。 |
| 直接证据 | [FACT][E-AU-871-001] README:9-10 的两个尺寸标签；[FACT][E-AU-871-002] file 元数据为 desktop 1440×2591 RGB PNG、mobile 390×5715 RGB PNG；[FACT][E-AU-871-003] 视觉抽检显示两图均为全页设计板而非单屏截面。 |
| 调用链或运行入口 | 人工设计/验收读者 → VI evidence README → Desktop/Mobile 图件；非运行时调用链。 |
| 用户影响 | 读者可能将导出图尺寸误作为响应式视口或反过来，难以复现并比较历史无障碍/overflow 结论。 |
| 数据影响 | 无直接数据影响。 |
| 安全影响 | 无直接安全漏洞。 |
| 根因 | 证据索引未区分浏览器测试 viewport 和全页导出图像尺寸。 |
| 建议方向 | 从当时最新 `zdt-next` 建立单一 vi-evidence-metadata batch：明确两个 viewport、实际图像尺寸、浏览器/工具版本与历史状态；不调整设计 token、生产 UI 或构建。 |
| 预计修改范围 | 单一 evidence README 与可选静态元数据校验。 |
| 验证方式 | 链接文字/元数据准确区分 viewport 和导出尺寸；读者可复现历史证据的适用边界。 |
| 回滚方式 | 回退独立文档元数据提交。 |
| 是否需要独立复核 | 否。 |

## F-0336｜MVP 浏览器验收报告没有把截图绑定到其失败断言

| 字段 | 记录 |
| --- | --- |
| 模块 | Historical evidence / browser acceptance |
| 类型 | 浏览器验收证据可复核性、资料可信度 |
| 严重级别 | **P3** |
| 置信度 | 高（报告、截图目录、图像元数据/视觉抽检和源码文本均为直接证据；原始浏览器会话未提供） |
| 文件和精确位置 | `05_docs_ziliao/docs_wendang/evidence/MVP真实浏览器验收报告-20260822.md:1-77`；同目录 `evidence/mvp/商品.png`、`待支付.png`、`报价.png`、`购物车.png`、`首页.png`。 |
| 当前/预期 | 报告称商品为 ABO 测试商品、禁购且购物车持续同步失败，却没有 Markdown 链接、截图哈希、URL、时间、浏览器会话或逐验收行映射。抽检的商品/购物车截图显示另一组页面状态，不能独立佐证这些具体断言。预期是每项失败结论可定位到带来源/时间/URL/步骤的截图或可重放浏览器收据，且历史证据与当前基线分开。 |
| 直接证据 | [FACT][E-AU-870-001] 报告:16-20、55、69 声称测试商品禁购和购物车同步失败，但全文不含五个截图文件名或相对链接；[FACT][E-AU-870-002] 五张图均为 JPEG 内容、尺寸 1497–1512px 宽且散列各异；[FACT][E-AU-870-003] 商品/购物车视觉抽检没有显示报告所称的 ABO/禁购/同步失败状态；[FACT][E-AU-870-004] 当前源码仍有 `MallContext.tsx:267` 的购物车失败提示和历史 ABO 测试目录迁移，不能单独证明当前运行。 |
| 调用链或运行入口 | 人工审计者/发布负责人 → 历史浏览器验收报告与截图；非运行时调用链。 |
| 用户影响 | 读者可能将未绑定的历史截图误作具体失败的完整证据，或将 2026-08-22 结果误当作当前部署状态。 |
| 数据影响 | 无直接数据影响。 |
| 安全影响 | 无直接安全漏洞；错误验收证据可能影响发布决策的可信度。 |
| 根因 | 浏览器验收报告与截图作为同目录资产保留，但没有受管证据清单或逐断言 provenance。 |
| 建议方向 | 从当时最新 `zdt-next` 建立单一 browser-evidence-provenance batch：为历史资料标注会话/时间/URL/散列/断言关联，或明确其仅为示意；重新验收另建受控当前基线收据。不得在审计分支访问生产、下单或支付。 |
| 预计修改范围 | 历史证据目录的清单/说明及可选受控浏览器验收模板。 |
| 验证方式 | 每个结论可从报告跳至带 provenance 的截图/日志；重新验收在当前基线中可复跑，且禁止写入的验证边界明确。 |
| 回滚方式 | 回退独立证据清单提交；保留原始历史图件。 |
| 是否需要独立复核 | 否。 |

## F-0335｜每日问答指向不存在的主打团决策评估锚点

| 字段 | 记录 |
| --- | --- |
| 模块 | Documentation / decision navigation |
| 类型 | 历史决策可达性、证据导航 |
| 严重级别 | **P3** |
| 置信度 | 高（链接源和目标文件完整 heading 列表为直接证据） |
| 文件和精确位置 | `05_docs_ziliao/docs_wendang/decisions/每日問答.md:83`；目标 `decisions/zhudatuan.md:1-130`。 |
| 当前/预期 | 每日问答以 `#2026-08-28前後端分離完成度評估` 链接主打团决策记录，但目标文件只有两项 2026-08-27 heading，找不到该 anchor 或相应评分章节。预期是链接指向实际保存评分/证据的文件和 heading，或明确该历史章节已移除。 |
| 直接证据 | [FACT][E-AU-868-001] 每日问答:83 包含该 fragment；[FACT][E-AU-868-002] `rg '^## ' decisions/zhudatuan.md` 只返回 6、18 行的两个 2026-08-27 heading；[FACT][E-AU-868-003] SOURCE-MANIFEST:14 明确将两份决策文件保留为产品边界/交接记忆，故不能通过删除任一文件绕过断链。 |
| 调用链或运行入口 | 人工读者 → 每日问答 → 主打团决策评分链接；非运行时调用链。 |
| 用户影响 | 读者不能复核所称的五项评分、扣分证据和补齐顺序，可能改以过时摘要作为完整结论。 |
| 数据影响 | 无直接数据影响。 |
| 安全影响 | 无直接安全漏洞。 |
| 根因 | 历史决策重组或章节删除后，跨文档 fragment 未同步。 |
| 建议方向 | 从当时最新 `zdt-next` 建立单一 decision-navigation-docs batch：将链接改到实际保存评分的章节/档案，或保留简短的明确历史转向说明；不重写历史决策内容或把其路径陈述当现行运行事实。 |
| 预计修改范围 | 单一 Markdown 链接及可选历史转向说明。 |
| 验证方式 | Markdown fragment 解析到存在 heading，且读者能到达评分依据/历史状态说明。 |
| 回滚方式 | 回退独立文档导航提交。 |
| 是否需要独立复核 | 否。 |

## F-0334｜告警目录把人工保护动作写成未证实的自动保护

| 字段 | 记录 |
| --- | --- |
| 模块 | Operations / alert catalog |
| 类型 | 告警自动化、运行资料可信度 |
| 严重级别 | **P3** |
| 置信度 | 高（目录文本、全仓反查与实际独立 alert 实现为直接证据；线上告警平台状态未验证） |
| 文件和精确位置 | `05_docs_ziliao/docs_wendang/alerts/catalog.md:3-17`。 |
| 当前/预期 | 目录将支付完整性、账务不平、跨 scope、库存超卖、订单创建失败等信号的保护动作称为“Automatic protection”。固定基线中未找到该目录、完整信号文本或这些动作的规则注册/消费者；可定位的 `IdentityNotificationBacklogMonitor` 仅为身份通知 backlog 写入独立 alert。预期是自动化动作有可追溯的规则/运行入口，或目录明确其为人工 runbook 指引及未验证自动化。 |
| 直接证据 | [FACT][E-AU-867-001] 十份目录引用的 P0/P1 runbook 均存在，`03_quality_ceshi/tests/recovery/runbook.spec.ts:8-36` 对其存在性/内容有测试；[FACT][E-AU-867-002] 排除目录后未找到目录信号文本、自动保护语句或对应保护动作的静态消费者；[FACT][E-AU-867-003] `IdentityNotificationBacklogMonitor.ts:39-67` 仅对 identity notification queue 写入 `runtime.deadletter` alert，不能覆盖目录其他信号。 |
| 调用链或运行入口 | 人工运维者 → alert catalog → incident runbook；独立 identity notification monitor → telemetry/deadletter。 |
| 用户影响 | 运营人员可能误以为高风险写入已自动冻结，而实际需要人工判断和执行手册；未验证发生过事故或遗漏处置。 |
| 数据影响 | 自动冻结不存在或失效时，潜在异常写入窗口可能比文档预期长；本审计未验证线上平台。 |
| 安全影响 | 跨 scope 事件的会话撤销/操作冻结若仅是人工步骤，响应时效依赖人工；未发现实际披露或线上攻击证据。 |
| 根因 | 人工 runbook 目录与自动化保护能力没有以同一可检索的规则/注册表关联，目录将期望动作表述为既有自动化。 |
| 建议方向 | 从当时最新 `zdt-next` 建立单一 alert-catalog-automation-evidence 批次：为每项自动化列出受控规则/worker/平台证据，或将文字降为人工止损步骤；先定义每项可观测信号、执行授权、幂等与故障降级，不在审计分支添加冻结逻辑。 |
| 预计修改范围 | 告警目录及可选自动化注册/验证测试；由运维/安全 Owner 定稿。 |
| 验证方式 | 每个标为自动的信号均能定位到触发器、授权边界、执行日志和 fail-safe 测试；没有自动化的项明确显示人工响应，演练时不产生不可控写入。 |
| 回滚方式 | 回退独立文档/自动化证据提交；任何真实保护变更另有独立运行回滚方案。 |
| 是否需要独立复核 | 否。 |

## F-0333｜卡券操作矩阵把冻结契约的 named schema 写成 structural

| 字段 | 记录 |
| --- | --- |
| 模块 | Contract documentation / Voucher target matrix |
| 类型 | 契约语义、设计—生成追踪准确性 |
| 严重级别 | **P3** |
| 置信度 | 高（矩阵 prose、YAML 定义与 Target Contract 测试为直接证据） |
| 文件和精确位置 | `05_docs_ziliao/docs_wendang/voucher/Operations.md:7-13`；`01_core_hexin/packages/contract/src/VoucherTargetContract.test.ts:16-27`；`packages/contract/definitions/operations.yml` target 定义。 |
| 当前/预期 | 矩阵称全部 74 个 frozen target operation 使用 `schema=structural`，但 Target Contract 断言每项为 `availability=frozen && schema=named`，YAML 定义同样为 `named`。预期是文档准确描述当前冻结 schema 语义，或明确其只是未来提案。 |
| 直接证据 | [FACT][E-AU-866-001] Operations:10 写 `schema=structural`；[FACT][E-AU-866-002] Target Contract:18 断言全部 frozen target 为 `schema=named`；[FACT][E-AU-866-003] YAML 的定义条目均声明 `schema: named`。测试读取矩阵以核对 route/permission/policy/requirements，但不解析该 prose。 |
| 调用链或运行入口 | 设计/契约维护者 → Operations 矩阵 → YAML/ContractGenerator/SDK；`VoucherTargetContract` 对矩阵表行执行 design-to-contract 验证。 |
| 用户影响 | 后续 DTO/生成器实现者可能把已命名的冻结 schema 误认为可延后收紧的结构 schema，产生错误的契约实现或评审判断；当前 API 路由和运行权限不因此改变。 |
| 数据影响 | 无直接数据写入或迁移影响。 |
| 安全影响 | 无直接外部越权证据；错误 schema 理解可降低未来输入契约评审准确性。 |
| 根因 | 冻结规则的设计叙述未随实际 YAML/Target Contract 的 named schema 定稿同步；测试只验证矩阵表格字段，不验证规则 prose。 |
| 建议方向 | 从当时最新 `zdt-next` 建立单一 voucher-target-matrix-docs batch：修正文档 schema 描述，并考虑添加最小文本或结构断言以锁定冻结规则；不修改 target operation、路由、权限、生成器或运行注册。 |
| 预计修改范围 | 单一 Markdown 文档和可选单一 contract text assertion。 |
| 验证方式 | 文档与 YAML/Target Contract 的 `schema` 一致；故意将规则写回 structural 时新增断言必须失败；74 项 target 仍 frozen、named 且不进入 runtime controller/capability。 |
| 回滚方式 | 回退独立文档/测试提交。 |
| 是否需要独立复核 | 否。 |

## F-0332｜卡券目标架构把重组前路径与占位迁移写成升级清单

| 字段 | 记录 |
| --- | --- |
| 模块 | Documentation / Voucher target architecture |
| 类型 | 实施路径准确性、迁移与删除治理 |
| 严重级别 | **P3** |
| 置信度 | 高（文档路径、固定基线文件系统与当前 Voucher runtime 入口均为直接证据） |
| 文件和精确位置 | `05_docs_ziliao/docs_wendang/voucher/Architecture.md:740-765,774-790`；`voucher/Delivery.md:46,394-403`；实际源码根为 `01_core_hexin/services/...` 与 `01_core_hexin/apps/...`，受管迁移根为 `02_platform_pingtai/database/supabase/migrations/`。 |
| 当前/预期 | 两份文档将契约、SDK、测试、迁移和旧文件列为 `packages/...`、`services/...`、`apps/...`、`database/...` 根路径；固定基线中这些根相对路径不存在，Architecture 中四个 `20260901xxxxxx_voucher_target_*` 迁移也不存在。实际 Voucher 运行模块与 Console 文件仍位于带顶层分区前缀的路径。预期是目标态文档明确其为未实施草案，并使用当前可解析路径或单独的未来目录约定。 |
| 直接证据 | [FACT][E-AU-862-001] Architecture 740-751、760-765、774-790 的路径在固定基线均无对应对象；[FACT][E-AU-865-001] Delivery:46 将定义写为无前缀 `packages/...`，394-403 又要求未来受管迁移；[FACT][E-AU-862-002] `01_core_hexin/services/commerce/src/modules/voucher/module.manifest.ts:8-43` 仍注册 19 个 operation 和四类 job；[FACT][E-AU-862-003] `VoucherTargetContract.test.ts:12-76` 固定 74 个 `frozen` target operation 并断言不进入 runtime controller/capability artifact。 |
| 调用链或运行入口 | 人工实施者 → Voucher Architecture/Delivery → 路径、迁移与旧文件处置清单；非运行时调用链。 |
| 用户影响 | 实施者可能在不存在目录创建迁移或按不完整、无前缀的清单误定位当前运行文件；当前功能不会因阅读文档自动改变。 |
| 数据影响 | 若误把占位迁移当作可执行步骤，可能产生与受管迁移目录脱节的后续变更；本审计未执行任何迁移。 |
| 安全影响 | 无直接外部安全漏洞。 |
| 根因 | 仓库目录重组后，目标态架构树和切换清单未同步为可解析的当前路径，且未来占位命名没有显式与当前已部署事实分隔。 |
| 建议方向 | 从当时最新 `zdt-next` 建立单一 voucher-architecture-navigation 批次：标注目标/已实现状态，修正或解释路径前缀，并把未来迁移编号改为明确的待实施约定；不创建迁移、不删除旧代码、不启用冻结 operation。 |
| 预计修改范围 | 单一架构文档及可选链接/路径校验。 |
| 验证方式 | 每个当前路径可解析到固定主线对象；目标迁移/删除段明确不可执行前置条件；阅读者可区分 19 个运行 operation 与 74 个 frozen target operation。 |
| 回滚方式 | 回退独立文档导航提交。 |
| 是否需要独立复核 | 否。 |

## F-0331｜指标目录指向不存在的 telemetry/capacity 相对路径

| 字段 | 记录 |
| --- | --- |
| 模块 | Documentation / metrics navigation |
| 类型 | 配置来源链接、运行资料可达性 |
| 严重级别 | **P3** |
| 置信度 | 高（Markdown 相对路径解析后目标不存在；实际配置文件存在于不同目录） |
| 文件和精确位置 | `05_docs_ziliao/docs_wendang/metrics/catalog.md:20`；实际配置：`02_platform_pingtai/config/telemetry.yml`、`02_platform_pingtai/config/capacity.yml`。 |
| 当前/预期 | 指标目录将初始 SLO/capacity 链接写为 `../../config/telemetry.yml` 与 `../../config/capacity.yml`；从 `docs_wendang/metrics/` 解析会落到不存在的 `docs_wendang/config/`。预期是链接指向实际平台配置，或明确这是非运行参考。 |
| 直接证据 | [FACT][E-AU-858-001] 两个相对目标文件均不存在；[FACT][E-AU-858-002] 固定基线中实际文件位于 `02_platform_pingtai/config/`，`RuntimeCatalog.generated.ts` 也将 cache/capacity 指为生成输入；[FACT][E-AU-858-003] telemetry SLO/redaction 键无运行消费者的独立问题已由 F-0261 记录。 |
| 调用链或运行入口 | 人工指标/告警读者 → metrics catalog → SLO/capacity 配置；非运行时调用链。 |
| 用户影响 | 操作者无法从指标目录抵达实际阈值/容量来源，可能使用不存在路径或把目录表当成唯一配置。 |
| 数据影响 | 无直接数据影响。 |
| 安全影响 | 无直接安全漏洞。 |
| 根因 | 文档移动或目录重组后，相对路径未随平台配置实际位置更新。 |
| 建议方向 | 从当时最新 `zdt-next` 建立单一 docs-metrics-navigation batch：修正两个链接并在目录中注明 metrics catalog 不替代 telemetry 的运行消费者；不调整任何阈值、告警、配置或运行代码。 |
| 预计修改范围 | 单一 Markdown 文档和可选链接校验。 |
| 验证方式 | Markdown 链接解析到现有配置文件；读者能区分指标目录、阈值配置和实际运行 consumer。 |
| 回滚方式 | 回退独立文档链接提交。 |
| 是否需要独立复核 | 否。 |

## F-0330｜机器规则台账把历史快照统计称为“当前”，遗漏固定基线新增入口

| 字段 | 记录 |
| --- | --- |
| 模块 | Documentation / machine-rule governance |
| 类型 | 调用图基线、发布入口与测试入口漂移 |
| 严重级别 | **P3** |
| 置信度 | 高（台账自带历史 SHA；固定审计基线的精确文件计数、diff 和 package/workflow 入口为直接证据） |
| 文件和精确位置 | `05_docs_ziliao/docs_wendang/governance/zdt-rule-rebuild/06-第三批-机器规则调用图与标准对齐总台账.md:3-16,29-46,97-129,159-174`；`.github/workflows/deploy-oss.yml:1-114`；`package.json:76,119`。 |
| 当前/预期 | 台账明确基于 `cc8ab201` 的 2026-09-12 快照，却在结论和物理清单中将 2 workflows、50 check、33 audit 写为“当前”。固定审计基线实际有 3 workflows、52 个 check `.mjs`、32 个 audit `.mjs/.sql`：新增 `deploy-oss.yml` 是可手动触发的 OSS→ECS Console 发布路径；新增 session-membership fixture 和 password-login fixture 已有 package 入口。预期是任何后续复用该台账时以其 SHA/日期作为强制边界，或由当前调用图重新生成入口/数量，不能把旧表作删除、门禁或发布完整性依据。 |
| 直接证据 | [FACT][E-AU-853-001] 台账 3-4 声明 `cc8ab201` 快照，7-10、35-44、97-129 却使用“当前”计数；[FACT][E-AU-853-002] 固定基线实数为 workflow=3、check=52、audit=32；[FACT][E-AU-853-003] `cc8ab201..5a1ce71` 新增 `deploy-oss.yml`、`identity-notification-recovery.test.mjs`、`session-membership-permission-consumption.pg17-fixture.mjs`、`password-login-stability.pg17-fixture.mjs`；[FACT][E-AU-853-004] package 76、119 已将后两项接入根脚本。独立 OSS pointer writer 的运行风险已有 F-0016，不在此重复定级。 |
| 调用链或运行入口 | 治理/清理决策者 → 第三批台账 → 判断 workflow、check/audit 或候选删除入口；遗漏的 `deploy-oss.yml` 自身为 workflow_dispatch → OSS upload → ECS Console pointer 的独立发布链。 |
| 用户影响 | 若把该快照误作当前调用图，维护者可能漏审后续测试入口或独立 Console 发布通道，导致错误的门禁、清理或发布判断。 |
| 数据影响 | 本问题本身不写数据；遗漏发布路径会妨碍对 Console 制品切换风险的完整判断。 |
| 安全影响 | 无新增直接漏洞证据；遗漏含 OSS 凭据与 root SSH 的手动 workflow 会削弱发布面审阅完整性。 |
| 根因 | 快照报告虽保留基线元数据，但未将“当前物理树”文案和清单字段严格限定为 as-of `cc8ab201`，也没有当前调用图跳转。 |
| 建议方向 | 从当时最新 `zdt-next` 建立单一 docs-machine-map-refresh batch：保留历史台账，所有表头改为 as-of SHA/日期并链接可重算的当前调用图；任何更新须重新枚举 workflow、package 入口、check/audit 和发布 writer，不改运行脚本或 workflow 行为。 |
| 预计修改范围 | 本台账的快照标识/导航和可选的机器调用图生成校验。 |
| 验证方式 | 独立复核以同一 SHA 重算文档计数；当前图能列出三条 workflow 和新增包入口，并把 OSS Console 通道与既有 F-0016 关联。 |
| 回滚方式 | 回退独立文档/生成校验提交；不触及发布控制面。 |
| 是否需要独立复核 | 是（发布与质量 Owner；需独立重算入口并复查 F-0016 的 writer/lock 关系）。 |

## F-0329｜治理重建目录仍把已完成的第二批称为“当前阶段”

| 字段 | 记录 |
| --- | --- |
| 模块 | Documentation / governance navigation |
| 类型 | 阶段状态、导航准确性 |
| 严重级别 | **P3** |
| 置信度 | 高（目录首页的“当前阶段”与同页已安装结果及 LAW ACTIVE 登记直接冲突） |
| 文件和精确位置 | `05_docs_ziliao/docs_wendang/governance/zdt-rule-rebuild/README.md:5,10,13`；`LAW.md:49-57`；`05_docs_ziliao/docs_wendang/governance/zdt-rule-rebuild/06-第三批-机器规则调用图与标准对齐总台账.md:1-16`；`07-第四批-契约重建过渡与运行收口.md:1-5`。 |
| 当前/预期 | README 仍称“当前阶段：第二批 SFL 标准体系安装”，同页却说明五项标准已经安装并由 LAW ACTIVE 启用，同目录还存有第三/四批记录。预期是首页把第二批明确标为完成历史，且将当前权威判断交给 LAW；未完成的后续治理工作只能标为计划、过渡或 UNKNOWN。 |
| 直接证据 | [FACT][E-AU-852-001] README 5 使用现在时“当前阶段：第二批”；[FACT][E-AU-852-002] README 10、13 同时称第二批输入为 REFERENCE 且五套标准已安装；[FACT][E-AU-852-003] LAW 51-55 逐项登记五项 ACTIVE 标准；[FACT][E-AU-852-004] 06/07 文档标题和状态证明后续阶段资料已存在，但均不自动形成现行执行授权。 |
| 调用链或运行入口 | 人工/AI 从治理重建目录 README 进入 → 判断标准安装状态与阶段入口；非运行时调用链。 |
| 用户影响 | 读者可能重复执行已完成的标准安装思路，或误判当前治理工作和可执行授权状态。 |
| 数据影响 | 无直接数据影响。 |
| 安全影响 | 无直接安全漏洞；错误导航可能间接导致遗漏当前安全标准。 |
| 根因 | 标准安装完成及后续阶段资料创建后，目录首页的阶段状态未随之更新为历史/索引语义。 |
| 建议方向 | 从当时最新 `zdt-next` 建立单一 docs-governance-index batch：以“阶段资料索引”取代“当前阶段”表述，标注每份文档的 HISTORY/REFERENCE/TRANSITION 状态，并链接 LAW 作为唯一现行标准入口；不改标准、代码或控制面。 |
| 预计修改范围 | 治理重建 README 与可选导航一致性检查。 |
| 验证方式 | 新读者可无歧义区分已完成的第二批、后续历史/过渡资料和当前 ACTIVE 标准；README 不再暗示资料本身构成执行授权。 |
| 回滚方式 | 回退独立文档导航提交。 |
| 是否需要独立复核 | 是（治理 Owner）。 |

## F-0328｜阶段一权威台账仍称五项标准“尚未安装”，与 LAW 当前 ACTIVE 登记冲突

| 字段 | 记录 |
| --- | --- |
| 模块 | Documentation / governance authority |
| 类型 | 标准生命周期、权威导航漂移 |
| 严重级别 | **P3** |
| 置信度 | 高（同一基线内的 REFERENCE 台账和 LAW 的直接、相反状态声明） |
| 文件和精确位置 | `05_docs_ziliao/docs_wendang/governance/zdt-rule-rebuild/03-第一批-权威状态与旧规则去向表.md:3,10,17-27,111,132`；`LAW.md:49-57`；`05_docs_ziliao/docs_wendang/governance/standards/README.md:5-15`。 |
| 当前/预期 | 阶段一台账虽标为 `REFERENCE`，但仍以现在时称新标准“尚未安装”、LAW 未启用任何 SFL 标准，并将多项规则写为“待安装”；当前 LAW 已把 YC-GOV、SFL-CORE、SFL-SRI、ZDT-BIZ 和 REALM-GOV 五项登记为 `ACTIVE`。预期是历史阶段台账显式标明其 as-of 状态并指向 LAW，不与当前权威状态并列为可执行事实。 |
| 直接证据 | [FACT][E-AU-851-001] 阶段一台账 3 标为 REFERENCE，但 10、111、132 仍声明标准未安装/未启用；[FACT][E-AU-851-002] LAW 51-55 逐项列出五个 ACTIVE 标准，57 明示运行注册表与疆域骨架仅为 REFERENCE；[FACT][E-AU-851-003] standards README 7-11 为五项现行标准提供职责导航。 |
| 调用链或运行入口 | 人工/AI 查阅治理重建台账 → 判断当前标准权威与适用规则；非运行时调用链。 |
| 用户影响 | 协作者可能忽略已生效的治理、安全、业务或疆域标准，或错误把阶段一的历史实施状态当成当前决定。 |
| 数据影响 | 无直接数据写入或数据完整性影响。 |
| 安全影响 | 无直接漏洞证据；错误忽略已启用的 SFL-SRI 会间接削弱安全审阅和变更判断的一致性。 |
| 根因 | 第二批安装标准后，阶段一固定台账未补充明确的历史时间点和当前 LAW 跳转。 |
| 建议方向 | 从当时最新 `zdt-next` 建立单一 docs-governance-authority batch：保留阶段一取证内容，将其首屏/相关段落标明历史 as-of，并增加 LAW 为唯一现行状态入口的链接；不修改标准正文、业务代码、机器门禁或线上配置。 |
| 预计修改范围 | 阶段一台账、治理导航及可选的文档状态一致性检查。 |
| 验证方式 | 独立读者可从任一入口区分历史阶段事实、REFERENCE 资料和当前 ACTIVE 标准；五项标准状态只以 LAW 为现行判定源。 |
| 回滚方式 | 回退独立文档/导航提交；不影响已启用标准或运行控制面。 |
| 是否需要独立复核 | 是（治理 Owner；须独立复查 LAW 登记与阶段台账状态）。 |

## F-0327｜Mall 产品边界文档的“正式裁定”措辞越过现行权威层级

| 字段 | 记录 |
| --- | --- |
| 模块 | Documentation / product and architecture governance |
| 类型 | 架构权威边界、术语治理 |
| 严重级别 | **P3** |
| 置信度 | 高（文件自称裁定/冻结与治理台账状态直接对照） |
| 文件和精确位置 | architecture/05-Mall产品边界取证与裁定.md:9-18、78-121、123-131；governance/zdt-rule-rebuild/03-第一批-权威状态与旧规则去向表.md:3、17、27、64。 |
| 当前/预期 | 文档将 Mall Product/Mall Scope 区分、产品名称与品牌命名写为“正式裁定/固定/冻结”；治理台账明确未被 LAW 启用的 `architecture/**` 是 REFERENCE，根 LAW 是唯一 ACTIVE 权威入口。预期应清楚标明这是历史/参考设计，并将任何当前产品权威决策交由 LAW/已安装标准或明确的权威索引。 |
| 直接证据 | [FACT][E-AU-844-001] 文档明示 2026-09-02 的原仓库、WCHS、阿里云取证并使用正式裁定措辞；[FACT][E-AU-844-002] 当前代码中 `mall_id`/`mallId` 确有大量范围传递，支持 Mall Scope 的事实层；[FACT][E-AU-844-003] 治理台账将未启用 architecture 建议列为 REFERENCE。 |
| 调用链或运行入口 | 人工/AI → architecture/05 → 产品命名、所有权或架构设计决策；不是运行时入口。 |
| 用户影响 | 后续协作者可能将历史说明视作可直接执行的现行产品治理规则，绕过当前权威入口或误把 Scope 术语变化当成运行改造授权。 |
| 数据影响 | 无直接数据影响。 |
| 安全影响 | 无直接线上安全影响。 |
| 根因 | 历史架构裁定在治理重建后未回写其 REFERENCE 状态或当前权威指针。 |
| 建议方向 | 从最新主线建立 docs-authority-boundary batch：保留 Mall Product/Mall Scope 术语及取证内容，首屏标为 REFERENCE/HISTORY 并链接当前 LAW/权威索引；不改业务模型、数据字段或发布。 |
| 预计修改范围 | 文档 front matter、导航/术语索引和可选静态权威校验。 |
| 验证方式 | 文档读者能区分历史取证、参考设计和可执行现行规则；现有链接仍可追溯。 |
| 回滚方式 | 回退独立文档/索引提交。 |
| 是否需要独立复核 | 是（治理/产品/架构 Owner）。 |

## F-0326｜分支谱系图把历史快照称为“当前”，与现行远程状态不一致

| 字段 | 记录 |
| --- | --- |
| 模块 | Documentation / GitHub branch lineage |
| 类型 | 运行/发布证据时效、历史快照标识 |
| 严重级别 | **P3** |
| 置信度 | 高（文档快照日期、文内分支计数与实时只读远程引用直接对照） |
| 文件和精确位置 | architecture/02-github-分支谱系与收口图.md:1-14、33-39、61-75、264-270。 |
| 当前/预期 | 文档正确标注 2026-09-02 快照，但在后续段落将 28、20、9、8 等历史计数写为“当前”并称 `full-production` 为当前最粗远程线。AU-841 只读 `git ls-remote --heads origin` 得到 44 条当前 head，`origin/zdt-next` 为 `e09895d…`。预期历史图必须显式使用“当时/快照”措辞，并指向当前 GitHub 真值查询。 |
| 直接证据 | [FACT][E-AU-841-001] 文档 front matter/首段日期为 2026-09-02；[FACT][E-AU-841-002] 文内记录最终远程数 8；[FACT][E-AU-841-003] 2026-09-15 只读远程查询返回 44 个 `refs/heads/*`。 |
| 调用链或运行入口 | 维护者/审计者 → architecture/02 → 分支收口或资产提炼决策；不是 runtime 入口。 |
| 用户影响 | 维护者可能误按已过期的分支集合、承接关系或删除前提进行 Git 操作，遗漏后续分支和独有提交。 |
| 数据影响 | 无直接数据影响。 |
| 安全影响 | 无直接线上安全影响；错误分支治理可间接造成历史/恢复资产风险。 |
| 根因 | 历史收口报告在完成后保留了时间语义，但未将所有“当前”导航用语统一降为快照。 |
| 建议方向 | 从最新主线建立 docs-git-truth batch：标题/摘要统一标记历史快照，提供只读当前远程真值入口；不在该批执行分支删除、恢复、推送或合并。 |
| 预计修改范围 | 仅历史文档措辞、导航链接和可选只读核对说明。 |
| 验证方式 | 任意读者能从页面区分 2026-09-02 快照与当前远程状态；文档不再提供可误执行的现状分支集。 |
| 回滚方式 | 回退独立文档提交。 |
| 是否需要独立复核 | 是（Release/Git Owner）。 |

## F-0325｜历史分支关闭账本索引遗漏大部分同目录记录

| 字段 | 记录 |
| --- | --- |
| 模块 | Documentation / Git branch closure history |
| 类型 | 历史记录可发现性、发布追溯 |
| 严重级别 | **P3** |
| 置信度 | 高（README 目录清单与同目录文件直接对照） |
| 文件和精确位置 | architecture/branch-closures/README.md:13-25；architecture/branch-closures/002-purchase-readiness-finance-guard.md:1；003-graceful-preview-access-20260830.md:1；004-dim-denied-surfaces-20260830.md:1；005-014-inherited-branches-batch-20260902.md:1；015-025-eight-branch-consolidation-20260902.md:1。 |
| 当前/预期 | README 的“当前进度”和“记录”仅列 001，但目录已有 002—004、005—014 和 015—025 五份关闭记录，且上层 architecture 文档直接引用其中多份。预期索引应完整列出已有记录，并将其标注为历史快照而非当前 GitHub 状态。 |
| 直接证据 | [FACT][E-AU-839-001] README 唯一记录链接是 001；[FACT][E-AU-839-002] 同目录存在五份未列出的关闭记录；[FACT][E-AU-839-003] architecture/02、03、04 对其中记录有静态历史引用。 |
| 调用链或运行入口 | 维护者/审计者 → README 账本索引 → 历史关闭证据；不是运行时入口。 |
| 用户影响 | 复盘者可能误以为只关闭过一条分支，遗漏 Bundle、Tag、保留 worktree 与恢复边界，增加错误清理或错误恢复的风险。 |
| 数据影响 | 无直接数据影响。 |
| 安全影响 | 无直接线上安全影响。 |
| 根因 | 关闭记录在后续批次新增，但目录索引未同步扩展。 |
| 建议方向 | 从最新主线建立独立 docs-history-index batch：补全索引、注明全部条目均为 2026-09-02 历史快照，并链接当前分支真值来源；不执行任何 GitHub 删除、恢复、Bundle 或部署动作。 |
| 预计修改范围 | 仅 README/architecture 历史导航与可选链接校验。 |
| 验证方式 | README 可发现全部同目录记录；读者能区分历史分支数与当前远程状态。 |
| 回滚方式 | 回退独立文档索引提交。 |
| 是否需要独立复核 | 否。 |

## F-0324｜SFL 版本标准的自称权威与当前治理状态冲突

| 字段 | 记录 |
| --- | --- |
| 模块 | Documentation / SFL architecture and release design |
| 类型 | 架构权威治理、发布操作风险 |
| 严重级别 | **P2** |
| 置信度 | 高（版本文件 front matter 与治理台账直接冲突） |
| 文件和精确位置 | architecture/08-SFL-四流合一节点主权架构标准 V1.5.md:1-14；10-SFL-四流合一节点主权架构标准 V1.6.md:1-23；12-SFL-四流合一节点主权架构标准 V1.8.md:1-37；13-SFL-全项目统一AI发布引擎标准 V1.0.md:1-20；governance/zdt-rule-rebuild/03-第一批-权威状态与旧规则去向表.md:8-31。 |
| 当前/预期 | 1.5/1.6/1.8 分别写作正式标准或唯一 SFL 入口，1.0 写作候选发布标准；治理台账将 1.5/1.6/1.8 及未被 LAW 启用的架构建议定义为 HISTORY/REFERENCE，并将 LAW 定义为唯一权威入口。预期同一文档树只应有一个可判定的 current authority，历史标准不得自称可直接约束新任务。 |
| 直接证据 | [FACT][E-AU-837-001] 版本 front matter/status/canonical_path/唯一入口文本；[FACT][E-AU-837-002] 治理台账对 LAW、历史 SFL 和架构建议的状态表；[FACT][E-AU-837-003] 未发现四份文档被 runtime/workflow 消费。 |
| 调用链或运行入口 | 人工/AI 架构和发布决策 → 文档；实际机器发布控制面独立于这些文档。 |
| 用户影响 | 维护者可能按 1.8 或候选发布引擎文本越过当前 LAW/受控 delivery，或将历史节点/发布规则当作现行约束。 |
| 数据影响 | 无直接数据影响。 |
| 安全影响 | 文档误授权可能扩大高风险发布操作范围；未发现当前机器已执行这些旧规则。 |
| 根因 | 历史版本与治理降权记录没有回写/显著链接到原标准的首屏状态。 |
| 建议方向 | 从最新主线建立 sfl-authority-index batch：在历史版本首屏加入 HISTORY/REFERENCE 指针，明确当前 LAW 和受控 delivery；保留原文与版本 hash，不重写历史技术内容。 |
| 预计修改范围 | 文档 front-matter/索引/链接与可选静态权威校验；不改发布引擎或业务代码。 |
| 验证方式 | 任一架构入口能解析到唯一 current authority；历史页面不能被当作 current instruction；已有引用保留追溯路径。 |
| 回滚方式 | 回退独立文档/索引提交。 |
| 是否需要独立复核 | 是（发布/治理权威）。 |

## F-0322｜前端 evidence 快照混合过期分支与当前验证语义，不能作为当前缺口或通过证明

| 字段 | 记录 |
| --- | --- |
| 模块 | Documentation / frontend evidence |
| 类型 | 审计证据可信度、历史基线漂移 |
| 严重级别 | **P2** |
| 置信度 | 高（快照元数据、路径存在性与当前 manifest check 直接证据） |
| 文件和精确位置 | `05_docs_ziliao/docs_wendang/evidence/frontend/baseline.yml:1-18`；`execution.yml:1-`；`gaps.yml:1-`；`04_tools/scripts/evidence/frontendmanifest.mjs:7-48`。 |
| 当前/预期 | baseline 固定为 2026-08-26 外部 `integration/merge-20260820` 与 913 个状态项；execution/gaps 仍将旧 `apps/auth`、`apps/store`、`apps/supplier` 路径及历史 P0/VerifiedLocal 叙述混在当前文档区。当前 file manifest `--check` 报 drift。预期所有可用于当前审计/发布的前端证据应有当前基线 SHA、可解析路径、生成时间和明确的 historical/current 状态。 |
| 直接证据 | [FACT][E-AU-832-001] baseline 声明外部 authority/旧分支和旧 SHA；[FACT][E-AU-832-002] sampled execution/gaps 路径 `apps/auth|store|supplier/...` 在当前仓库不存在；[FACT][E-AU-832-003] 正式只读 `frontendmanifest.mjs --check` 抛 `FRONTEND_FILE_MANIFEST_DRIFT`；[FACT][E-AU-832-004] 既有 F-0005 已记录 owner-approved 前端清单漂移。 |
| 调用链或运行入口 | 人工前端需求/缺口/验收判断 → evidence YAML/JSON；generator 仅写/校验 `files.json`，未消费三个 YAML。 |
| 用户影响 | 维护者可能把历史 P0 或历史通过断言误解为当前风险/当前验证，错误排定修复、放行或架构判断。 |
| 数据影响 | 无。 |
| 安全影响 | 无已证实线上 P0；历史 P0 标签必须重新绑定当前代码和运行入口后才可升级。 |
| 根因 | evidence 文档未与生成清单、当前 repo layout 和审计基线形成版本绑定或失效标记。 |
| 建议方向 | 从最新主线建立 frontend-evidence-provenance batch：将快照移入带 SHA/date 的历史目录或在首行标记 historical；为当前 evidence 从正式 source inventory 生成路径/散列，并让 gate 拒绝过期 baseline 被声明为 VerifiedLocal。 |
| 预计修改范围 | evidence YAML/JSON、frontend manifest generator/check 与少量 fixture；不改前端业务代码。 |
| 验证方式 | 当前 baseline 生成的证据全部路径存在且 check 通过；旧快照可保留但不会被当前 gate/报告当作 current；每项 P0/P1 有当前调用链复核。 |
| 回滚方式 | 回退独立 evidence/gate 提交；保留历史文件。 |
| 是否需要独立复核 | 是（证据语义与历史 P0 标签）。 |

## F-0323｜历史 prompts 与“标准提示词”入口及近重复版本并存，容易被误作当前指令

| 字段 | 记录 |
| --- | --- |
| 模块 | Documentation / AI and implementation prompts |
| 类型 | 维护性、AI 协作指令治理 |
| 严重级别 | **P3** |
| 置信度 | 高（治理状态、标题/内容 hash 与引用关系直接证据） |
| 文件和精确位置 | 9 个 files under docs_wendang/prompts；docs_wendang/README.md:14；governance/zdt-rule-rebuild/03-第一批-权威状态与旧规则去向表.md:21-31。 |
| 当前/预期 | 治理台账将 prompts/** 明确标为 HISTORY、不能成为当前指令，但顶层 README 仍将其称为“标准与专项提示词”。存在同名近重复的 zhudatuan/无前缀版本，商城与订单版本内容 hash 不同且其中一份订单标题仍为 Smart Wing OMS。预期历史 prompts 应有明确不可执行标记、唯一 canonical/历史版本指针和防误选入口。 |
| 直接证据 | [FACT][E-AU-835-001] 治理台账列 prompts/** 为 HISTORY；[FACT][E-AU-835-002] 9 文件内容 SHA-256 均不同；[FACT][E-AU-835-003] 四组名称只差 zhudatuan 前缀或符号；[FACT][E-AU-835-004] 仅 strategy/architecture 文档链接，未发现 runtime/workflow consumer。 |
| 调用链或运行入口 | 人工或 AI 手工打开 prompts → 任务执行；不是程序运行入口。 |
| 用户影响 | 后续协作可能选择错误项目版本、把历史大范围修复指令当成当前授权，导致不必要的跨模块改动或重复审计。 |
| 数据影响 | 无直接数据影响。 |
| 安全影响 | 无直接线上安全影响；错误提示词可能间接改变权限/部署等高风险任务范围。 |
| 根因 | 文档降权台账与顶层导航未建立同一状态标签，近似历史副本未显式标明 canonical/替代关系。 |
| 建议方向 | 从最新主线建立 prompt-governance batch：顶层入口明确 HISTORY，建立一个当前授权任务模板入口；为近重复文档记录版本关系/来源，不删历史副本。 |
| 预计修改范围 | prompts README/索引、顶层 README、治理链接与可选的静态校验；不改业务代码。 |
| 验证方式 | 自动/人工入口不能将 HISTORY prompt 当 current；每组有明确 canonical 或历史关系；旧链接仍可追溯。 |
| 回滚方式 | 回退独立文档/索引提交。 |
| 是否需要独立复核 | 否。 |

## F-0304｜调用图门禁仍按重组前顶层路径和退休目录判断，679 项全量输出不可判读

| 字段 | 记录 |
| --- | --- |
| 模块 | Quality / static call graph |
| 类型 | 架构边界、质量门禁可信度 |
| 严重级别 | **P2** |
| 置信度 | 高（路径条件、当前源码根和全量运行输出直接证据） |
| 文件和精确位置 | `04_tools/scripts/check/calls.mjs:14-18,35-43,72-88,174-232`。 |
| 当前/预期 | entrypoint 与 client/service boundary 逻辑要求相对路径首段为 `apps/services`，当前生产源码为 `01_core_hexin/apps|services|packages|extensions`；同时 `retiredParts`包含仍在当前树的 `auth-web`、`storefront-web` 等。完整扫描报679项。预期是基于当前 source inventory 的根归类，并将已正式存在的应用与真正 retired compatibility tree 区分。 |
| 直接证据 | [FACT][E-AU-784-001] `--self-test`只验证临时 AST import/route，不覆盖真实仓库根分类且通过；[FACT][E-AU-784-002] 全量命令输出 `violations=679`，含 storefront mock imports、当前 `@smart-wing` compatibility imports 和大量 webbusiness/localinfra/seed `UNREACHABLE_PRODUCTION_SOURCE`；[FACT][E-AU-784-003] 这些规则使用顶层路径条件，而真实路径以 `01_core_hexin/` 开始。 |
| 调用链或运行入口 | `npm run check:calls` → `calls.mjs` → shared source discovery + six sub-callgraph auditors。 |
| 用户影响 | 不直接改变运行路径；门禁不能提供可信“零未达文件/零违规调用”结论，真实边界违规可能被结构性噪声掩盖。 |
| 数据影响 | 只读源码。 |
| 安全影响 | 无直接利用证据；身份、数据和 job 调用关系的静态回归检查可靠性下降。 |
| 根因 | 源码重组与兼容包策略演进后，entry/boundary/retired rules未从共享 source inventory 统一推导。 |
| 建议方向 | 从修复时最新 `zdt-next`建立单一 callgraph-root-contract 批次：先定义当前生产 roots、正式 entrypoints、兼容包与 retired tree；再为每类规则加入真实路径 fixture，最后逐个复核剩余输出。禁止直接 suppress 679项。 |
| 预计修改范围 | calls checker、shared source inventory、定向 fixtures；不改业务调用。 |
| 验证方式 | 当前已知入口可达；已知 compatibility import按策略分类；植入跨层/未解析/生产测试 import仍必须失败；剩余结果逐条可解释。 |
| 回滚方式 | 回退独立 checker/fixture 提交。 |
| 是否需要独立复核 | 是（架构边界门禁）。 |

## F-0309｜Web Business 发布门禁要求已不存在的 Caddy matcher，公开业务路由 ownership 无法验证

| 字段 | 记录 |
| --- | --- |
| 模块 | Web Business API / release contract |
| 类型 | 发布可验证性、公开 API 路由边界 |
| 严重级别 | **P2** |
| 置信度 | 高（checker matcher、当前 Caddy 与运行输出直接证据；线上状态未验证） |
| 文件和精确位置 | `04_tools/scripts/check/web-business-deployment.mjs:53-58,279-284`；`02_platform_pingtai/infrastructure/zhudatuan/aliyun/Caddyfile:97-110`。 |
| 当前/预期 | checker要求 `@webBusinessApi path …`，再以历史 `api.zhudatuan.com` block继续校验；当前Caddy没有该 matcher，`api.fufu.wang` site仅声明 `reverse_proxy localhost:3001`。固定基线抛 `WEB_BUSINESS_CADDY_MATCHER_MISSING`，后续 delivery/systemd/role/operation closure无执行。预期是当前正式 API site能以结构化配置证明每个公开 business path 的 owner、method、upstream和拒绝路径。 |
| 直接证据 | [FACT][E-AU-796-001] 定向命令在57行失败；[FACT][E-AU-796-002] checker regex要求旧单行 matcher，现行Caddy的 API site无此声明并已使用fufu host/3001 upstream。 |
| 调用链或运行入口 | Web Business release verification → static Caddy/delivery/runtime checker；实际API request routing未由本批运行。 |
| 用户影响 | 团队无法用该门禁证明公开 member/catalog/cart/benefit/order paths仍由预期专用 runtime处理；未证明用户请求已路由错误。 |
| 数据影响 | 未执行读写；错误 route owner将来可能导致跨 scope/契约差异，但本批无实际数据库影响证据。 |
| 安全影响 | 公共 API 的暴露面、method/path allowlist和专用 role隔离失去可运行的发布前证明。 |
| 根因 | Caddy/API 站点拓扑演进后，checker仍依赖旧 matcher文法和旧 host block边界。 |
| 建议方向 | 从最新主线建立 web-business-release-contract 批次：先确认当前 selected API upstream/owner，然后从 Caddy parser或明确 route manifest派生检查，覆盖每个 public path、method、negative route、专用 role和 upstream；不要仅改字符串或线上 reload。 |
| 预计修改范围 | Web Business checker、Caddy/delivery route contract、定向 fixtures；不改业务操作代码。 |
| 验证方式 | current selected host与所有 public paths通过；错误 host/upstream/method/forbidden operation必须失败；隔离candidate上做HTTP route对照后再考虑发布。 |
| 回滚方式 | 回退独立 checker/fixture/contract提交。 |
| 是否需要独立复核 | 是（公开 API 发布边界）。 |

## F-0300｜Schema 写入所有权门禁将业务目录名误作数据库 schema，固定基线 127 条失败不可判读

| 字段 | 记录 |
| --- | --- |
| 模块 | Quality / schema ownership gate |
| 类型 | 架构边界、测试/门禁可信度 |
| 严重级别 | **P2** |
| 置信度 | 高（规则与固定基线输出直接证据） |
| 文件和精确位置 | `04_tools/scripts/check/ownership.mjs:8-25,30-31`；示例 `01_core_hexin/services/commerce/src/modules/payment_zhifu/03_application_yingyong/services_fuwu/PaymentSettlement.ts:54,56,59,81`。 |
| 当前/预期 | checker 从模块路径得到 `payment_zhifu`，默认只准写同名 schema；实际本模块写 `payment.*` 即报错。预期是明确的模块→schema ownership 映射，或能够识别该模块的正式 schema owner，再以此报告真实跨域写入。 |
| 直接证据 | [FACT][E-AU-781-001] `schemaOwners`仅登记 `finance/order` 的例外，其他模块使用目录名；[FACT][E-AU-781-002] 固定基线运行输出 `schema-write-ownership accepted=false violations=127`，并将 payment_zhifu 对 `payment` 的自有写入报告为违规。 |
| 调用链或运行入口 | `npm run check:ownership` → `check/ownership.mjs` → 扫描 Commerce module production sources 的 SQL 写入文本。 |
| 用户影响 | 当前失败不能作为跨模块写入风险的可靠信号，真实越界写入可被127条假阳性淹没；不会直接改变运行时行为。 |
| 数据影响 | 检查器只读源码，不写数据库；其失效会降低未来对数据库所有权回归的发现能力。 |
| 安全影响 | 无直接漏洞证据；不可信边界门禁会削弱对跨 tenant/schema 数据路径的预防性审查。 |
| 根因 | 代码模块命名（含中文后缀）与 PostgreSQL schema 名不一一对应，规则只为两个英文模块手写特殊映射。 |
| 建议方向 | 从修复时最新 `zdt-next`建立单一 schema-ownership-gate 批次：把完整 module→owned schema 关系放入可审计的显式清单；为自有写、允许的 audit/runtime 共享写和至少一个拒绝路径添加 fixture；保留逐项输出。 |
| 预计修改范围 | ownership checker、一个 ownership manifest、定向测试；不改业务 SQL。 |
| 验证方式 | 固定基线应对已确认自有写返回0；人为植入一个未授权 schema 写入必须失败；真实跨 schema 例外须有声明与审查来源。 |
| 回滚方式 | 回退独立 checker/manifest/test 提交；在恢复可信门禁前不得将其“通过”当作 ownership 证明。 |
| 是否需要独立复核 | 是（P2中的架构边界门禁）。 |

## F-0305｜支付部署声明门禁依赖过时精确源码片段，等价安全接线被误判失败

| 字段 | 记录 |
| --- | --- |
| 模块 | Payment Jobs / Payment Webhook release contracts |
| 类型 | 发布可验证性、静态门禁脆弱性 |
| 严重级别 | **P2** |
| 置信度 | 高（expectation、实际等价接线和运行输出直接证据） |
| 文件和精确位置 | `check/payment-jobs-deployment.mjs:16-22,44-49`；`PaymentJobsRuntime.ts:98-137`；`check/payment-webhook-deployment.mjs:27-31`；`PaymentWebhookApiMain.ts:9-20`。 |
| 当前/预期 | Jobs checker要求具体 literal `state.current_user !== 'shopjob'`，实际使用参数默认 `expectedRole = 'shopjob'` 并做同一比较；Webhook checker要求三参数 listen，实际调用带第四个 node context resolver。两个检查均在该文本差异处抛错，余下 service/env/delivery 断言不执行。预期是验证角色、loopback port、operation isolation 等行为/结构契约，而非完整调用文本。 |
| 直接证据 | [FACT][E-AU-786-001] Jobs 定向命令报缺少旧 literal；实际 runtime 134-137 default role 为 shopjob且 fail-closed比较；[FACT][E-AU-786-002] Webhook 定向命令报缺少三参 literal；entry 20 行保留相同 app/port/127.0.0.1并额外传入 resolver。 |
| 调用链或运行入口 | 两个人工/质量静态 checker → payment runtime/entry → systemd/env/delivery 交叉断言。未发现根 package/workflow自动入口。 |
| 用户影响 | 不直接证明支付 worker 或 webhook 不安全；当前门禁不能证明完整支付发布链的其它声明仍一致，发布审计证据被阻断。 |
| 数据影响 | 未执行数据库写入、迁移或队列。 |
| 安全影响 | Webhook loopback/profiles/roles的静态回归保证下降；未发现签名或权限绕过。 |
| 根因 | 实现演进（参数化角色、node context）后，检查器将历史字符串当作稳定接口。 |
| 建议方向 | 从最新主线拆出 payment-deployment-contract 批次，将高风险事实抽为小型 parser/AST 或导出的配置断言，并为“新增合法参数”“等价默认 role”写反事实；不可通过放宽任意字符串匹配修复。 |
| 预计修改范围 | 两个 checker与定向 fixture；不改支付运行代码、迁移或部署声明。 |
| 验证方式 | 同一 role/port/operation isolation 的等价重构应通过；错误 role、非 loopback bind、混入 purchase operation、错误 Caddy route 必须失败。 |
| 回滚方式 | 回退独立 checker/fixture 提交。 |
| 是否需要独立复核 | 是（支付发布边界）。 |

## F-0310｜本地预览运行时检查器锁定历史分支/base，并把正常 migration ledger 写入全部判为非法

| 字段 | 记录 |
| --- | --- |
| 模块 | Local preview tooling |
| 类型 | 开发/预览验证可信度、历史基线漂移 |
| 严重级别 | **P3** |
| 置信度 | 高（硬编码常量、source-only运行输出和 migration matcher直接证据） |
| 文件和精确位置 | `04_tools/scripts/check/local-preview-runtime.mjs:10-13,35-46,75-83`。 |
| 当前/预期 | checker默认要求历史 branch `codex/product-000a-baseline-isolation`和旧base SHA；对旧base之后 migration中所有 `insert/update/delete runtime.schemaversion`报错。当前固定审计基线在source-only模式即报branch/base mismatch、用户已有审计队列dirty files和大量 ledger mutation。预期应让当前 candidate明确提供其基线/归属，并区分合法 migration self-registration与对既有 ledger 的破坏性改写。 |
| 直接证据 | [FACT][E-AU-797-001] `--source-only`未连接服务仍报预期branch/base不符；[FACT][E-AU-797-002] 输出将大量正常 migration列为 `MIGRATION_LEDGER_MUTATION`；[FACT][E-AU-797-003] matcher仅按SQL文本命中，未区分 migration自身 version insert和修改既有记录。 |
| 调用链或运行入口 | 人工 local preview runtime validation；默认模式还会读取本地监听服务，`--prepare-runtime-config`会改写local secrets文件。 |
| 用户影响 | 本地候选预览无法得到可判读的来源/迁移安全结论，可能迫使操作者忽略整批输出；不影响已部署产品。 |
| 数据影响 | 本批未连接数据库或写配置；如果误用 `--prepare-runtime-config`，会改写 local secrets endpoint。 |
| 安全影响 | 无线上影响证据；不可信 preview guard可能降低本地对错误worktree/服务连接的发现能力。 |
| 根因 | Product-000A 专用基线和简单 SQL regex 被保留为通用预览检查。 |
| 建议方向 | 从最新主线建立 local-preview-contract 批次，参数化基线/候选规则，采用 migration inventory/ledger语义区分合法self-registration与历史修改；把写配置动作独立为显式工具。 |
| 预计修改范围 | 两个 preview checker、fixture/说明；不改生产迁移或本地 secrets值。 |
| 验证方式 | 当前批准candidate可通过source-only；正常新migration ledger insert允许、改写历史 ledger拒绝；无数据库URL时database check fail-fast；prepare动作仅在明确临时文件上验证。 |
| 回滚方式 | 回退独立工具/fixture提交。 |
| 是否需要独立复核 | 否。 |

## F-0301｜代码行数门禁仍扫描重组前的顶层目录，固定基线无法启动

| 字段 | 记录 |
| --- | --- |
| 模块 | Quality / source line budget |
| 类型 | 质量门禁、仓库结构漂移 |
| 严重级别 | **P2** |
| 置信度 | 高（脚本 roots 与 ENOENT 运行输出直接证据） |
| 文件和精确位置 | `04_tools/scripts/check-line-budget.mjs:7-8,19-31`。 |
| 当前/预期 | 脚本以仓库根的 `apps/services/packages/extensions` 为扫描根；当前源码位于 `01_core_hexin/*`，运行时在第一个 `apps` 目录抛 ENOENT。预期是扫描当前正式源码根，或由共享 source inventory 派生。 |
| 直接证据 | [FACT][E-AU-783-001] `node .../check-line-budget.mjs` 固定基线报 `scandir .../zdt-next/apps ENOENT`；[FACT][E-AU-783-002] 当前应用、服务、包、扩展目录均在 `01_core_hexin/`。 |
| 调用链或运行入口 | `npm run check:lines` → line budget walker → 根目录扫描。 |
| 用户影响 | 不直接影响运行产品；任何超行文件都不会被当前门禁测量，质量声明不可验证。 |
| 数据影响 | 无。 |
| 安全影响 | 无直接证据。 |
| 根因 | 仓库目录重组后静态扫描根未同步。 |
| 建议方向 | 从最新 `zdt-next`建立单一 line-budget-root 批次，使用现有 repository/source inventory 作为唯一根定义，并加入当前路径与不存在路径的 fixture。 |
| 预计修改范围 | 单一 checker 与定向测试。 |
| 验证方式 | 在固定基线统计实际源码；新增300行受控 fixture必须失败，忽略目录/测试/生成物必须不计入。 |
| 回滚方式 | 回退独立 checker/test 提交。 |
| 是否需要独立复核 | 否。 |

## F-0306｜身份通知恢复测试仍断言历史 scope fallback 文本，固定基线一半失败

| 字段 | 记录 |
| --- | --- |
| 模块 | Identity notification recovery evidence |
| 类型 | 测试可信度、节点 scope 契约漂移 |
| 严重级别 | **P2** |
| 置信度 | 高（test expectation、生产写入参数和定向运行输出直接证据） |
| 文件和精确位置 | `04_tools/scripts/check/identity-notification-recovery.test.mjs:22-29`；`RegistrationOperations.ts:81-86`；`RealmOperationContext.ts:20-29`。 |
| 当前/预期 | 测试要求 source 包含 `notificationScope ?? null`；实际 `runtime.job` insert传入 `notificationScope ?? realm.nodeId`。定向 Node test 的 systemd subtest通过、scope subtest失败。预期是直接验证根/子节点的 notification job scope 行为，或至少断言当前可解释的 fallback，而非历史字符串。 |
| 直接证据 | [FACT][E-AU-791-001] 固定基线 test结果为1 pass/1 fail；[FACT][E-AU-791-002] RealmOperationContext 对 sovereign child设置 `notificationScope=manifest.node_id`，RegistrationOperations 对未注入 scope 使用当前 realm node id。 |
| 调用链或运行入口 | Identity registration challenge → `runtime.job(kind=identitynotification, scope_id)` → IdentityNotificationJobs runtime；systemd unit负责 worker restart policy。 |
| 用户影响 | 该测试不能作为跨节点通知 scope 或恢复行为的可靠证据；未证明真实消息错投、漏投或 retry失效。 |
| 数据影响 | 未写数据库；真实 job scope 尚未由本测试验证。 |
| 安全影响 | 错误 scope 若发生可能影响身份验证码/通知隔离，但本批没有实际越界证据。 |
| 根因 | Notification scope fallback从 null 演进为 realm node id后，静态测试未同步其行为契约。 |
| 建议方向 | 从最新主线建立 identity-notification-scope-evidence 批次，以受控数据库 fixture覆盖 root、sovereign child、missing manifest、internal runtime restart/reclaim；保留 systemd static assertion但不再把文本片段当端到端证明。 |
| 预计修改范围 | 单一 static test，可能加最小 PG integration fixture；不改通知业务逻辑。 |
| 验证方式 | 明确构造 root/child context，断言 scope_id及消费者 claim范围；故意使用另一个 node scope时必须不可 claim；停止/重启后仅验证受控 job recovery。 |
| 回滚方式 | 回退独立测试/fixture 提交。 |
| 是否需要独立复核 | 否。 |

## F-0311｜Operation contract 字段推断器在13个关键写没有 source 映射时仍可成功并写回不完整合同

| 字段 | 记录 |
| --- | --- |
| 模块 | Contract maintenance / runtime write evidence |
| 类型 | 契约完整性、生成工具可信度 |
| 严重级别 | **P3** |
| 置信度 | 高（summary output、AST定位规则和apply路径直接证据） |
| 文件和精确位置 | `04_tools/scripts/check/infer-operation-contract-fields.mjs:17-25,61-77,84-107,132-159`。 |
| 当前/预期 | `--summary`报告79 runtime关键写中66个有source、59个有request fields、35个有response fields，13个 operation未映射source；无论missingSource是否为空脚本均退出0。`--apply`会基于当前推断合并并写回 `operations.yml`。预期应把未映射关键写作为阻断/明确审查项，或将推断输出严格标为非完整建议。 |
| 直接证据 | [FACT][E-AU-798-001] 默认只读summary列出13个missingSource（含finance reconciliation、invoice、identity.wechat、member mall/sovereignty、order receive）；[FACT][E-AU-798-002] source定位仅识别包含operation id的TS property assignment等模式；[FACT][E-AU-798-003] `--apply`调用writeFile写回operations source而未要求missingSource为空。 |
| 调用链或运行入口 | 人工 contract maintenance → AST/Vitest augmentation → optional `--apply` → operations.yml；未找到根自动入口。 |
| 用户影响 | 维护者可能把自动补全字段误作所有关键写的完整业务契约，遗漏operation的请求/响应字段或实现来源。 |
| 数据影响 | 本批没有写 operations.yml；若人工未审查地使用apply，可能将不完整元数据持久化。 |
| 安全影响 | 高风险写操作的字段/契约审查可出现盲区；未发现运行时授权绕过。 |
| 根因 | AST启发式不能覆盖所有 operation registration/handler形态，而工具没有将source coverage作为成功前置条件。 |
| 建议方向 | 从最新主线建立 operation-field-inference-evidence 批次：为每个runtime write建立明确source map或拒绝未映射项；将apply改为输出review patch/require explicit allowlist，并为动态/array/module registration写fixture。 |
| 预计修改范围 | 推断器、operation source manifest/fixture及生成流程；不改业务handler。 |
| 验证方式 | 79个runtime write均有解释性source mapping，或每个allowlisted exception有owner/理由；新未映射critical write必须非零退出；apply前后仅改变已审查字段。 |
| 回滚方式 | 回退独立工具/fixture提交，保留现有operations定义。 |
| 是否需要独立复核 | 否。 |

## F-0312｜事务边界门禁把启动装配与实际执行混同，无法作为精确交易安全证明

| 字段 | 记录 |
| --- | --- |
| 模块 | Quality / transaction boundary static gate |
| 类型 | 静态分析正确性、事务边界验证可信度 |
| 严重级别 | **P2** |
| 置信度 | 高（正式 checker 已运行，AST 判定与直接调用路径已比对；未调用真实 KMS/支付/数据库） |
| 文件和精确位置 | `04_tools/scripts/check/transactions.mjs:6-71`；`01_core_hexin/services/commerce/src/modules/purchase/PurchaseOperations.ts:115-117,134-160`；`01_core_hexin/services/commerce/src/modules/identity/05_interface_jieru/http/MobileWechatOperations.ts:130-137`；`.../foundation/application/ModuleOperations.ts:103-120,143-171`。 |
| 当前/预期 | 正式门禁退出 1，报 `PurchaseOperations.ts:116:purchasePaymentAction` 以及 `MobileWechatOperations.ts:136-137:decrypt/encrypt`。前者是构造 `ModuleOperations` 时创建 action 的启动装配，不是请求 execute；真正的 RiskGate/DecisionSink 位于 returned action 157-160。后者确在 identity step-up 的 execute 内、由 `ModuleOperations.invoke` 的 write runner 包裹，但仅凭方法名无法判断 KMS 是否远程、可否超时或是否已有事务外设计。预期门禁应定位真实 execute action、解析 action 引用和 operation write path，并把“候选”与“已证明违反”分开。 |
| 直接证据 | [FACT][E-AU-799-001] 2026-09-15 执行正式 checker，输出4项并退出1；[FACT][E-AU-799-002] checker 34-37 将任意 `new ModuleOperations` 后代直接归为 `execute`，46-57 只按固定方法名/函数声明判断；[FACT][E-AU-799-003] payment 116 仅把 factory 的返回 action 放入 map，134-168 才是 invoke 时执行的函数；[FACT][E-AU-799-004] identity 130-137 的 KMS 调用位于 lifecycle execute，ModuleOperations 103-120 会将写操作交给 command runner。 |
| 调用链或运行入口 | `npm run check:transactions` → AST scanner；实际身份链为 HTTP route → IdentityOperations → ModuleOperations → `identity.stepup.start` execute → KMS/DB；支付内部回退链为 Purchase API → `purchasePaymentOperations` → internal ModuleOperations → returned payment action。 |
| 用户影响 | 当前失败输出既可能造成无效阻断，也可能让团队误把同一输出严重性理解为真实事务违规。 |
| 数据影响 | 未执行数据库验证；身份路径中 KMS 异常时 transaction rollback 的实际效果、支付路径 risk/decision side effect 与行锁时长均未验证。 |
| 安全影响 | 未发现直接越权或密钥泄漏；身份 KMS 相关代码触及敏感手机号/挑战值，错误的 gate 不能替代专项安全/超时审查。 |
| 根因 | lifecycle classifier 以 AST 父级 `new ModuleOperations` 代替真实请求执行图，external method whitelist 也没有适配器语义或事务类型信息。 |
| 建议方向 | 从修复时最新 `zdt-next` 单独建立 transaction-gate-evidence 批次：解析 OperationAction/function reference、只对真正的 transactional execute body出证据，区分 remote/I/O candidate 与确定违规；为 KMS/RiskGate timeout 与 rollback 增加隔离 integration fixture。不要在审计分支改 checker 或业务代码。 |
| 预计修改范围 | 单一 checker、其 fixtures 和少量隔离 integration test；不改变身份/支付业务规则。 |
| 验证方式 | factory 装配但 action body无外部调用时不得报警；真实 execute 内受控 remote fake 必须定位到实际行；模拟 timeout 后验证 idempotency、DB rollback、outbox/audit 语义。 |
| 回滚方式 | 回退该独立 gate/test 批次；保留现有 checker 直至替代门禁可复现通过。 |
| 是否需要独立复核 | 是。 |

## F-0313｜测试拓扑门禁以存在性替代可执行行为，并把覆盖范围概括为 clients=6

| 字段 | 记录 |
| --- | --- |
| 模块 | Quality / test topology static gate |
| 类型 | 测试可信度、质量报告语义 |
| 严重级别 | **P2** |
| 置信度 | 高（源码断言与正式只读输出直接可复核；未运行任何业务测试） |
| 文件和精确位置 | `04_tools/scripts/check/tests.mjs:39-64,88-101`；root `package.json:91,111,123`。 |
| 当前/预期 | checker 通过并打印 `clients=6`。但它仅对 auth/console/storefront 检查任一 test script及 source 下任意 `.test/.spec` 文件；Miniapp 只检查 `miniprogram/app.js` 存在；设计包只检查一个 state-matrix 文件。它不执行测试、未将六个客户端逐项枚举，也不验证路由或行为。预期是报告准确标为拓扑检查，并由独立执行型 suites 证明关键客户端行为。 |
| 直接证据 | [FACT][E-AU-799-005] 2026-09-15 运行 checker exit 0，输出 `commerce=4 mvp=21 providers=11 clients=6 productionTestingImports=0`；[FACT][E-AU-799-006] 39-50 只枚举3个 Web app，55 仅检查 Miniapp entry，56-60 只检查 design state strings；[FACT][E-AU-799-007] 无 test runner invocation，88-101 仅递归读取文件。 |
| 调用链或运行入口 | `npm run check:tests` → `audit:architecture` / `quality:canonical-hard-cut`。 |
| 用户影响 | 质量门“通过”可能被误读为六个客户端已完成行为测试，实际只证明少量文件/脚本存在。 |
| 数据影响 | 无直接数据写入；测试本身对数据库、并发和回滚没有执行性证明。 |
| 安全影响 | 没有验证真实会话、权限、页面拒绝态或 Miniapp 运行链；不构成已证实的权限缺陷。 |
| 根因 | 将测试目录完整性、需求数量与执行结果合并为单个 topology gate，并以汇总常量表达范围。 |
| 建议方向 | 从修复时最新 `zdt-next` 单独建立 test-evidence-labeling 批次：将输出明确标为 structural topology，按实际枚举项报告；保持快速门，并为每个高风险客户端链路接入已存在或新增的定向可执行 suite。 |
| 预计修改范围 | checker 输出/断言、CI quality report及少量针对 Miniapp/关键路由的测试入口；不修改业务功能。 |
| 验证方式 | 移除 Miniapp可执行测试或关键 Web test时对应执行门必须失败；保留空 test 文件时质量报告不得宣称行为已验证；报告枚举与实际受检 app一致。 |
| 回滚方式 | 回退该独立 checker/report/test-entry 批次，现有结构检查保持可用。 |
| 是否需要独立复核 | 是。 |

## F-0314｜MockPool 编译器接受空货盘并把非有限价格摘要静默投影为 null

| 字段 | 记录 |
| --- | --- |
| 模块 | Tooling / simulated catalog compiler |
| 类型 | 数据质量、输入边界、测试覆盖 |
| 严重级别 | **P3** |
| 置信度 | 高（纯函数源代码与JSON语义直接证据；CLI写入和下游导入未执行） |
| 文件和精确位置 | `04_tools/scripts/catalog/compile-mockpool-catalog.mjs:23-104,142-155`；`...test.mjs:5-38`。 |
| 当前/预期 | `items: []` 通过入口校验，errors为空、validation为`passed`；minimum/maximum price由空数组计算为Infinity/-Infinity，CLI JSON序列化后成为`null`。预期是空货盘被明确拒绝，或以明确的 empty/no-price 语义输出且不得声称验证通过。 |
| 直接证据 | [FACT][E-AU-802-001] 23-25只验证items为数组；84将errors为空映射passed；100-101对`source.items`直接使用`Math.min/Math.max`；151-154将document/preview JSON写入；[FACT][E-AU-802-002] 唯一test仅构造100个有效item并通过，未覆盖空集/无效/重复。 |
| 调用链或运行入口 | 人工 `node compile-mockpool-catalog.mjs INPUT OUTPUT PREVIEW` → JSON package/preview；无根 package 或 workflow 自动注册。 |
| 用户/数据/安全影响 | 模拟货盘或验收制品可被误标为通过而无可用价格范围，后续人工导入/展示可能处理null摘要；没有本次证据表明其会影响线上真实商品、资金或权限。 |
| 根因 | 将“数组类型有效”与“至少一条可编译商品”的业务前置条件分离，且摘要对空集合没有定义。 |
| 建议方向 | 从修复时最新`zdt-next`建立单一 mockpool-empty-input batch：明确拒绝空items或定义非通过empty状态；补空集、重复SKU、无效金额、所有invalid item及摘要JSON schema测试。 |
| 预计修改范围 | 编译器验证、测试fixtures和输出schema说明；不改真实catalog业务或数据。 |
| 验证方式 | 空items必须抛出稳定错误或输出明确非passed状态且无非有限值；现有100行fixture序列化结果保持确定；无效/重复条目错误可定位。 |
| 回滚方式 | 回退独立compiler/test提交；不存在本审计产生的制品需要清理。 |
| 是否需要独立复核 | 否。 |

## F-0315｜Console 性能脚本在候选制品初始化失败时可能遗留 baseline 本地监听器

| 字段 | 记录 |
| --- | --- |
| 模块 | Tooling / Console performance benchmark |
| 类型 | 本地资源清理、性能证据边界 |
| 严重级别 | **P3** |
| 置信度 | 高（控制流直接证据；未启动server/browser） |
| 文件和精确位置 | `04_tools/scripts/perf/console-cold-start.mjs:24-49,52-70,292-366,526-538`。 |
| 当前/预期 | baseline/candidate `target()` 在try前按序执行；baseline的`serve()`已绑定127.0.0.1随机端口后，candidate的artifact读取/serve失败会跳过49行finally。预期是每个已启动server无论后续target初始化或测量如何失败均被关闭。 |
| 直接证据 | [FACT][E-AU-807-001] 24-27在try前await target；52-70 target内先read artifact再serve；526-538只在已进入try后关闭targets server。 |
| 调用链或运行入口 | 人工 Node CLI + baseline/candidate Console dist → local HTTP/Chromium/mock API → optional JSON/profile。 |
| 用户/数据/安全影响 | 仅本机性能运行失败时可能遗留loopback listener；不直接影响线上。合成Owner API不能证明真实登录、授权或后端性能。 |
| 建议方向 | 从最新主线单独修复：以资源栈/outer finally保护增量启动的server，并加candidate init failure fixture；性能报告显式标为synthetic API benchmark。 |
| 验证/回滚 | 构造合法baseline+无效candidate，断言端口关闭；回滚为独立工具/test提交。 |
| 是否需要独立复核 | 否。 |

## F-0316｜Requirement Workbook 读取器对压缩包没有资源上限

| 字段 | 记录 |
| --- | --- |
| 模块 | Tooling / requirement authority workbook reader |
| 类型 | 生成期资源限制、输入健壮性 |
| 严重级别 | **P3** |
| 置信度 | 高（直接源码证据；未构造大工作簿或运行生成器） |
| 文件和精确位置 | `04_tools/tools/requirementgen/src/WorkbookReader.ts:11-27`；`Authority.ts:18-32`。 |
| 当前/预期 | Workbook构造器无条件`unzipSync(bytes)`并保存完整archive；没有压缩字节、条目数、单条/总解压字节限制。预期是权威工作簿在解压前/中受可审计的大小和条目上限约束。 |
| 直接证据 | [FACT][E-AU-816-001] 11-27直接同步解压后读取sharedStrings/workbook relationships；无limit参数或archive size检查；[FACT][E-AU-816-002] Authority loader先验证仓内realpath与SHA-256，输入不是外部HTTP/upload但可随受审提交变化。 |
| 调用链或运行入口 | authority XLSX → RequirementGenerator/OrderRequirementProfile → `check:requirements`/generation。 |
| 用户/数据/安全影响 | 不影响运行用户数据或权限；异常大或高膨胀率的已提交工作簿可能耗尽本地/CI生成进程内存，阻断质量门。 |
| 建议方向 | 从最新主线独立建立 workbook-resource-limits batch：在读取前限制压缩大小，在archive解析后限制entries/总/单条展开字节，并为正常权威文件、过大与多条目反例加测试。 |
| 验证/回滚 | 正常workbook保持相同sheet/cell结果；超限archive稳定拒绝且不耗尽内存；回滚为独立reader/test提交。 |
| 是否需要独立复核 | 否。 |

## F-0317｜RequirementTrace 以关键词和模块首个 API 生成需求链路，不能证明具体契约绑定

| 字段 | 记录 |
| --- | --- |
| 模块 | Tooling / requirement trace generation |
| 类型 | 需求追踪精度、架构证据语义 |
| 严重级别 | **P2** |
| 置信度 | 高（静态映射算法及generator caller直接证据；未生成制品） |
| 文件和精确位置 | `04_tools/tools/requirementgen/src/RequirementTrace.ts:41-131`；`RequirementGenerator.ts:38-43,65-85`。 |
| 当前/预期 | module为固定中文正则的首个命中；operation只从同owner候选中按GET/非GET返回首项；route/journey是静态模块表。预期需求追踪应保留“推断”状态或由requirements显式声明并验证具体operation、route与test，而非把同模块第一个API当作语义对应。 |
| 直接证据 | [FACT][E-AU-818-001] `moduleFor` 41-66按顺序first-match；[FACT][E-AU-818-002] `operationFor` 70-77不比较operation名称、字段或业务语义；[FACT][E-AU-818-003] route/journey 79-122为固定表；[FACT][E-AU-818-004] generator把trace写入每项，但同时将status固定为Designed。 |
| 调用链或运行入口 | Authority workbook → RequirementGenerator → generated requirement documents/check:requirements。 |
| 用户/数据/安全影响 | 不改变线上请求、数据或授权；可能使需求排期、覆盖报告或后续实现错误地关联到同模块但不相等的 API/页面/旅程。 |
| 建议方向 | 从最新主线单独建立 requirement-trace-evidence batch：为每条需求保存显式operation/route/test reference或标记inferred；对推断结果与真实注册表/route/test独立验证，禁止将推断升格为accepted/released证据。 |
| 验证/回滚 | 对同模块多GET/多command反例，未明确绑定时输出inferred/missing；显式绑定必须解析到真实route、operation和test；回滚为独立生成器/schema/test提交。 |
| 是否需要独立复核 | 是。 |

## F-0318｜P0 静态门禁把已批准的跨源方案预览资产误判为生产替代实现

| 字段 | 记录 |
| --- | --- |
| 模块 | Quality gate / Console solution preview |
| 类型 | 发布质量门禁、静态分类冲突 |
| 严重级别 | **P2** |
| 置信度 | 高（正式命令运行结果与源码/批准清单交叉证据） |
| 文件和精确位置 | `04_tools/scripts/verify-p0.mjs:58-61`；`04_tools/scripts/check/source.mjs:11-17,54-60`；`01_core_hexin/apps/console/src/feature/application/CommerceSolutionCenter.tsx:38-47,196-255`；`01_core_hexin/apps/console/public/demo/variants.js:1-116`。 |
| 当前行为 | `npm run check:p0` 扫描所有 production source，只因路径段含 `demo` 即在 `console/public/demo/variants.js` 抛 `P0_PRODUCTION_SUBSTITUTE`。同一资产被 Console 的暖筑工坊跨源预览使用，且 `owner-approved-ui.json` 固定了四个 demo 文件哈希；`check:frontend` 又把其 CSS 作为已知债务处理。 |
| 预期行为 | P0 门禁应拒绝会替代真实生产能力的模拟代码，但应能区分无 API/无写入的受批准视觉预览、测试夹具和真实业务替代；门禁必须在固定基线可通过，或输出可判读的受批准豁免。 |
| 直接证据 | [FACT][E-AU-826-001] 正式 `check:p0` 在该文件稳定退出 1；[FACT][E-AU-826-002] `variants.js` 只操作 DOM/localStorage/toast，未见 API、支付、身份或数据写入；[FACT][E-AU-826-003] Solution Center 在生产未配置独立 `VITE_ZHUDIAN_SOLUTION_ORIGIN` 时拒绝同源加载；[FACT][E-AU-826-004] owner-approved UI 清单记录 demo 四文件 SHA；[FACT][E-AU-826-005] `check:frontend` 将 variants.css 列为 known debt，但其自身另有 13 个未登记 CSS token 回归，未在本单元扩展审阅。 |
| 调用链或运行入口 | Console ApplicationRoute → CommerceSolutionCenter → 配置的独立 preview origin `/demo/index.html` → `variants.html` → `variants.js`；`npm run check:p0` 为根质量门禁。 |
| 用户影响 | 当前正式 P0 检查不能作为基线发布判据，会在无真实 P0 的情况下阻塞提交/候选制品验证；视觉预览仍明确不写商城。 |
| 数据影响 | 无直接数据写入证据。 |
| 安全影响 | 无已证实线上 P0；预览 iframe 限制为显式非同源 origin 且带 sandbox/referrer policy，但分类门禁失效降低了对真实模拟替代的信噪比。 |
| 根因 | `productionSources()` 将 app `public/demo` 作为生产源码收集，而 verify-p0 只按路径正则分类，未读取批准来源、实际调用能力或预览隔离语义。 |
| 建议方向 | 从最新主线建立单独 `p0-gate-preview-classification` 批次：定义经过批准且无网络/写入的预览资产例外，或将其移到清晰的 preview 供应域；保留对真实 API/数据替代的语义检测，不能仅把目录名加入忽略列表。 |
| 预计修改范围 | `verify-p0`/source 分类、owner-approved UI 契约及定向 fixture；不改业务预览行为。 |
| 验证方式 | 合规 preview 可通过 P0 gate；在允许路径下注入 fetch、真实业务 endpoint 或写入行为仍必须被拒绝；独立 preview origin 缺失/同源仍被 Console 拒绝。 |
| 回滚方式 | 回退独立 gate/fixture/批准契约提交；不影响生产数据或部署。 |
| 是否需要独立复核 | 是（P0 门禁语义）。 |

## F-0319｜Storefront 资产池允许输入根与对象池重叠，可能把自身管理文件并入发布资产

| 字段 | 记录 |
| --- | --- |
| 模块 | Release / Storefront asset pool |
| 类型 | 发布制品边界、文件系统完整性 |
| 严重级别 | **P2** |
| 置信度 | 高（输入校验、写入顺序和未覆盖反例的直接源码证据；未在仓库或制品目录执行破坏性复现） |
| 文件和精确位置 | `04_tools/scripts/release/storefront-assets.mjs:9-58,116-143`；`03_quality_ceshi/tests/recovery/storefront-assets.spec.ts:10-94`。 |
| 当前/预期 | pool 和每个 asset root 只要求是绝对非根目录，未要求彼此不重叠。函数在遍历 asset roots 前已经创建 `pool/objects` 与 `.merge.lock`，因此若 root 等于或包含 pool，就会把锁、objects 或 manifest 当作资产，并在后续硬链接回写阶段作用于同一树。预期应拒绝 pool 与任何输入 root 的相等/祖先/后代关系。 |
| 直接证据 | [FACT][E-AU-827-001] `absoluteDirectory` 仅验证绝对路径和非 `/`；[FACT][E-AU-827-002] 16-20先创建 objects/lock，28-43再递归收集所有常规文件；[FACT][E-AU-827-003] 116-143没有排除 pool 管理路径；[FACT][E-AU-827-004] 现有恢复测试只使用互不重叠的临时 pool/release A/release B，未覆盖相等、嵌套或同路径反例。 |
| 调用链或运行入口 | 人工/外部发布编排 → `mergeStorefrontAssetPool` → pool objects/manifest 与 release asset roots；仓内仅找到 recovery test 静态导入。 |
| 用户影响 | 错误发布参数可能污染或破坏 asset pool/当前 release 文件，导致旧新页面在切换或回滚时取不到内容哈希资产。 |
| 数据影响 | 不触及业务数据库；影响发布制品文件完整性。 |
| 安全影响 | 未发现外部输入直接到达该函数；风险取决于发布操作者或编排参数。 |
| 根因 | 输入路径验证只处理单路径合法性，没有把 pool 与 asset roots 作为一个拓扑约束验证。 |
| 建议方向 | 从最新主线建立独立 asset-pool-topology batch：realpath 后拒绝相等及任一方为另一方祖先的路径；在创建 lock/object 前完成验证，并增加相等/嵌套/symlink 反例及无残留断言。 |
| 预计修改范围 | asset pool 工具与 recovery test；可能补充发布编排的参数校验。 |
| 验证方式 | 合法的两个不重叠 release roots 保持硬链接/回滚行为；pool=root、pool 在 root 下、root 在 pool 下均稳定拒绝且不创建/修改文件。 |
| 回滚方式 | 回退独立工具/test/编排参数提交；已生成 pool 需按发布制品恢复流程重新生成，不在此审计分支操作。 |
| 是否需要独立复核 | 是（GX 发布制品写入边界）。 |

## F-0320｜顶层文档入口与当前运行/交付控制面漂移

| 字段 | 记录 |
| --- | --- |
| 模块 | Documentation / architecture and release operations |
| 类型 | 文档准确性、发布控制面 |
| 严重级别 | **P2** |
| 置信度 | 高（文档文本、文件存在性与当前 release adapter 直接证据） |
| 文件和精确位置 | `05_docs_ziliao/docs_wendang/README.md:8-25`；`ARCHITECTURE.md:5-25`；`ALIYUN-OSS-CDN-SHARED-MEDIA.md:3-12`；`04_tools/release-engine/adapters/zdt-next/service-targets.mjs:1-10`。 |
| 当前/预期 | README 指向不存在的 `zdt.md` 与根目录 `ZHU-VI-1.3/`，而当前 VI 正式入口是 `VI_shijue/current/ZHU-VI-1.5/`。ARCHITECTURE 将生产描述为一个 Commerce ApiMain/JobsMain 制品，adapter 实际列出 identity、mall provisioning、purchase、web、catalog、jobs、webhook 等独立 targets。OSS/CDN 文档将 `infrastructure/aliyun/deploy.sh` 表述为生产发布入口；当前受控交付操作只允许通过 `zdt-delivery prepare/deploy`。预期文档应明确历史/设计态与当前事实，并只引用允许的交付控制面。 |
| 直接证据 | [FACT][E-AU-828-001] `zdt.md`、根目录 `ZHU-VI-1.3` 均不存在；[FACT][E-AU-828-002] Auth Web 直接导入 VI 1.5 current assets（AU-822）；[FACT][E-AU-828-003] service-target adapter 列出 7 类独立运行 target；[FACT][E-AU-828-004] OSS 文档要求 `deploy.sh`，与本审计所适用的受控交付接口不一致。 |
| 调用链或运行入口 | 人工架构理解/发布操作 → 顶层文档；实际运行/发布真值 → release-engine adapter 与受控 delivery control plane。 |
| 用户影响 | 维护者可能依旧架构图估计部署边界或按旧脚本尝试生产交付，造成错误操作、错误回滚假设或审计结论漂移。 |
| 数据影响 | 没有文档被自动执行的证据；错误操作指引可能间接影响发布制品与服务可用性。 |
| 安全影响 | 旧部署路径可能绕开当前控制面约束；未证实已发生绕过。 |
| 根因 | 顶层文档未被纳入与运行/发布配置同一变更契约，历史设计与当前控制面并存但没有状态标记。 |
| 建议方向 | 从最新主线建立独立 documentation-control-plane batch：校正/移除不存在入口，明确 VI 1.5 正式来源，为历史架构加状态；从实际 service-target/受控交付命令生成或链接运行与发布说明，禁止旧脚本作为操作指南。 |
| 预计修改范围 | 三份顶层文档及可能的文档链接/自动一致性检查；不改任何运行配置或发布脚本。 |
| 验证方式 | 文档所有本仓路径存在；运行单元与 adapter inventory 对齐；文档不再指示旧部署入口；历史说明有清晰状态。 |
| 回滚方式 | 回退独立文档/校验提交；不涉及制品、代码或线上状态。 |
| 是否需要独立复核 | 是（生产交付说明）。 |

## F-0321｜身份安全实施说明把 demo 认证环境和迁移定位写成过期/不完整事实

| 字段 | 记录 |
| --- | --- |
| 模块 | Documentation / identity security |
| 类型 | 身份运行说明、文档漂移 |
| 严重级别 | **P3** |
| 置信度 | 高（文档与环境门禁/文件路径直接比对） |
| 文件和精确位置 | `05_docs_ziliao/docs_wendang/07-ACCOUNT-SECURITY-CENTER-IMPLEMENTATION.md:9-11,39`；`08-USERNAME-PASSWORD-REGISTRATION.md:39`；`09-MEMBER-IDENTITY-ASSURANCE.md:43`；`01_core_hexin/services/commerce-api/src/api/demoAuth.ts:20-22`。 |
| 当前/预期 | 安全中心说明称测试用户名只在 `APP_ENV=test` 且 `AUTH_MODE=test` 可用，但真实 `isDemoAuthEnabled` 同时允许匹配的 development 环境。三份说明还把 migration 写成 `database/supabase/...`，其从文档所在目录不可解析；真实仓内路径前缀为 `02_platform_pingtai/`。预期应准确标记开发/test demo 范围，并提供仓库可解析的迁移位置或明确这是逻辑路径。 |
| 直接证据 | [FACT][E-AU-829-001] demo 开关源码为 development/development 或 test/test；[FACT][E-AU-829-002] PBKDF2、用户名注册默认关闭、phone assurance migration 与三份文档的核心安全陈述相符；[FACT][E-AU-829-003] 三个对应迁移均存在于 `02_platform_pingtai/database/supabase/migrations/`。 |
| 调用链或运行入口 | 人工安全配置/上线判断 → 实施说明；实际认证行为 → public/registration routes → demo auth、registered credential 与数据库 assurance。 |
| 用户影响 | 开发人员可能误判 demo 认证在 development 的可用性，或无法从文档定位迁移；未见生产环境 demo 放行证据。 |
| 数据影响 | 无。 |
| 安全影响 | 文档误导降低环境审查清晰度；生产路径仍由 `isDemoAuthEnabled` 环境合取拒绝。 |
| 根因 | 实施快照未和环境 gate/仓库目录迁移保持同一文档契约。 |
| 建议方向 | 从最新主线建立 identity-doc-accuracy batch：更正 demo 环境条件、使用完整仓库路径或相对链接，并将历史测试数字标明日期/快照。 |
| 预计修改范围 | 三份文档，必要时加入文档路径存在性检查；不改认证代码、数据库或环境配置。 |
| 验证方式 | 文档中所有迁移路径可解析；development/test/production 的 demo 开关描述与单元测试一致。 |
| 回滚方式 | 回退独立文档/校验提交。 |
| 是否需要独立复核 | 否。 |

## F-0302｜MVP 交付门禁的状态枚举与当前需求矩阵不兼容，首条即失败

| 字段 | 记录 |
| --- | --- |
| 模块 | Release / MVP delivery evidence |
| 类型 | 发布可验证性、需求契约漂移 |
| 严重级别 | **P2** |
| 置信度 | 高（状态枚举、矩阵值与运行输出直接证据） |
| 文件和精确位置 | `04_tools/scripts/check-platform-delivery.mjs:9-23`；`05_docs_ziliao/docs_wendang/requirements/mvp.yml:6,143`。 |
| 当前/预期 | checker 只准 `Implemented/Integrated/Accepted/Released`，MVP03 及当前矩阵条目为 `Designed`，因此在首条抛 `MVP_STATUS_INVALID:MVP03`，后续路线、模块、表与证据检查不执行。预期是状态语义与需求矩阵版本一致，或非完成状态被明确地作为不发布结果处理而非执行错误。 |
| 直接证据 | [FACT][E-AU-783-003] 正式定向执行在 MVP03 失败；[FACT][E-AU-783-004] 21条 status 字段为 `Designed`。 |
| 调用链或运行入口 | `npm run check:delivery` → MVP matrix/evidence/artifact static validation。 |
| 用户影响 | 不直接改变上线流量；无法从该门禁证明 MVP 交付证据是否齐全或状态是否允许发布。 |
| 数据影响 | 无。 |
| 安全影响 | 无直接证据。 |
| 根因 | checker将完成态作为唯一合法枚举，而需求矩阵仍以设计态作为当前基线。 |
| 建议方向 | 从最新主线拆出 delivery-status-contract 批次，先确定状态机与“不可发布”的正常输出语义，再检查每条 evidence，不要仅把 `Designed` 批量替换为完成态。 |
| 预计修改范围 | MVP schema/checker、定向 fixture；可能需要经过产品/发布负责人确认。 |
| 验证方式 | 对 Designed、Implemented、Released 和未知值分别有稳定预期；完成态才验证发布证据，非完成态应给可判读的阻断结果。 |
| 回滚方式 | 回退独立 checker/fixture 提交。 |
| 是否需要独立复核 | 是（发布契约）。 |

## F-0307｜Mall provisioning 部署门禁要求历史三参数 listen 文本，合法 node context 接线被误判

| 字段 | 记录 |
| --- | --- |
| 模块 | Mall provisioning release contract |
| 类型 | 发布可验证性、静态门禁脆弱性 |
| 严重级别 | **P2** |
| 置信度 | 高（checker expectation、实际 entry call 和运行输出直接证据） |
| 文件和精确位置 | `04_tools/scripts/check/mall-provisioning-deployment.mjs:27-35`；`01_core_hexin/services/commerce/src/entry/MallProvisioningApiMain.ts:16-29`。 |
| 当前/预期 | checker要求精确三参数 `listen(bootstrapped.app, mallProvisioningApiPort(environment), '127.0.0.1')`；实际调用保留同一前三参数并追加 `bootstrapped.nodeContextResolver`。固定基线在第一条 entry token失败，之后所有 module/runtime/systemd/Caddy/migration assertions被短路。预期应验证 loopback bind、selected operations和 node context resolver是否合规，而不锁死参数数目。 |
| 直接证据 | [FACT][E-AU-793-001] 定向命令报缺失三参数 literal；[FACT][E-AU-793-002] 当前 entry第25行仍使用 provisioning app/port/127.0.0.1，第四参数为 node context resolver。 |
| 调用链或运行入口 | MallProvisioningApiMain → bootstrapApi → NodeServer.listen；静态 checker交叉读取部署声明。 |
| 用户影响 | 不直接证明 provisioning运行失败；当前门禁不能证明其它角色/路由/迁移声明仍满足契约。 |
| 数据影响 | 未执行创建 Mall 或数据库写入。 |
| 安全影响 | node context resolver是边界增强，但文本门禁无法区分增强与危险 bind/route 回归。 |
| 根因 | 实现新增 node context 后历史 substring assertion没有迁移到结构/行为契约。 |
| 建议方向 | 从最新主线建立 provisioning-deployment-contract 批次，改用可验证的 call structure/导出配置并覆盖正确 loopback+resolver、错误 bind、漏 resolver、operation混入的反事实。 |
| 预计修改范围 | 单一 checker及定向 fixture；不改 provisioning代码、迁移、systemd或部署。 |
| 验证方式 | 当前合法四参数 call通过；0.0.0.0、缺 resolver、错误端口/operation必须失败；再运行既有 role/Caddy/checksum checks。 |
| 回滚方式 | 回退独立 checker/fixture 提交。 |
| 是否需要独立复核 | 是（provisioning发布边界）。 |

## F-0303｜分页门禁的 pricing 豁免仍指向旧路径，固定上限列表被误报为无 cursor 分页

| 字段 | 记录 |
| --- | --- |
| 模块 | Quality / pagination boundary |
| 类型 | 正确性、门禁可信度 |
| 严重级别 | **P2** |
| 置信度 | 高（硬编码路径、真实实现路径、查询界限和运行输出直接证据） |
| 文件和精确位置 | `04_tools/scripts/check/pagination.mjs:14-24`；`modules/pricing/03_application_yingyong/PricingOperations.ts:13-21,41-45`；`modules/webbusiness/WebPricingOperations.ts:12-20,25-29`；`modules/identity/05_interface_jieru/http/SessionTicketOperations.ts:337-345`。 |
| 当前/预期 | checker只豁免旧的 `modules/pricing/PricingOperations.ts` 转发路径，并要求其包含 SQL proof；真实 pricing 实现已迁入 `03_application_yingyong`，因此自有 `queryValues(...,100)` 与 `limit 100` 仍报 `PAGE_RESULT_WITHOUT_CURSOR` 和 `BOUNDED_BATCH_PROOF_MISSING`。预期是根据查询形态/明确注解而非脆弱文件路径判断有界查找与真正分页。 |
| 直接证据 | [FACT][E-AU-783-005] 固定基线输出4项失败；[FACT][E-AU-783-006] 真实 pricing query 同时限制输入100和 SQL `limit 100`，旧文件仅转发 export。 |
| 调用链或运行入口 | `npm run check:pagination` → Commerce `*Operations.ts` 文本扫描。 |
| 用户影响 | 门禁无法可靠阻止真实 offset/无界分页，且会把固定上限 session/SKU 查询混入失败结果；不直接证明现有查询错误。 |
| 数据影响 | 无写入。 |
| 安全影响 | 无直接证据。 |
| 根因 | 路径迁移后例外和 proof 规则未同步，文本启发式未表达“bounded lookup”语义。 |
| 建议方向 | 从最新主线建立 pagination-gate-contract 批次：由 shared query helper/显式 bounded annotation 描述例外，迁移 pricing 断言，并为 offset、无 cursor pageResult、有界 lookup 建最小反事实 fixture。 |
| 预计修改范围 | checker、定向 fixture，可能加共享注解；不改业务 SQL。 |
| 验证方式 | 当前三类有界查询不再误报；插入 offset 或无 bound/page cursor 的真实分页必须失败。 |
| 回滚方式 | 回退独立 checker/test 提交。 |
| 是否需要独立复核 | 否。 |

## F-0308｜Registration bootstrap 部署门禁仍要求已移除的根 package 命令，关键边界验证被短路

| 字段 | 记录 |
| --- | --- |
| 模块 | Registration bootstrap / release contract |
| 类型 | 发布可验证性、one-shot 运维契约漂移 |
| 严重级别 | **P2** |
| 置信度 | 高（checker expectation、package script 缺失、build/delivery 声明和运行输出直接证据） |
| 文件和精确位置 | `04_tools/scripts/check/registration-deployment.mjs:52-57`；`package.json` scripts；`04_tools/scripts/build-commerce.mjs:12`；`02_platform_pingtai/infrastructure/zhudatuan/aliyun/delivery.yml:29`。 |
| 当前/预期 | checker强制根脚本等于 `node .../BootstrapRegistration.js`；当前 package scripts中不存在该 key，但 build map与delivery one-shot仍声明同一 artifact。固定基线抛 `REGISTRATION_BOOTSTRAP_PRODUCTION_COMMAND_INVALID`，之后 service/RDS init/reconciliation/migration checks全未执行。预期应明确 production启动权威是systemd/delivery还是开发者 package command，并按当前控制面验证。 |
| 直接证据 | [FACT][E-AU-795-001] 定向命令在56行失败；[FACT][E-AU-795-002] package script查询返回missing，build map与delivery分别仍列出 BootstrapRegistration artifact。 |
| 调用链或运行入口 | registration bootstrap delivery one-shot → systemd `zhudatuan-registration-bootstrap.service` → built BootstrapRegistration；checker试图额外把根 package script作为一致性证据。 |
| 用户影响 | 团队无法依赖当前 checker证明 registration bootstrap 的最小权限/RDS boundary/migration target仍完整；未证明实际 bootstrap不可用。 |
| 数据影响 | 本批未执行数据库脚本；若维护者绕过失效门禁，registration boundary 配置漂移更难在发布前发现。 |
| 安全影响 | 独立 registration DB、sentinel、definer ACL和最小 role 是高敏感边界；当前自动静态证明被阻断，但没有越权或凭据泄露证据。 |
| 根因 | 根开发者命令被移除或重命名后，checker仍把它当作生产控制面真值，未以 delivery/systemd作为主入口。 |
| 建议方向 | 从最新主线建立 registration-bootstrap-contract 批次，先确认正式 one-shot 权威入口；若 package script不再需要，移除该断言并以 delivery/systemd验证替代；若仍需要，恢复受控 wrapper并明确只可在隔离流程调用。不要在审计分支执行或修改 bootstrap。 |
| 预计修改范围 | checker、package/delivery contract tests或文档；不改 registration SQL/业务逻辑。 |
| 验证方式 | current approved one-shot path通过全部静态边界验证；无授权本地命令不能绕过; RDS init/ACL/migration target的反事实必须失败。 |
| 回滚方式 | 回退独立 checker/contract提交。 |
| 是否需要独立复核 | 是（registration数据库边界）。 |

## F-0293｜Internal Mall 导入模式缺少目标数据库与本机边界

| 字段 | 记录 |
| --- | --- |
| 模块 | test data / Internal Mall dataset import |
| 类型 | 数据安全、写入目标约束 |
| 严重级别 | **P2** |
| 置信度 | 高（导入 parser、连接 guard、写入入口和使用文档均为直接证据；实际误导入未验证） |
| 文件和精确位置 | `04_tools/tools/seed/src/InternalMallDatabase.ts:19-47,92-106`；`ImportInternalMallDataset.ts:11-34`；`05_docs_ziliao/docs_wendang/testdata/InternalMallDataset.md:41-55,71-86`。 |
| 当前/预期 | 常规 dataset mode强制 local host、`zhudatuan_internal_` DB 名与非 ITHT 订单为空；import mode只要求 `--database`，允许任意 `--host`/port，`assertImportDatabase`仅验证连接后的库名等于请求参数、schema 存在且已有 migration。随后同一 transaction 写入 core、commerce、reporting synthetic records。预期是 import mode也只允许受命名/环境/host/credential保护的明确测试目标，并在写入前拒绝已有非数据集业务数据。 |
| 直接证据 | [FACT][E-AU-720-001] parser 19-20为 import 传入 `localOnly=false`，36-45因此跳过 prefix/localhost checks；[FACT][E-AU-720-002] import guard 105-106不检查 host、database prefix或 foreign rows；[FACT][E-AU-720-003] import 27-30调用三个 writer；[FACT][E-AU-720-004] 文档所有示例均是专用 `zhudatuan_internal_hongtai_...` 测试库。 |
| 调用链或运行入口 | `npm run dataset:import:test -- --database … [--host …]` → `ImportInternalMallDataset` → `parseImportOptions`/`connectInternalDatabase`/`assertImportDatabase` → core/commerce/reporting writes。 |
| 用户影响 | 拥有可写 PostgreSQL 凭据的操作者若填错目标参数，可能向正常环境写入大量 synthetic organization/member/product/order/payment/reporting 行；实际连接权限与历史发生情况未验证。 |
| 数据影响 | 写入数量大、跨多个业务 schema；外层 transaction 可回滚运行时失败，但成功 commit 后只能走受控 cleanup/数据修复，不能当作普通临时文件删除。 |
| 安全影响 | 不是外部未授权访问；是受信任运维/开发凭据下缺少目标环境 defense-in-depth。 |
| 根因 | import 用途绕过 local-only guard，但未以独立 allowlist、sentinel、专用 role或 foreign-data preflight替代。 |
| 建议方向 | 从当时最新主线建立单一 dataset-import guard 批次：明确允许的 test DB identity/host/role/sentinel，保留显式受控的非本机测试用途；在 transaction 前拒绝非 ITHT data。不得修改历史 dataset 或在审计分支执行 cleanup。 |
| 预计修改范围 | `InternalMallDatabase` import parser/assertion、命令文档和针对 local/approved remote/production-like target 的单元或隔离 PostgreSQL contract。 |
| 验证方式 | 隔离 PostgreSQL覆盖 local专用库成功、approved remote test target成功、普通库名/host、production-like schema、非 ITHT rows、缺 sentinel、错误 role均拒绝；断言所有拒绝路径零写入。 |
| 回滚方式 | 回退独立 import guard 提交；若发现历史误导入，先按 `itht:` 范围、外键依赖和真实业务引用制定专项数据修复。 |
| 是否需要独立复核 | 否。 |

## F-0292｜本地基础设施验证持续写入对象但不清理

| 字段 | 记录 |
| --- | --- |
| 模块 | localinfra / 本地 object-store 验证 |
| 类型 | 本地资源保留、可维护性 |
| 严重级别 | **P3** |
| 置信度 | 高（正式入口与写入/完成/read 链均为直接代码证据） |
| 文件和精确位置 | `package.json:23`；`04_tools/tools/localinfra/src/Verify.ts:22-39`。 |
| 当前/预期 | `local:verify-services` 创建 UUID 路径的 upload、写入 bytes、完成对象并回读；成功后直接退出，没有删除、TTL、mark-and-sweep 或输出可清理 reference。预期是验证产生的临时对象可在同次运行清理，或使用明确的本地生命周期前缀/保留策略。 |
| 直接证据 | [FACT][E-AU-719-001] root script直接执行 `Verify.ts`；[FACT][E-AU-719-002] 23-38创建随机路径、完成对象且只读回；文件剩余逻辑仅输出成功并定义 HTTP helper，无 cleanup 调用。 |
| 调用链或运行入口 | `npm run local:verify-services` → `Launch.mjs` → `Verify.ts` → local object service upload/part/completion/object read。 |
| 用户影响 | 长期反复本地验证会在开发者 object directory 留下无业务价值的对象，增加磁盘/排查噪声；未验证实际累积量。 |
| 数据影响 | 仅本地开发 object store；不涉及生产数据。 |
| 安全影响 | 无直接安全影响。 |
| 根因 | 验证把 roundtrip 成功作为终点，未把测试 artifact 生命周期纳入命令契约。 |
| 建议方向 | 后续独立 localinfra 小批次选择已完成对象的受控删除，或为 `verification/` 前缀定义仅限本地的可验证 TTL/清扫；不要将清扫逻辑复用到业务对象。 |
| 预计修改范围 | `Verify.ts`、必要的 localobjects deletion/retention contract 与定向测试。 |
| 验证方式 | 临时本地 object store中重复运行验证，断言成功/失败两条路径均不遗留 UUID artifact，且正常业务对象不受影响。 |
| 回滚方式 | 回退独立 localinfra 改动；现有 local verification objects 可按新的受控筛选规则删除，不得批量触碰业务前缀。 |
| 是否需要独立复核 | 否。 |

## F-0276｜Disabled Realm 重供给删除 target 被历史身份引用外键阻断

| 字段 | 记录 |
| --- | --- |
| 模块 | Autonomous node Identity Realm recovery |
| 类型 | 数据完整性、恢复/回滚路径 |
| 严重级别 | **P2** |
| 置信度 | 高 |
| 文件和精确位置 | `02_platform_pingtai/database/supabase/migrations/20260909062000_provision_autonode_identity_realm.sql:155-178`；`20260909063000_reprovision_disabled_autonode_identity_realm.sql:66-112`；`20260907122000_bind_sessions_tickets_to_realm_accounts.sql:48-49,66-71`；`20260908012000_create_sfl_login_intents.sql:42-44`。 |
| 当前行为 | disable 仅把 Realm、entry、nodeprovisioning status 置为 disabled。随后的 reconfiguration 对同一 Realm 先删除全部 `identity.realmtarget`，再按新 fact 插入。session 的 `(realm_id,auth_target)`、ticket 的 `(realm_id,target)`、login intent 的 `(target_realm_id,target_target)` 均为默认 non-cascade foreign key。 |
| 预期行为 | disabled Realm 应能在明确的会话/票据/intent 处置策略下重供给，或在尝试前以业务错误明确报告仍被引用；不得在不可恢复的 FK 失败后才暴露恢复失败。 |
| 直接证据 | [FACT][E-AU-673-001] reconfiguration lines 77-78 无条件 delete target/entry；[FACT][E-AU-673-002] 三组 foreign key 未声明 `ON DELETE CASCADE`/`SET NULL`；[FACT][E-AU-673-003] disable function未处理 identity.session、identity.authticket 或 identity.loginintent。 |
| 调用链或运行入口 | Provisioning API → `identity.disable_node_realm` → disabled ledger/Realm → Provisioning API → `identity.provision_node_realm(updated fact)` → delete realmtarget。 |
| 用户影响 | 需要修正 node entry/target 配置时，已禁用节点可能无法恢复上线，需人工数据库干预或等待/清理历史身份记录。 |
| 数据影响 | 恢复事务因 FK 失败回滚；不应部分删除，但会留下 disabled Realm 和旧 fact，阻塞后续供给。 |
| 安全影响 | 未发现越权；但临时为恢复而手动删除身份引用会增加误删会话审计/认证历史的风险。 |
| 根因 | Realm reconfiguration 视 entry/target 为可替换 projection，却没有把它们对 session/ticket/login intent 的历史引用纳入 disable/recovery 生命周期。 |
| 建议方向 | 从最新主线建立独立恢复设计批次：选择保留 stable target 行并更新允许字段，或在 disable 时用明确审计策略撤销/过期所有关联 session、ticket、intent 后再重供给；保持历史记录和 FK 合法性，不以盲目 cascade 删除替代。 |
| 预计修改范围 | autonomous Realm provision/disable function、必要的 session/ticket/intent lifecycle contract tests，可能涉及前向 schema migration。 |
| 验证方式 | 隔离数据库创建 Realm-bound session、ticket、intent 后 disable；验证更新 fact 的 reprovision 有定义结果，成功时引用保持合法/被审计性撤销，失败时返回领域错误且不产生部分写入。 |
| 回滚方式 | 回滚独立前向恢复逻辑或保留旧 target 行；不回滚/重写历史 AU-673 migration。 |
| 是否需要独立复核 | 是：需 Identity、Provisioning 与数据保留 owner 共同确认 session/ticket/intent 的处置语义。 |

## F-0258｜容量目录生成器未完整校验运行字段

| 字段 | 记录 |
| --- | --- |
| 模块 | 平台运行配置 / capacity catalog generator |
| 类型 | 配置验证、运行时可靠性 |
| 严重级别 | **P3** |
| 置信度 | 高 |
| 文件和精确位置 | `04_tools/scripts/build-runtime-config.mjs:29-58`；输入 `02_platform_pingtai/config/capacity.yml:3-59`。 |
| 当前/预期 | validator 仅要求 `model`/`provider`/`runtime.http` 为 object；external 只遍历已出现属性而不要求全部键；pool 只校验已出现 profile 的属性。预期为 schema 明确每个 required key、整数/范围与跨字段关系，然后才生成 Node/Miniapp runtime projection。 |
| 直接证据 | [FACT][E-AU-547-001] model/provider/http 没有字段级验证；[FACT][E-AU-547-002] external `Object.entries` 在空/缺键 object 时不会失败；[FACT][E-AU-547-003] generator 随后直接 JSON stringify 并在非-check 模式写入 `RuntimeCatalog.generated.ts` 与 Miniapp `RuntimeLimits.js`。 |
| 调用链或运行入口 | capacity YAML → build-runtime-config → generated RuntimeCatalog/Miniapp limits → NodeServer/API client/external executor/DB pool consumers。 |
| 用户/数据/安全影响 | 当前固定基线值未显示异常；未来遗漏、字符串或不合理值可能在生成阶段漏过，进入启动/请求路径时导致 timeout、限流、并发或连接池行为异常。被 TypeScript/具体 consumer 拦截的程度依字段而异，未验证线上配置变更流程。 |
| 根因 | generator 采用“对象存在 + 部分值遍历”的最小校验，而非 capacity catalog 的完整运行 schema。 |
| 建议方向 | 从最新主线建立独立配置质量批次：定义完整 schema（required keys、safe integer、合理上下限及 timeout ordering），加缺键/错型/负数/跨字段反事实 tests，并保持 `--check` 的纯校验行为。 |
| 验证/回滚 | 对每类必需字段删除、设为字符串/负数/非法顺序，确认 generator 拒绝；合法 catalog 仍生成相同投影。回滚为撤回该单一 schema/test 改动。 |
| 是否需要独立复核 | 否。 |

## F-0259｜正式供应链许可证门在当前 lockfile 上失败

| 字段 | 记录 |
| --- | --- |
| 模块 | 供应链质量门 / license policy |
| 类型 | 质量门可执行性、依赖合规治理 |
| 严重级别 | **P2** |
| 置信度 | 高（正式 script 已定向执行） |
| 文件和精确位置 | `02_platform_pingtai/config/licenses.yml:3-27`；`04_tools/scripts/check/supplychain.mjs:8-27`；root `package.json:94,123`。 |
| 当前/预期 | `npm run check:supplychain` 当前退出 1：`big-integer` Unlicense、`buffers`/`pause-stream` 缺 license、`chainsaw`/`traverse` MIT/X11、`jszip` MIT OR GPL-3.0-or-later、`pako` MIT AND Zlib；该 command 是 `quality:canonical-hard-cut` 的早期 gate。预期为正式质量门能针对经过法务确认的 lockfile 产生可执行、可解释的结论。 |
| 直接证据 | [FACT][E-AU-548-001] 2026-09-15 在固定审计分支执行正式 script，退出 1并报告 7 license finding、0 secret finding；[FACT][E-AU-548-002] parser 只接受 exact allow 或所有 AND/OR 分支均 allow，随后仍匹配 denied regexp；[FACT][E-AU-548-003] quality hard-cut 串联该 command。 |
| 调用链或运行入口 | package-lock → check:supplychain → quality:canonical-hard-cut / 可能的 release quality workflow。 |
| 用户/数据/安全影响 | 不直接改变线上功能、数据或权限；完整 canonical quality gate 在 supply-chain 阶段中断，依赖许可/notice 风险无法得到可通过的自动结论。是否有生产发布绕过/强制该 gate未验证。 |
| 根因 | 当前 allow/deny expression policy 与 lockfile 的 license 表达形式未对齐；部分缺失 metadata 也无审查/例外工作流。 |
| 建议方向 | 从最新主线建立独立供应链治理批次：逐依赖核对实际 license/SBOM、直接/传递用途、notice 与法务批准；只将已批准 expression/exception 以可审计方式纳入 policy，或替换不合规依赖。不得用盲目放宽 allow-list 使门变绿。 |
| 验证/回滚 | 在干净 lockfile 上运行 check；对已批准 OR/AND/别名、被拒 copyleft 与 missing metadata 各加入反事实 fixture，确认 approved pass、unapproved fail。回滚为撤回单一 policy/dependency/notice 批次。 |
| 是否需要独立复核 | 否；涉及实际法务接受时需法律/依赖所有者确认。 |

## F-0260｜hbbtzn L1 catalog API 环境模板与制品拓扑不一致

| 字段 | 记录 |
| --- | --- |
| 模块 | hbbtzn L1 node runtime / catalog API deployment |
| 类型 | 运行配置漂移、发布/启动边界 |
| 严重级别 | **P2** |
| 置信度 | 高 |
| 文件和精确位置 | `02_platform_pingtai/config/node-runtime/hbbtzn-l1/catalog-api.env.example:4-18`；`.../projects_xiangmu/hbbtzn/deployment/aliyun.yml:64-67`；`.../release/zdt-next.remote-policy.json:53,60-75`。 |
| 当前/预期 | template 指向 hbbtzn-l1 database/manifest/runtime/pointer；hbbtzn deployment 的 catalog responsibility 却是 `sfl-catalog-api@zhudatuan-l0.service`，remote policy 只为 zhudatuan-l0 定义 `catalog-api` target，hbbtzn-l1 target 集没有该制品。预期为 runtime template、artifact pointer、systemd instance 与实际 service ownership 选择同一节点，或明确 L1→L0 delegation。 |
| 直接证据 | [FACT][E-AU-550-001] template 使用 `/opt/sfl/nodes/hbbtzn-l1/...` 和 `hbbtzn/nodes/l1/database/catalog-api`；[FACT][E-AU-550-002] hbbtzn deployment 将 catalog API/JOBS 指向 zhudatuan-l0 services；[FACT][E-AU-550-003] remote policy 的 hbbtzn-l1 deployments 未含 catalog-api，而 L0 的 target 会 restart `sfl-catalog-api@zhudatuan-l0.service`。 |
| 调用链或运行入口 | hbbtzn L1 runtime env → generic `sfl-catalog-api@.service`；hbbtzn deployment/release policy → L0 catalog target/systemd。 |
| 用户/数据/安全影响 | 当前 hbbtzn project 标记 `releaseEligible:false`，没有线上事故证据；若后续直接按模板启用 L1，可能出现制品缺失/错误 runtime refs 或 catalog route 对错节点，导致商品管理 API 不可用或跨 node 配置混用。 |
| 根因 | L1 per-node template 保留了 catalog API ownership假设，但正式 deployment/release control-plane 已将该职责集中到 L0，未记录 delegation/退役关系。 |
| 建议方向 | 从最新主线建立独立 deployment-contract 批次，先确定 catalog 是否应当 L1 本地运行或 L0 共用；只保留对应的 env template、target、systemd/route，并加入 topology consistency gate。不得仅改文件名或删除模板。 |
| 验证/回滚 | 在隔离 host/fixture 检查 L1 activation：candidate artifact、runtime file、systemd ConditionPath、DB ref、route origin 应全部指向同一选择；验证 L0 delegation 时请求不得携带 L1 database role。回滚为撤回单一 topology 对齐提交。 |
| 是否需要独立复核 | 否；激活 hbbtzn 前需部署所有者复核。 |

## F-0261｜遥测 SLO 与脱敏政策多数没有运行消费者

| 字段 | 记录 |
| --- | --- |
| 模块 | 可靠性配置 / telemetry SLO and redaction policy |
| 类型 | 配置可信度、可观测性与敏感数据治理 |
| 严重级别 | **P3** |
| 置信度 | 高 |
| 文件和精确位置 | `02_platform_pingtai/config/telemetry.yml:4-20`；`03_quality_ceshi/tests/recovery/runbook.spec.ts:33-39`。 |
| 当前/预期 | latency/availability/outbox SLO 和 redaction deny list 在固定基线内仅出现于 YAML；唯一仓内 code consumer只用正则检查 `rpoMinutes: 5` 和 `rtoMinutes: 30`。预期为每个承诺的 SLO/deny key有 alert/metric/redactor consumer，或明确降为参考文档而不宣称运行政策。 |
| 直接证据 | [FACT][E-AU-563-001] key-level检索仅命中配置本身，rpo/rto另命中 recovery spec/backup YAML；[FACT][E-AU-563-002] recovery spec只对两项字面量断言；[FACT][E-AU-563-003] AU-013 已核验 `@shop/telemetry` Redactor 采用自身规则，未加载 YAML。 |
| 调用链或运行入口 | telemetry.yml → recovery documentation/spec；独立 `@shop/telemetry` redactor/logging path，并无该 YAML加载边。 |
| 用户/数据/安全影响 | 不会直接改动线上行为；性能/可用性目标可能没有自动告警或验证，配置列出的敏感字段也不会自动影响日志脱敏。F-0065 的实际 Redactor 漏脱敏风险不因本项而降级。 |
| 根因 | 运维/治理 YAML 与执行型 telemetry/alert/redaction 实现未共享 schema或生成/加载路径，测试只保持两个恢复数字的文字同步。 |
| 建议方向 | 从最新主线建立独立可靠性治理批次：逐项决定 SLO/deny key应被 runtime/alert使用还是移入文档；为执行项建立单一 typed source、loader/生成物与反事实测试，避免仅扩大文字 regex。 |
| 验证/回滚 | 对每项 SLO/deny加入故意超阈/敏感字段样本，确认相应 metric alert/redaction行为；恢复/backup目标需在隔离演练中验证。回滚为撤回单一配置到执行链改动。 |
| 是否需要独立复核 | 否；涉及实际 SLO/合规承诺需可靠性/安全所有者确认。 |

## F-0262｜运行时契约迁移会无条件覆盖未知 checksum

| 字段 | 记录 |
| --- | --- |
| 模块 | 数据库 migration ledger / 运行时契约 |
| 类型 | 迁移完整性、配置漂移检测 |
| 严重级别 | **P2** |
| 置信度 | 高 |
| 文件和精确位置 | `02_platform_pingtai/database/supabase/migrations/20260829190000_reconcile_runtime_contract_head.sql:156-157,164-169`。 |
| 当前/预期 | migration 直接把 version `20260821032000` 的 checksum 更新为目标值，未限定允许的旧值；随后 assert 仅检查更新后的值。预期为只接受明确已知 predecessor checksum，未知/缺失值 fail closed，并记录可审计的前后迁移关系。 |
| 直接证据 | [FACT][E-AU-597-001] `update runtime.schemaversion set checksum='2f42…' where version='20260821032000'` 没有旧 checksum guard；[FACT][E-AU-597-002] 本文件最终断言只验证 target checksum；[FACT][E-AU-597-003] AU-593 的同类 repair 对旧 checksum 显式仅接受两个已知值后才更新，证明仓库已有 fail-closed 模式。 |
| 调用链或运行入口 | migration runner → `runtime.schemaversion` → 各 API/Worker `RUNTIME_CONTRACT_CHECKSUM` startup compatibility；`Migrate` 亦将 `20260829190000` 作为 bootstrap preflight head。 |
| 用户/数据/安全影响 | 未证明线上发生；若历史库已含未知或被错误写入的 contract checksum，运行此 migration 会抹去漂移证据并使后续 runtime compatibility 看到目标值，可能让不匹配的 operation/event/permission contract 在启动后才暴露。无直接数据损坏或凭据暴露证据。 |
| 根因 | contract reconciliation 采用无条件“写成当前 head”而未沿用前后 migration 的 predecessor/checksum guard 纪律。 |
| 建议方向 | 从最新主线新建独立 database migration 小批次：仅接受明确 predecessor 值，未知/缺失值拒绝；保留 idempotent replay 路径并增加 known-old、already-target、unknown-old 三类隔离 PostgreSQL 验证。不要改写审计分支历史 migration。 |
| 验证/回滚 | 在隔离数据库分别植入目标、已知旧和未知 checksum：前两者按设计完成/重放，未知值必须事务失败且无写入；回滚为撤回单独 guard migration。 |
| 是否需要独立复核 | 否；上线前应由数据库/发布所有者复核历史 database head 与迁移策略。 |

## F-0263｜财务政策工作流迁移缺少可审计的执行边界

| 字段 | 记录 |
| --- | --- |
| 模块 | 财务政策 / 数据库迁移完整性 |
| 类型 | 迁移执行边界、历史状态兼容 |
| 严重级别 | **P2** |
| 置信度 | 高 |
| 文件和精确位置 | `02_platform_pingtai/database/supabase/migrations/20260830100000_finance_configurable_policy_workflow.sql:1-811`，尤其 `begin` 后的 schema/legacy 数据重塑与 `runtime.schemaversion` 写入（约 1-12、120-165、738-811）。 |
| 当前/预期 | 本 migration 没有校验 `current_database`/migration role、前序 `runtime.schemaversion` version+checksum 或 future head；它可在满足所需对象的非预期数据库状态中执行并将当前 `finance.policy` 封存为 immutable revision。预期为高影响 finance schema/data migration 先接受明确 predecessor/环境，未知或已越过 head 的状态 fail closed，并保留可重放策略。 |
| 直接证据 | [FACT][E-AU-608-001] 文件开头直接 `begin` 并执行 drop constraint、create table/function/trigger、legacy policy insert；没有本仓常见的 boundary/predecessor/future-head guard。 [FACT][E-AU-608-002] 文件末仅插入并断言自身 `runtime.schemaversion`，没有验证开始状态。 [FACT][E-AU-608-003] AU-606/AU-607 等相邻 migration 使用 database identity、精确 predecessor checksum 与 future-head fail-closed guard，说明仓内已存在可采用的控制模式。 |
| 调用链或运行入口 | migration runner → finance policy/index/table/function/RLS 变更 → `FinancePolicyWorkflow` → `OperationController` → 运营端 finance policy preview/manage API；approved `finance.policy` 同时为结算等读取路径提供当前指针。 |
| 用户/数据/安全影响 | 未证明发生在线上。若在错误环境、未知历史 checksum 或越过预期 head 的数据库运行，可能把不兼容的现有 finance policy 作为首个不可变 revision 封存、改变唯一性约束/ACL，或与后续 schema head 混合；失败虽然会回滚当前事务，但成功的错误套用缺少前置阻止。无直接资金损失或权限绕过证据。 |
| 根因 | 大型 finance workflow migration 未沿用相邻迁移的执行环境和 schema ledger guard 纪律。 |
| 建议方向 | 从最新主线创建独立、只新增 migration guard 的小批次：检查目标 database/role、明确 predecessor version+checksum、拒绝 future head/未知 legacy state，并定义 already-applied 的 idempotent 路径；不要重写历史 migration。 |
| 验证/回滚 | 在隔离 PostgreSQL 使用精确 predecessor、未知 checksum、错误数据库和 future-head 四种 fixture：仅合法 predecessor 可继续，后三者必须在任何 DDL/DML 前失败；对合法路径验证 policy pointer/revision/ACL 不变性。回滚为撤回独立 guard migration。 |
| 是否需要独立复核 | 否；执行前应由数据库与财务所有者复核实际 schema head 和 legacy policy 数据。 |

## F-0264｜Identity API 的跨域读取 RLS 未限定 scope

| 字段 | 记录 |
| --- | --- |
| 模块 | Identity operator API / referral、channel、voucher、catalog read boundary |
| 类型 | 多租户数据隔离、数据库纵深防御 |
| 严重级别 | **P2** |
| 置信度 | 高 |
| 文件和精确位置 | `02_platform_pingtai/database/supabase/migrations/20260831110000_identity_distribution_channel_voucher_read_boundary.sql:46-61,77-95`。 |
| 当前/预期 | `zhudatuanidentityapi` 获得 24 张业务表的 SELECT，循环为每张表创建 `using (true)` 的 RLS policy。预期为每张表按其真实 scope owner/关联链使用 `access.scope_allowed(...)`，或改为最小 security-definer read projection。 |
| 直接证据 | [FACT][E-AU-615-001] 动态 policy SQL 字面量是 `using (true)`；[FACT][E-AU-615-002] migration assert 只计数 24 个 policy，不验证 scope predicate；[FACT][E-AU-615-003] AU-614 同一 identity API 的 finance 读取采用 scope_allowed/provenance RLS，说明仓内已有更窄模式。 |
| 调用链或运行入口 | IdentityRegistrationApi → IdentityOperatorReferral/Channel/Voucher modules → `zhudatuanidentityapi` SELECT；应用 AccessPipeline 先做授权，但 DB role 对这 24 relation 的 raw SELECT 不再行级限制。 |
| 用户/数据/安全影响 | 未证明已发生泄露。若任一现有/新增 identity API query 缺 scope predicate、被错误复用或 SQL 注入防护失效，数据库会返回跨 scope 的 referral、catalog、channel、extension 或 voucher 数据；应用层授权仍是现有第一道控制。 |
| 根因 | 为批量建立跨模块 operator read access，使用统一 permissive RLS 模板，未为各 relation 建立 scope provenance。 |
| 建议方向 | 从最新主线建立独立 security batch：按 relation 分类实现 scope owner RLS/projection，先覆盖高敏感 voucher/referral/channel 数据；对同 scope/跨 scope/无 app context 的实际 role fixture 加反事实数据库测试。不要改写本历史 migration。 |
| 验证/回滚 | 隔离数据库以 identity role 设置不同 scope：仅本 scope row 可读，跨 scope/空 context 必须为空；核对每个 API read 的正确结果。回滚为撤回独立 policy/projection batch。 |
| 是否需要独立复核 | 是；复核者需重新追踪 24 relation 的 owner scope 和所有 Identity API query。 |

## F-0265｜Internal Mall 数据集与 fulfillment mall identity schema 不兼容

| 字段 | 记录 |
| --- | --- |
| 模块 | 本地数据集 / fulfillment schema 演进 |
| 类型 | 数据初始化可用性、schema 契约漂移 |
| 严重级别 | **P2** |
| 置信度 | 高 |
| 文件和精确位置 | `02_platform_pingtai/database/supabase/migrations/20260901221000_add_fulfillment_mall_identity.sql:3-8,88-93`；`20260901222000_add_inventory_mall_identity.sql:3-4,63-64`；`04_tools/tools/seed/src/InternalMallSeedCommerce.ts:216-217,463-487`；`InternalMallSeedCore.ts:259-261`。 |
| 当前/预期 | 两个 migration 将 fulfillment 的六个 identity 字段及 inventory reservation/movement 的 `mall_id` 设为 NOT NULL；正式 Internal Mall dataset 仍用不含这些字段的 `insertRows`。预期为数据集在当前 schema 写入 order 的 mall/member/scope，并为所有 fulfillment/inventory child 带入 mall。 |
| 直接证据 | [FACT][E-AU-624-005] fulfillment migration 在回填后无默认值地设六个字段 NOT NULL；[FACT][E-AU-624-006] 种子 fulfillment rows 仅传旧有 order/suborder/provider 等 16 列，line、milestone、return 亦无 `mall_id`；[FACT][E-AU-625-005] inventory migration 将 reservation/movement `mall_id` 设为 NOT NULL；[FACT][E-AU-625-006] Core/Commerce dataset writer 的 receive/reserve/commit/release movement 和 reservation 列表均没有 `mall_id`；[FACT][E-AU-624-007] `InternalMallDataset` 与 `ImportInternalMallDataset` 都直接调用 `seedCommerce`，没有 schema-version 分支或后续补值步骤。 |
| 调用链或运行入口 | `InternalMallDataset` / `ImportInternalMallDataset` → `seedCore`/`seedCommerce` → `insertRows` → inventory reservation/movement 与 fulfillment 四张表。 |
| 用户/数据/安全影响 | 本地/隔离环境初始化会在 inventory 或 fulfillment 阶段因 NOT NULL 约束停止，阻断该正式演示、验收或开发数据集的完整建立；未证明影响线上事务或已有生产数据。 |
| 根因 | identity migration 与工具型 dataset writer 没有同批更新，且相邻 runtime writer 的 mall identity 测试不覆盖该工具入口。 |
| 建议方向 | 从当时最新主线建立独立 seed compatibility 批次：以 order 的 mall/member/scope 填充 fulfillmentorder，并向 fulfillment child、inventory movement/reservation 写入 mall；不要改写历史 migration。为最新 schema 的全量 dataset/import 建立一条最小成功契约。 |
| 验证/回滚 | 隔离 PostgreSQL 应用当前 migrations 后分别运行 normal dataset 与 import dataset，断言 fulfillment 与 inventory 行数、mall/member/provider scope 与父 order/stock 一致；回滚为撤回独立 seed 提交。 |
| 是否需要独立复核 | 是；复核者需在最新 schema 实跑两条正式 seed 入口，并核对是否另有后置 schema adapter。 |

## F-0266｜Mall provisioning access migration 授权了尚未定义的函数

| 字段 | 记录 |
| --- | --- |
| 模块 | 数据库迁移 / Mall provisioning runtime |
| 类型 | 迁移顺序、空库可重建性 |
| 严重级别 | **P2** |
| 置信度 | 高 |
| 文件和精确位置 | `02_platform_pingtai/database/supabase/migrations/20260902012000_zhudatuan_mall_provisioning_access.sql:38-40`；`20260903103000_provision_l1_mall_owner.sql:26,65,108-111`；`01_core_hexin/services/commerce/src/foundation/infrastructure/MigrationRunner.ts:56-68`。 |
| 当前/预期 | AU-628 对 `access.provision_mall_owner` 与 `access.read_provisioned_mall` 直接 `grant execute`，但两个 function 在字典序后 20260903103000 才首次 create；正式 runner 对 migration filename `.sort()` 后以原样 SQL 执行。预期为被 grant 的 function 在 migration 之前存在，或 grant 与 function creation 同一/后续 migration 完成。 |
| 直接证据 | [FACT][E-AU-628-003] 全 migration 集内这两个 function 的首次定义仅在 20260903103000；[FACT][E-AU-628-004] `genericMigrationSql` 仅转换另一份 20260829211000 migration，本文件原样返回；[FACT][E-AU-628-005] MigrationRunner 依次执行排序文件，单个 SQL 失败前不会写入 schema_migrations ledger。 |
| 调用链或运行入口 | `MigrationMain` → `MigrationRunner.run()` → sorted migration loop → `20260902012000` → PostgreSQL `grant execute on function` resolution。 |
| 用户/数据/安全影响 | 新建或从该历史点重建数据库会在 provisioning access migration 停止，阻断后续 schema、Mall provisioning API 与依赖其后的服务启动；未证明现有线上数据库正在受影响或有数据损失。 |
| 根因 | 专用 provisioning role/ACL migration 先于 owner-provisioning function 的首次定义提交，且没有延迟 grant 或存在性 guard。 |
| 建议方向 | 从当时最新主线建立独立、前向兼容 migration：只在函数存在时补授予并在其后 assert；同时先确认所有已部署数据库的 schema ledger。不要修改历史 migration 文件。 |
| 验证/回滚 | 干净隔离 PostgreSQL 按正式 MigrationRunner 顺序运行至 20260902012000，确认当前失败；应用前向兼容 batch 后验证全量迁移、provisioning runtime compatibility 及 platform owner create/read mall。回滚为撤回该单独补偿 migration。 |
| 是否需要独立复核 | 是；复核者需独立确认所有定义位置、执行器 transform 集和 production schema_migrations 状态。 |

## F-0267｜Owner transfer function 权限迁移后没有对应写入口

| 字段 | 记录 |
| --- | --- |
| 模块 | Owner identity / Access API runtime boundary |
| 类型 | 权限与路由/模块注册断链、关键治理能力可用性 |
| 严重级别 | **P2** |
| 置信度 | 高 |
| 文件和精确位置 | `02_platform_pingtai/database/supabase/migrations/20260902135000_owner_identity_runtime_boundary.sql:19-56`；`01_core_hexin/services/commerce/src/modules/access/03_application_yingyong/AccessOperations.ts:129-179`；`modules/access/05_interface_jieru/IdentityOperatorAccessModule.ts:1-6`；`entry/IdentityRegistrationApiMain.ts:46-76`；`modules/webbusiness/WebBusinessModules.ts:23-45`。 |
| 当前/预期 | migration 将 create/cancel/commit/expire owner transfer 与 owner-mobile functions 的 caller guard/execute privilege 从 `shopapp` 转为仅 `zhudatuanidentityapi`。但 owner transfer HTTP actions 仍在完整 AccessOperations；Identity API 只加载 `ACCESS_OPERATOR_READ_OPERATION_IDS`，Web Business API 不加载 access module。预期为每个已授权 function 都有同 role 的已注册 operation 路径，或旧路径保持其必要 privilege。 |
| 直接证据 | [FACT][E-AU-632-002] migration 对五个 function revoke shopapp 并仅 grant identity API；[FACT][E-AU-632-003] AccessPort/AccessOperations 继续直接调用 create/cancel owner transfer function；[FACT][E-AU-632-004] IdentityOperatorAccessModule 只封装 read actions，IdentityRegistrationApi 的 operation/module arrays 仅包含该 read module；[FACT][E-AU-632-005] WebBusiness API selected module list不含 AccessModule。 |
| 调用链或运行入口 | 已注册 `access.ownership.transfers.{preview,create,accept,cancel}` route → AccessOperations → AccessPort → `access.*_owner_transfer` functions；迁移后 function 要求 Identity API role，但该 Identity API 未注册这些 write operations。 |
| 用户/数据/安全影响 | Owner transfer 的创建/取消等治理动作可能在调用时被数据库拒绝，或没有可达的专用 API 承接；当前未取得线上失败回执，未证明已有转移流程正在中断，也未发现越权写入。 |
| 根因 | 数据库 role 收敛与 HTTP/module topology 分两处演进，迁移只验证 DB privilege/definition，未验证 operation registration 与实际服务 role 的闭环。 |
| 建议方向 | 从当时最新主线建立独立 topology/permission repair 批次：先确认权威 owner-transfer API runtime，再同批移动 selected write module 或恢复最小旧 role execute；为每条 owner transfer route 加真实 role 的成功与 forbidden-role 反事实测试。不要改写历史 migration。 |
| 验证/回滚 | 隔离环境分别以 shopapp 与 identity API role 调用每个 function，并通过实际 registered route 调用 create/accept/cancel；应仅有权威 route 成功。回滚为撤回独立 module/ACL repair。 |
| 是否需要独立复核 | 是；复核者需重新核对运行 unit、reverse proxy route、module operation catalog 与生产 DB grants。 |

## F-0268｜Senior Administrator 邀请的数据库授权矩阵缺少直接契约测试

| 字段 | 记录 |
| --- | --- |
| 模块 | 身份邀请 / Senior Administrator governance |
| 类型 | 数据库权限契约、测试可信度 |
| 严重级别 | **P3** |
| 置信度 | 高 |
| 文件和精确位置 | `02_platform_pingtai/database/supabase/migrations/20260902136000_administrator_invitation_runtime_alignment.sql:14-56,163-424`；`02_platform_pingtai/database/supabase/tests/zhudatuan_operator_invitation_registration_contract.sql`；`01_core_hexin/services/commerce/src/modules/identity/06_tests_ceshi/IdentityInvitation.test.ts:153-174`。 |
| 当前/预期 | 应用层 unit test 覆盖 Senior Administrator 在 full runtime 创建 operator invitation，但该 harness mock database query；现有 PostgreSQL contract SQL 不出现 `senior` 或 `zhudatuan_operator_invitation_allowed`。预期应在真实数据库 role、RLS 和 session context 下覆盖 Owner/Senior/ordinary/anonymous 的 create/read/revoke/consume allow 与 deny 矩阵。 |
| 直接证据 | [FACT][E-AU-633-001] migration 的 permission predicate、trigger 与三条 identity API RLS policy 共同决定实际写入；[FACT][E-AU-633-003] `IdentityInvitation.test` 以 application harness 验证 full runtime senior path；[FACT][E-AU-633-005] 对现有 SQL contract 的 senior/predicate 检索无命中，未保存数据库层 senior 反事实契约。 |
| 调用链或运行入口 | Console → `identity.invitations.create/revoke` → IdentityRegistrationApi → `member.invite` RLS/trigger → registration consume。 |
| 用户/数据/安全影响 | 当前未取得越权或合法请求失败的运行证据；未来改动该 migration 覆盖的 predicate、policy 或 role grant 时，应用层 mock contract 无法发现 PostgreSQL 特有的 RLS、current_user、session variable 或 trigger 回归，可能造成错误拒绝或权限边界漂移。 |
| 根因 | senior delegation 在后续 migration 中叠加到既有 invitation contract，application unit test 随之扩展，而原始数据库 contract 未同步扩展。 |
| 建议方向 | 从当时最新主线建立独立 database-contract test 批次：用隔离数据库最小 fixture 分别验证 Owner 与 Senior 的允许路径、ordinary/stale grant/deny override/错 scope 的拒绝路径，以及匿名 registration consume 的不可提升边界；不改写历史 migration。 |
| 验证/回滚 | 仅运行该 SQL contract 和对应 invitation integration path，断言允许/拒绝集合；回滚为撤回单独的测试 fixture/contract 提交。 |
| 是否需要独立复核 | 否；测试 fixture 的真实 role/session 建模需权限所有者确认。 |

## F-0269｜成员邀请读取迁移的历史 contract checksum 更新在正式顺序中静默失配

| 字段 | 记录 |
| --- | --- |
| 模块 | 数据库 migration ledger / member invitation read |
| 类型 | 迁移完整性、运行时契约账本可信度 |
| 严重级别 | **P3** |
| 置信度 | 高 |
| 文件和精确位置 | `02_platform_pingtai/database/supabase/migrations/20260902139000_add_member_invitation_records_read.sql:16-19`；`20260830103000_identity_runtime_contract_visibility.sql`（`20260821032000` checksum 更新）；`01_core_hexin/services/commerce/src/foundation/infrastructure/MigrationRunner.ts:56-68`。 |
| 当前/预期 | AU-636 仅在旧值等于 `a634…` 时将 version `20260821032000` 更新为 `f0c4…`，未检查是否更新到任何行；完整字典序链中 AU-202608301030 已将同 version 设为 `d7e499…`，因此该 update 为零行而 migration 仍继续。预期为前置 checksum 与线性链一致并断言更新一行，或将新 contract 以独立不可变 version 记录。 |
| 直接证据 | [FACT][E-AU-636-003] 全部修改同 version checksum 的 migration 按文件名排序至 AU-202608301030 时最后值为 `d7e499…`；[FACT][E-AU-636-004] 本 update 的唯一允许旧值 `a634…` 在 migration 集内没有前向 set，且 SQL 没有 `not found`/row-count/assert；[FACT][E-AU-636-005] MigrationRunner 对排序文件逐项执行。 |
| 调用链或运行入口 | MigrationMain → MigrationRunner sorted loop → runtime.schemaversion historical contract row；member invitation read 的 runtime/capability insert 独立继续执行。 |
| 用户/数据/安全影响 | 不会阻止该 read operation 插入或直接改变 invitation 数据；但 runtime contract ledger 保留过期 checksum，后续依赖该历史 checkpoint 的人工、部署或数据库校验可能得到错误基线并掩盖 drift。仓内未找到该 checksum 的直接 Node consumer，未证明线上可用性影响。 |
| 根因 | 多个迁移持续复用同一历史 version 作为可变 contract-head 指针，但没有单一线性 owner 或每步的匹配/affected-row assertion。 |
| 建议方向 | 从当时最新主线建立独立 migration-ledger 批次：先重建完整 checksum 线性链和现网 row 值，再以不可变新 version 或严格前置+单行断言记录 contract；不得改写历史 migration。 |
| 验证/回滚 | 在隔离 PostgreSQL 用正式 sorted runner 跑到 AU-636，断言当前 checksum 和 row count；应用新前向 migration 后验证期望 ledger 值与 operation registry。回滚为撤回单独 ledger 迁移。 |
| 是否需要独立复核 | 否；若发现外部 readiness/release consumer，应升级为专项复核。 |

## F-0270｜Qualification Profile 单一 member 主键与多 Mall Storefront 注册不兼容

| 字段 | 记录 |
| --- | --- |
| 模块 | Storefront registration / qualification / checkout |
| 类型 | 多租户数据所有权、资格决策正确性 |
| 严重级别 | **P2** |
| 置信度 | 高 |
| 文件和精确位置 | `02_platform_pingtai/database/supabase/migrations/20260821016000_create_qualification.sql:13-21`；`20260903105000_initialize_storefront_qualification.sql:20-32`；`01_core_hexin/services/commerce/src/modules/identity/05_interface_jieru/http/RegistrationOperations.ts:288-325`；`modules/qualification/03_application_yingyong/QualificationOperations.ts:20-28`；`modules/checkout_jiesuan/03_application_yingyong/queries_duqu/QuoteReader.ts:84-100`。 |
| 当前/预期 | `qualification.profile` 以 `member_id` 为 primary key，初始化 trigger 对该 key conflict 静默不写；同一 resolved member/account 可按不同 `organization_id` 创建多条 storefront membership。第二个 Mall 因而没有 `scope_id=第二 Mall` 的 profile，而资格 preview 和 quote 都 join `profile.member_id` 且 `profile.scope_id=current Mall`。预期是一个 member 在每个可注册 Mall 都有正确 scope-local qualification state，或系统在注册前明确、可验证地禁止跨 Mall membership。 |
| 直接证据 | [FACT][E-AU-643-001] profile schema 的唯一键仅为 member ID；[FACT][E-AU-643-002] trigger `on conflict(member_id) do nothing`；[FACT][E-AU-643-003] existing-account registration 的 storefront membership lookup/creation键为 member + organization + client；[FACT][E-AU-643-004] qualification preview 与 QuoteReader 均要求 profile scope 等于操作 Mall。 |
| 调用链或运行入口 | Storefront invitation/registration → `access.membership` insert → `initialize_storefront_qualification` trigger → `qualification.profile` → qualification decisions / checkout quote。 |
| 用户/数据/安全影响 | 已在一个 Mall 建档的会员进入第二个 Mall 时，其新 Mall 的资格 profile 留空；资格预览可能返回空集合或无法给出 eligibility，结算上下文的 qualification version/city 数据缺失。未证明已造成生产订单错误或越权访问。 |
| 根因 | qualification data model 将 member identity 设计为全局单行，同时 downstream policy/checkout 消费者把 profile 视为 Mall-scoped；provisioned Mall registration 引入多 Mall membership 后未一并迁移 key/ownership model。 |
| 建议方向 | 从当时最新主线建立独立 qualification data-model 批次：先决定 profile 应为 `(member_id,scope_id)` 多行，或将 scope-independent字段与 Mall qualification state 拆表；添加历史 backfill和唯一性/foreign-key strategy。若产品确实禁止跨 Mall 注册，应在 invitation/registration DB and application boundary作 fail-closed enforce，并写明契约。不要仅把 trigger 改为 overwrite scope。 |
| 验证/回滚 | 隔离数据库为同一 member 完成 Mall A/B registration，分别执行 qualification preview 和 quote，断言每 Mall profile/decision/context 正确且互不覆盖；覆盖已有 profile/多 tag/历史 rows迁移。回滚为撤回独立 schema/data migration 和 consumer adaptation。 |
| 是否需要独立复核 | 是；复核者需重新检查 qualification profile/tag/policy/resource schema、所有 read/write consumer、可支持的跨 Mall membership产品语义及历史数据量。 |

## F-0271｜确认收货 operation 已发布但未装配到实际 API

| 字段 | 记录 |
| --- | --- |
| 模块 | Runtime catalog / Purchase API / order receipt |
| 类型 | API 契约、运行入口与模块装配断链 |
| 严重级别 | **P2** |
| 置信度 | 高 |
| 文件和精确位置 | `02_platform_pingtai/database/supabase/migrations/20260905010000_publish_runtime_catalog_alignment.sql:24-45`；`01_core_hexin/services/commerce/src/modules/order_dingdan/03_application_yingyong/commands_xieru/ConfirmOrderReceipt.ts:20-57`；`modules/purchase/PurchaseModules.ts:9-21`；`modules/purchase/PurchaseOperations.ts:39-44`；`entry/PurchaseApiMain.ts:10-17`；`entry/PurchaseApiEntrypoint.test.ts:22-40,58-70`；`foundation/interface/OperationController.ts:295-305`。 |
| 当前/预期 | migration 将 `order.orders.receive` 发布为 `POST /api/v1/orders/{orderid}/receive`，附加 member audience、`order.read` permission 与 enabled entitlement；其 handler 和 order module均存在。但实际 Purchase API operation array 只含 quote、create order、create/read payment，selected order module 只加载 `order.orders.create`，因此 bootstrap 不注册 receive route。预期是公开 catalog 的 operation 被一个部署运行单元以相同 method/path 注册，或目录和 capability 被正式退役。 |
| 直接证据 | [FACT][E-AU-650-001] migration 写入 `runtime.operation`/`capability.operation`/entitlement；[FACT][E-AU-650-002] receipt handler 的 operation key 是 `order.orders.receive`，并只允许当前 scope member 对自己的 shipped order 更新；[FACT][E-AU-650-003] Purchase API Main 的 allowlist 来自 `PURCHASE_OPERATION_IDS`，其中不含 receive，且 `PurchaseOrderModule` 仅选择 create；[FACT][E-AU-650-004] route contract 将 allowlist 精确断言为四项、只断言 create order/payment read 路由；OperationController 仅为 passed selected operation IDs 注册 route。对非测试 source 的该 operation-id 使用检索没有发现其他 entrypoint 装配。 |
| 调用链或运行入口 | catalog/capability publication → 应承诺 `POST /api/v1/orders/{orderid}/receive` → Purchase API `bootstrapApi(operationIds)` → `PurchaseOrderModule` selected operations；当前在最后两步缺失 receive。 |
| 用户/数据/安全影响 | 用户或集成方按 published catalog 调用确认收货时会没有本仓 Node API route；订单保持 shipped/active，后续 completed 事件不会发布。未发现越权写入、数据损坏或已发生线上失败回执。 |
| 根因 | runtime catalog migration 与最小化 Purchase API surface 发生独立演进；入口测试固定了排除后的 allowlist，却未对数据库 operation registry 与实际 deployment route 建立闭环断言。 |
| 建议方向 | 从当时最新主线建立一个单一目的 repair batch：先确认产品仍承诺确认收货；若承诺，向权威 Purchase API 增加 receive 的 selected module/operation/route 与真实授权测试；若已下线，则前向停用 runtime operation、capability 与 entitlement，并处理客户端契约。不要修改历史 migration。 |
| 验证/回滚 | 隔离环境通过实际部署的 Purchase API 以合法 member 调用该 path，断言仅本人 shipped order 成功、重复幂等、他人/未发货/version conflict 均拒绝；退役路径则断言 catalog 与客户端不再暴露。回滚为撤回独立入口或目录变更。 |
| 是否需要独立复核 | 否；实施前需要产品/API owner确认 operation 是否仍是对外承诺。 |

## F-0272｜Store governance scope 规范化缺少数据库级拒绝契约

| 字段 | 记录 |
| --- | --- |
| 模块 | Governance scope / Store scope |
| 类型 | 数据库权限契约、测试可信度 |
| 严重级别 | **P3** |
| 置信度 | 高 |
| 文件和精确位置 | `02_platform_pingtai/database/supabase/migrations/20260905011000_expand_governance_store_scope.sql:25-81`；`20260902132000_canonical_governance_context.sql:24-128`；`20260902134000_senior_administrator_role.sql:42-125`；`01_core_hexin/services/commerce/src/foundation/security/PgAccessResolvers.test.ts:79-84`。 |
| 当前/预期 | migration 为 `canonical_governance_scope` 增加 Store branch：输入 Store ID 会返回该 Store 的 ID 与其 Mall 的最近 Tenant（或 Mall）组织。仓内没有调用该 SQL function 的 PostgreSQL contract；现有 PgAccessResolvers unit test 注入已解析的 governance row。预期应保存 active/inactive、正确/错误 actor-membership、Store/Mall/tenant 边界及 scope-kind 的真实 DB 允许/拒绝契约。 |
| 直接证据 | [FACT][E-AU-651-001] Store branch 读取 `partner.store` 并只要求 Mall active；[FACT][E-AU-651-002] function 以 SECURITY DEFINER 运行、由 `resolve_governance` lateral 调用；[FACT][E-AU-651-003] 对 database test 目录的 `canonical_governance_scope`/Store scope normalization 检索未命中，PgAccessResolvers test 则直接构造 resolver 返回行而不执行 SQL function。 |
| 调用链或运行入口 | Console/API access context → `access.resolve_governance` → `access.canonical_governance_scope` Store candidate → 后续 scope/capability authorization。 |
| 用户/数据/安全影响 | 当前没有发现越权或合法请求失败证据；但未来改动 Store、closure、active-state 或 SECURITY DEFINER ACL 时，现有 unit fixture 无法发现数据库特有的跨 Tenant 映射、空结果或错误 normalization，可能使治理请求错误拒绝或指向错误组织。 |
| 根因 | Store scope 被追加到既有 canonical resolver，发布 migration 的断言只检查 function text 包含 `partner.store`，没有验证行为矩阵。 |
| 建议方向 | 从当时最新主线建立独立 DB contract-test 批次：最小 fixture 覆盖 active Store→Tenant、无 Tenant ancestor→Mall、inactive Store/Mall、actor/membership mismatch、错误 scope kind与跨 Tenant Store；同时断言 resolver 只规范化而不绕过授权。不要改写历史 migration。 |
| 验证/回滚 | 在隔离 PostgreSQL 以实际 runtime role 调用 `resolve_governance` 和后续权限读取，逐例断言 scope 字段及 allow/deny；回滚为撤回独立 SQL contract test。 |
| 是否需要独立复核 | 否；Store 跨 Mall/Tenant 的期望业务语义需要权限所有者确认。 |

## F-0273｜Identity API 保留没有运行消费者的 Catalog 写权限

| 字段 | 记录 |
| --- | --- |
| 模块 | Identity API / Catalog database boundary |
| 类型 | 最小权限、部署边界与数据库 ACL 漂移 |
| 严重级别 | **P3** |
| 置信度 | 高 |
| 文件和精确位置 | `02_platform_pingtai/database/supabase/migrations/20260907010000_enable_identity_catalog_commands.sql:30-41,46-70`；`01_core_hexin/services/commerce/src/entry/CatalogOperatorApiEntrypoint.test.ts:18-20`；`bootstrap/CatalogOperatorApiRuntime.test.ts:35-38`。 |
| 当前/预期 | migration 授予 `zhudatuanidentityapi` 对 catalog importjob 的 SELECT/INSERT/UPDATE、import row/error 的 SELECT、listing 的 SELECT/UPDATE，并建立 scope_allowed RLS policies。对当前 Identity module、entrypoint、bootstrap、release mapping的 catalog import/listing SQL、operation、route、adapter检索无命中；Catalog command runtime 由 Catalog Operator API 的独立 role 承载。预期是每个 runtime role 只保留当前已注册运行单元所需的最小 catalog ACL。 |
| 直接证据 | [FACT][E-AU-658-001] migration 的 grant/policy 精确覆盖四张 catalog relation；[FACT][E-AU-658-002] 全部 Identity runtime source 对该四 relation的 consumer 检索无命中，Catalog Operator API entrypoint test 明确其 catalog-only边界，runtime test 拒绝 `zhudatuanidentityapi` 作为 catalog operator role；[FACT][E-AU-658-003] 后续 migration 集对这四 relation与 `zhudatuanidentityapi` 的 revoke/grant检索只有本 migration。 |
| 调用链或运行入口 | Identity API DB role → catalog import/listing table ACL/RLS；当前没有对应 Identity API command/module/route，Catalog Operator API 使用独立 runtime role。 |
| 用户/数据/安全影响 | 未发现外部用户可触发的直接 Catalog 写入，也没有已知数据事故；但 Identity API 一旦被攻破或出现 SQL injection，攻击面额外包括其当前 scope 下的 catalog listing 更新与 import job 写入，扩大进程隔离失效后的影响范围。 |
| 根因 | 早期 Identity-Catalog command ACL 与后来拆分出的 Catalog Operator runtime 没有同步收敛；migration assertion只验证权限存在，未验证已注册的实际消费入口。 |
| 建议方向 | 从当时最新主线建立单一 ACL-reconciliation 批次：先确认不存在仓外 Identity catalog consumer及生产角色依赖，再以独立前向 migration revoke Identity API 的多余 table grants并 drop专用 policies；Catalog Operator role维持自己的最小权限。不要改写历史 migration。 |
| 验证/回滚 | 隔离数据库以 Identity API role 执行 import/listing read/write，收敛后均应拒绝；以 Catalog Operator role 运行真实 import/listing command应仍成功。回滚为恢复独立 ACL migration，前提是确认合法 consumer。 |
| 是否需要独立复核 | 否；ACL回收前需要 Identity/Catalog owner确认所有仓外 worker、SQL console和生产 grants。 |

## F-0274｜L1 专用 Auth return target 已入库但应用层拒绝解析（已关闭：前向迁移已规范化）

| 字段 | 记录 |
| --- | --- |
| 模块 | Identity auth ticket / L0-L1 realm boundary |
| 类型 | 数据库约束与 API 契约漂移、登录回跳可用性 |
| 严重级别 | **已关闭（原 P2；基线代码/迁移链已消除）** |
| 置信度 | 高 |
| 文件和精确位置 | `02_platform_pingtai/database/supabase/migrations/20260907113000_separate_l0_l1_auth_return_targets.sql:21-35`；`01_core_hexin/packages/config/src/ClientEnvironment.ts:5`；`services/commerce/src/modules/identity/05_interface_jieru/http/IdentitySecurity.ts:20-27`；`RegistrationOperations.ts:140-143,195-200`；`WechatOperations.ts:57-62,143-146`；`RealmAccount.ts:50-115`。 |
| 当前/预期 | 原 migration 曾临时将 `console-hbbtzn` 和 `storefront-hbbtzn` 写入 `identity.authticket.target`。后续 `20260908011000_canonicalize_sfl_identity_targets.sql:25-55` 已把 L1 Realm 的 session、ticket 和 target 转换为 `console`/`storefront`，并将数据库 check 收窄为应用 `AuthTarget` union 的四个值；当前契约与终态 schema 一致。 |
| 直接证据 | [FACT][E-AU-660-001] 原约束包含两个 legacy value；[FACT][E-AU-666-001] 后续 migration 的 source guard 要求它们存在、同步转换三个数据面并重建约束；[FACT][E-AU-666-002] terminal assertion 禁止任何 legacy value 残留；[FACT][E-AU-666-003] auth web tests 亦拒绝 legacy input。 |
| 调用链或运行入口 | Password registration/login 或 WeChat JSAPI → `authTarget(body.target)` → `resolveRealmContext`/`resolveRealmApplication` → `PgAuthTicket.issue` → `(realm_id,target)` Realm return origin。 |
| 用户/数据/安全影响 | 代码基线中已无该 parser/schema 不匹配；同名 target 的 L0/L1 return origin 由 Realm-bound data 查询隔离。未读取生产 migration ledger，故不能断言任一线上数据库已完成规范化。 |
| 根因 | 初始审阅截取了迁移链中间状态；后续前向 migration 明确完成了 API target 名称与 Realm return-origin 模型的对齐。 |
| 建议方向 | 不创建修复批次。仅在发布/运行核查时读取受控环境的 `runtime.schemaversion` 与 Realm target 数据，确认已达到 `20260908011000` 或更高的连续迁移状态。 |
| 验证/回滚 | 隔离环境为 L0/L1 Realm 分别验证通用 `console`/`storefront` target 的 issue/exchange 与各自 signed return origin；运行状态异常时按既定 migration recovery 流程处理，不回滚为 legacy target 名称。 |
| 是否需要独立复核 | 否；仅需运行状态核查。 |

## F-0275｜跨 Realm login intent 的数据库安全契约未被执行测试锁定

| 字段 | 记录 |
| --- | --- |
| 模块 | Identity cross-Realm login intent |
| 类型 | 测试可信度、认证状态机数据库契约缺口 |
| 严重级别 | **P3** |
| 置信度 | 高 |
| 文件和精确位置 | `02_platform_pingtai/database/supabase/migrations/20260908012000_create_sfl_login_intents.sql:20-140`；`01_core_hexin/services/commerce/src/modules/identity/06_tests_ceshi/LoginIntentOperations.test.ts:8-68`。 |
| 当前行为 | migration 以 `identity.issue_login_intent`/`identity.consume_login_intent` 实现 source/target Realm、account、session、target、TTL和一次性消费约束。现有 TypeScript test mock 数据库返回，只断言 handler 所传 SQL 参数及 URL；对 Supabase SQL tests 检索不到这两个函数的执行调用。 |
| 预期行为 | 认证交接的关键 DB 状态机应以隔离数据库 contract test 覆盖成功路径及 source session revoked、target Realm/target/application/account/session mismatch、过期、重复消费和未授权 role 的拒绝。 |
| 直接证据 | [FACT][E-AU-667-001] migration lines 80-133 定义 state machine 和其安全条件；[FACT][E-AU-667-002] `LoginIntentOperations.test.ts:10-16` 以 mocked issued row 驱动 handler，未执行 SQL function；[FACT][E-AU-667-003] 对 `02_platform_pingtai/database/supabase/tests/**/*.sql` 检索 `issue_login_intent`/`consume_login_intent` 无命中。 |
| 调用链或运行入口 | 已认证 Identity API request → `identity.loginintents.create` → `identity.issue_login_intent` → target accounts host 登录 → target session creation → `identity.consume_login_intent`。 |
| 用户影响 | 回归可能令跨节点登录无故失败、意图可被错误消费或过期处理失效；现有 unit test 未能揭示 database-level 回归。 |
| 数据影响 | login intent/session 记录可能留下不符合预期的 consumed/target binding；未发现现有数据事故。 |
| 安全影响 | source/target session、Realm 和一次性消费是跨域认证边界；缺少 DB-level 回归保护提高未来 schema/function 调整导致越域或重放缺陷的风险，当前未证明已有绕过。 |
| 根因 | migration assertion验证对象和 privilege 存在，但没有配套的函数行为 contract；handler test 用 mock 替代数据库状态机。 |
| 建议方向 | 从当时最新主线建立独立测试批次，仅新增最小 Supabase contract fixture/test 覆盖上述 accepted/rejected matrix；不修改生产 migration。 |
| 预计修改范围 | Supabase test bootstrap/contract SQL，必要时仅补充 test runner registration。 |
| 验证方式 | 在隔离 PGlite/Postgres runner 运行新增 contract；确认每个拒绝分支不消费 intent，成功分支恰好消费一次且返回精确 source context。 |
| 回滚方式 | 删除独立新增测试及其 runner 注册，不改变生产 schema或数据。 |
| 是否需要独立复核 | 否。 |

## F-0277｜Web 订单四流读取仅授予表权限，未建立运行 role 的 RLS 策略

| 字段 | 记录 |
| --- | --- |
| 模块 | Web Business API / Order read model / Payment-Finance database boundary |
| 类型 | 运行时正确性、行级权限契约与测试可信度 |
| 严重级别 | **P2** |
| 置信度 | 高 |
| 文件和精确位置 | `02_platform_pingtai/database/supabase/migrations/20260911153500_allow_web_order_four_flow_read.sql:3-4`；`01_core_hexin/services/commerce/src/modules/webbusiness/WebOrderOperations.ts:57-76`；`02_platform_pingtai/database/supabase/migrations/20260821021000_create_payment_voucher_benefit.sql:398`；`20260821022000_create_finance_channel.sql:278`；`20260828173000_zhudatuan_web_business_access.sql:232-251,485-497`；`WebOrderOperations.test.ts:10-45`。 |
| 当前/预期 | 当前 migration 向 `zhudatuanwebapi` 授予 `payment`/`finance` schema `USAGE` 与当时所有 table 的 `SELECT`，但 migration 链中未向该 role 注册实际查询所需六张表的 SELECT RLS policy。payment/finance tables 已启用 RLS，故普通 no-bypassrls runtime role 的 lateral payment/finance subquery 将看不到 rows，订单仍可返回但 `payment_fact` 为 null、`finance_facts` 为空。预期应为：已授权订单在该 API role 下仅能读取与其 Mall/scope 绑定的六张所需事实，且无权读取其他 payment/finance relation。 |
| 直接证据 | [FACT][E-AU-679-001] `WebOrderOperations` 直接读取 intent/payment/allocation/refund 及 journal/entry；[FACT][E-AU-679-002] AU-679 是该 role 唯一对应的两个 schema/table grant；[FACT][E-AU-679-003] payment/finance 初始 migration 对 schema 全表启用 RLS；[FACT][E-AU-679-004] 全 migration 集对上述六 relation 的 policy 检索仅命中 `zhudatuanpurchaseapi`、`zhudatuanpaymentwebhookapi`、`zhudatuanidentityapi` 或 `shopapp`，无 `zhudatuanwebapi`；[FACT][E-AU-679-005] WebOrderOperations test mock `PoolClient.query`，只断言 SQL 字符串/参数，未执行 DB role/RLS 行为。 |
| 调用链或运行入口 | Console/Storefront authorized order request → Web Business API → `order.orders.read` → `WebOrderOperations` → payment/finance lateral subqueries；DB connection role 为 `zhudatuanwebapi` 的预期前提需独立复核。 |
| 用户影响 | 订单详情/列表可能缺少支付状态、支付分配、退款或财务流水事实，造成运营判断和售后处理信息不完整；目前未读取生产响应，未确认线上受影响范围。 |
| 数据影响 | 只读链路本身不改写订单或账务；错误的空事实可能触发人工误判或下游界面状态不一致。 |
| 安全影响 | 当前 broad table grant 不是最小授权；在 RLS 存在时不应直接暴露 rows，但若未来新增 permissive policy、role attributes 或 wrapper role 漂移，所有已存在 payment/finance tables 会成为额外读取面。 |
| 根因 | read model 从隔离 domain facts 扩展为四流聚合时，仅补了 schema/table ACL，未将 role-bound RLS policy、旧 boundary assertion及执行型 contract test作为同一变更闭环。 |
| 建议方向 | 从当时最新 `zdt-next` 建立独立、单一目的 ACL/RLS repair batch：先确认真实 Web API connection role和 scope predicate；再将授权收窄至六张表，并按 `orders` 已授权 Mall/scope 设计只读 RLS policy（或改为 security-definer、参数受限的 read function）；同步更新 boundary assertion并新增真实 role/RLS integration contract。不要改写历史 migration。 |
| 预计修改范围 | 新前向 Supabase migration、最小 SQL contract/integration test，必要时 Web read adapter 改为受控函数；不修改订单数据。 |
| 验证方式 | 隔离 PostgreSQL 用正式 migration runner 至基线，分别以 `zhudatuanwebapi`、无权限 role和高权限 role 运行真实 `order.orders.read` SQL：同 scope 四流应完整返回，错 scope/未授权 relation 必须无行或拒绝；运行现有 WebOrderOperations test 加新增 DB contract。 |
| 回滚方式 | 撤回独立前向 ACL/RLS migration 或恢复上一个已验证的 narrow policy/grant 版本；不回写业务数据。 |
| 是否需要独立复核 | 是；复核者必须独立读取 Web API 连接配置、PostgreSQL `pg_policies`/role attributes，以及一条真实 scope/跨 scope request 的结果。 |

## F-0278｜Web 订单路由子事实读取未建立运行 role 的 RLS 策略

| 字段 | 记录 |
| --- | --- |
| 模块 | Web Business API / Order route and fulfillment read model / database boundary |
| 类型 | 运行时正确性、行级权限契约与最小权限 |
| 严重级别 | **P2** |
| 置信度 | 高 |
| 文件和精确位置 | `02_platform_pingtai/database/supabase/migrations/20260911155000_allow_web_order_route_facts_read.sql:3-4`；`01_core_hexin/services/commerce/src/modules/webbusiness/WebOrderOperations.ts:39-56,82-104`；`02_platform_pingtai/database/supabase/migrations/20260821019000_create_cart_checkout_order.sql:88-123,137`；`20260821020000_create_fulfillment_verification.sql:23-34,88`；`20260828173000_zhudatuan_web_business_access.sql:329-368`。 |
| 当前/预期 | 当前 migration 向 `zhudatuanwebapi` 授予 ordering/inventory/fulfillment 三个 schema 的当时所有 tables `SELECT`。实际 order query 读取 `ordering.suborder/reviewaction`、`fulfillment.line/milestone`，而既有该 role 的 RLS policy 仅覆盖 orderrecord、line、aftersale、reservation 和 fulfillmentorder。上述 schemas 已启用 RLS；预期为授权 scope 下的订单可读所需子事实、跨 scope 与无关 relation 仍不可读。 |
| 直接证据 | [FACT][E-AU-680-001] query 的 economic legs、fulfillment lines/milestones、operation review branches分别引用四张未被旧 Web RLS policy 覆盖的 relation；[FACT][E-AU-680-002] initial migrations 对 ordering 与 fulfillment schemas 全表启用 RLS；[FACT][E-AU-680-003] 全 migration 集对四 relation 的 policy 检索只命中 purchase role 或无匹配，未命中 `zhudatuanwebapi`；[FACT][E-AU-680-004] AU-680 使用 all-tables grant 而非所需 relation 的 narrow grant。 |
| 调用链或运行入口 | Console/Storefront authorized order request → Web Business API → `order.orders.read` → WebOrderOperations nested route/fulfillment/operation subqueries。 |
| 用户/数据/安全影响 | 已授权订单响应可能缺少经济履约腿、履约商品/里程碑和售后审核动作，影响运营和售后判断；当前无生产请求回执。表级授权又为未来 RLS/role 漂移扩大了 schema 内读取面。 |
| 根因 | 订单读模型补充子 relation 后，ACL 通过一次 all-tables grant 扩张，而每个新 relation 的 RLS policy与可执行 DB contract没有同步增加。 |
| 建议方向 | 与 F-0277 合并为一个独立、单一目的的 Web order read ACL/RLS repair batch：确认连接 role和 scope 语义后，仅授予实际 relation，分别建立以 parent order/fulfillment scope 为约束的 SELECT RLS policy，或改为受控 read function；补 role/RLS matrix test。不得改写历史 migration。 |
| 预计修改范围 | 新前向 migration、SQL integration contract，必要时受控 read function；不改订单业务数据。 |
| 验证方式 | 隔离数据库以 `zhudatuanwebapi` 执行完整 Web order query：同 scope 的 nested legs/lines/milestones/reviews 应可见，跨 scope 与未授权 relation 必须拒绝或无行；以 no-role 对照执行，并检查只保留必要 table grant。 |
| 回滚方式 | 撤回独立前向 narrow ACL/RLS migration；不回滚或删除订单数据。 |
| 是否需要独立复核 | 是；复核者需独立检查最终 policy catalog、connection role 与跨 scope response。 |

## F-0279｜Purchase quote 的 Partner agreement 表权限未闭合至 RLS

| 字段 | 记录 |
| --- | --- |
| 模块 | Purchase API / Checkout quote / Partner agreement boundary |
| 类型 | 运行时正确性、行级权限契约与测试可信度 |
| 严重级别 | **P2** |
| 置信度 | 高 |
| 文件和精确位置 | `02_platform_pingtai/database/supabase/migrations/20260911163000_allow_purchase_partner_agreement_read.sql:3-4`；`01_core_hexin/services/commerce/src/modules/checkout_jiesuan/03_application_yingyong/queries_duqu/QuoteReader.ts:103-154`；`01_core_hexin/services/commerce/src/bootstrap/PurchaseApiRuntime.ts:170-213`；`02_platform_pingtai/database/supabase/migrations/20260821014000_create_organization_partner.sql:79-90,126`。 |
| 当前/预期 | 当前 migration 将 `partner` schema usage 和 `partner.agreement` SELECT 授予 `zhudatuanpurchaseapi`，Purchase readiness 也只检查该 table grant。但 partner schema 全表启用 RLS，migration 链未为该 role 建立 agreement SELECT policy。预期为购买 quote 仅能读取当前 Mall 内有效、允许被当前 checkout context 使用的 agreement，同时不暴露其他协议。 |
| 直接证据 | [FACT][E-AU-681-001] QuoteReader lines 150-153 以 product owner、cart Mall、active/effective window 查询 agreement，并把合同/能力事实映射进 quote line；[FACT][E-AU-681-002] create_organization_partner migration 对 `partner` 全表启用 RLS；[FACT][E-AU-681-003] 对全 migrations 的 agreement/purchase policy检索未命中 `zhudatuanpurchaseapi`，唯一该 role ACL 即 AU-681；[FACT][E-AU-681-004] PurchaseApiRuntime lines 212-213 与其 test 只验证 table/schema privilege，未做 role/RLS data query。 |
| 调用链或运行入口 | Storefront checkout quote → Purchase API → QuoteReader.lines → `partner.agreement` lateral query → quote/PlaceOrder supply fact selection。 |
| 用户影响 | 没有供应 route 的 owner product 依赖该 fallback agreement 时，quote 可能丢失 agreement facts 并被判为不可购买或合同信息不完整；未读取生产回执，影响范围未验证。 |
| 数据影响 | 读取失败本身不写入数据；可能阻断订单前 quote 而不产生订单。 |
| 安全影响 | 当前无 RLS policy 时 grant 不应披露 rows；若以后添加宽松 policy或 role wrapper漂移，缺乏明确 Mall predicate 的 ACL 设计会造成协议/合同元数据越域读取风险。 |
| 根因 | migration/readiness 将“relation 存在和 table grant”当作可用性充分条件，没有把 RLS predicate与真实 quote execution纳入契约。 |
| 建议方向 | 从当时最新 `zdt-next` 建立独立 Purchase agreement read repair：确认 purchase session context变量和可见性语义后，为 agreement 建立最小 SELECT RLS policy或受控 security-definer lookup function；增加同 Mall allowed、跨 Mall deny、expired/terminated deny 的真实数据库 contract。不要改写历史 migration。 |
| 预计修改范围 | 新前向 migration、最小 SQL integration contract，必要时 QuoteReader 改用受控函数；无数据回填。 |
| 验证方式 | 隔离数据库以正式 `zhudatuanpurchaseapi` 和 checkout session context执行 QuoteReader SQL：当前 Mall active agreement 必须可见，异 Mall、expired、terminated agreement 必须不可见；运行 Purchase readiness 与新增契约。 |
| 回滚方式 | 撤回单独的 forward policy/function migration；不删除或重写 agreement records。 |
| 是否需要独立复核 | 是；复核者须独立确认数据库连接 role、session context 设置与最终 `pg_policies`。 |

## F-0280｜Realm-bound operator 注册写入边界没有 PostgreSQL 执行型契约

| 字段 | 记录 |
| --- | --- |
| 模块 | Identity Registration API / Operator invitation / Realm console boundary |
| 类型 | 测试可信度、认证与授权数据库写入契约 |
| 严重级别 | **P3** |
| 置信度 | 高 |
| 文件和精确位置 | `02_platform_pingtai/database/supabase/migrations/20260911190000_bind_operator_registration_to_realm_console.sql:20-148,153-221`；`01_core_hexin/services/commerce/src/modules/identity/06_tests_ceshi/IdentityRegistration.test.ts`；`02_platform_pingtai/database/supabase/migrations/20260912180000_reconcile_identity_runtime_state.sql:78`。 |
| 当前/预期 | trigger/RLS 同时决定 operator membership、role 与 scopegrant 是否能由已消费 invitation 创建，条件涵盖 `session_user/current role`、transaction timestamp、手机号 hash、Realm console target、Mall/tenant closure 和 exact scope shape。现有仓内检索未找到该 migration/function/error marker的 SQL contract；IdentityRegistration test 使用 application harness/mock database。预期为隔离 PostgreSQL 以真实 role/session context 测试完整 allow/deny 矩阵。 |
| 直接证据 | [FACT][E-AU-684-001] trigger lines 33-145 对 Identity role、consume invite、realmtarget、membership client和scope role作复合校验；[FACT][E-AU-684-002] insert policies lines 153-221 对三个 access relation 重复要求 console target及最小 role/scope；[FACT][E-AU-684-003] 对 source/tests 的 function name、error marker与 migration version检索仅命中后续 reconciliation marker，未命中执行型 DB test。 |
| 调用链或运行入口 | Operator invitation consume → Identity Registration API → member/profile/account/membership/role/scopegrant writes → trigger/RLS → Realm console session authorization。 |
| 用户/数据/安全影响 | 当前没有已知越权注册或合法注册失败的运行证据；未来调整 trigger、RLS、role connection或 Realm target 时，mock test 无法发现 PostgreSQL 专有的 session role、RLS或 transaction-time 回归，可能造成 operator 注册中断或不当 membership/scope grant。 |
| 根因 | 复杂注册保护以迁移内 assertion和 application test保存意图，但没有把实际 PostgreSQL permission context作为可重复执行的测试 fixture。 |
| 建议方向 | 从当时最新 `zdt-next` 建立独立数据库契约测试批次：以真实 `zhudatuanidentityapi`、非 Identity role和最小 Realm/Mall/tenant fixture覆盖合法 registration、wrong Realm target、wrong Mall、expired/replayed invite、超范围 role/scope和 ordinary role deny；不改写生产 migration。 |
| 预计修改范围 | Supabase isolated test fixture/contract SQL，必要时仅测试 runner registration。 |
| 验证方式 | 按正式 migration runner 建立隔离 DB，断言每个 deny case不留下 membership/role/grant，allow case恰好生成 invitation 声明的关系并仅限 tenant+self scope。 |
| 回滚方式 | 删除独立测试和 fixture；不修改生产 schema或业务数据。 |
| 是否需要独立复核 | 否。 |

## F-0281｜Sovereign upgrade 将未验证的资源引用直接激活为自治运行事实

| 字段 | 记录 |
| --- | --- |
| 模块 | SFL sovereign upgrade / Web Member API / deployment-resource boundary |
| 类型 | 架构边界、配置真实性、发布与运营安全 |
| 严重级别 | **P2** |
| 置信度 | 高 |
| 文件和精确位置 | `02_platform_pingtai/database/supabase/migrations/20260912050000_create_sfl_sovereign_upgrade.sql:177-198,200-417`；`01_core_hexin/services/commerce/src/modules/member/03_application_yingyong/SovereignUpgradeOperation.ts:7-35`；`MemberOperations.ts:31-32`；`WebMemberOperations.ts:22-23`。 |
| 当前/预期 | 当前 Web member operation将调用者提供的五个 domain host及 edge/tunnel/gateway/runtime/data/secret/payment/callback refs直接传入 security-definer function。function只做非空、trim、host format/distinct和数据库 context/idempotency检查，随后写 candidate binding/resource/manifest并在同一事务改为 active、将 node升级为 sovereign、将 Realm host置空。预期为 sovereign state 只在受控 provisioner 已验证每项资源存在、归属、可达性、环境匹配和可回滚后激活，或至少保持为 pending/awaiting-verification。 |
| 直接证据 | [FACT][E-AU-691-001] SovereignUpgradeOperation直接暴露为 `member.sovereignty.upgrade` Web/Member operation；[FACT][E-AU-691-002] migration lines 235-244 仅校验 JSON/host格式，300-387 将请求 refs写入 binding/manifest并设置所有状态 active；[FACT][E-AU-691-003] lines 369-380 同事务更改 node sovereignty 和 Realm host；[FACT][E-AU-691-004] 全仓 non-test source 对 `organization.domainbindingset`、`noderesourcebindingset`、`nodemanifestversion`和 sovereignty-upgraded event检索无外部 provisioner/receipt/verification consumer命中。 |
| 调用链或运行入口 | Web/Storefront request → `member.sovereignty.upgrade` → SovereignUpgradeOperation → MemberPort → `organization.upgrade_hosted_mall_to_sovereign` → node/Realm/binding/manifest/outbox state。 |
| 用户影响 | 用户可得到“升级成功”的 201/active state，但关联域名、edge、payment callback或运行身份若不存在/归属错误，后续访问和支付回调可能不可用或导向错误环境；生产影响范围未验证。 |
| 数据影响 | 写入 active sovereign topology、binding和manifest事实，随后需要 privileged rollback function才能恢复 hosted host relationship；不涉及本审计中发现的直接业务数据删除。 |
| 安全影响 | 未验证的 host/resource reference被标记为 active，可能把恶意或错误的回调/域名/secret binding reference纳入受信任配置面。当前未证明外部系统已消费或存在攻击利用。 |
| 根因 | domain/resource bindings被建模为 DB references，但资源验证、部署 receipt和激活授权不在同一可审计事务或仓内运行消费者中；state machine把“写入引用”当作“资源就绪”。 |
| 建议方向 | 从当时最新 `zdt-next` 建立独立 sovereign-upgrade activation batch：分离 request/pending 与 activation；仅受控 Provisioning API 可写 resource receipts，校验每项 ref 的 owner/environment/health/rollback metadata 后才激活 node/Realm/bindings；Web action只提交请求或受限审批。保留现有 rollback 路径，不改写历史 migration。 |
| 预计修改范围 | 新前向 migration、Provisioning API command/receipt model、runtime operation capability调整、最小 integration contract及 release/operations documentation。 |
| 验证方式 | 隔离环境模拟缺失/错 owner/错环境/不健康 resource reference，断言不能转 sovereign；受控 provisioner 生成全部验证 receipt 后才允许 activation；验证 upgrade/rollback、不产生未消费的 active bindings和真实 entry/callback routing。 |
| 回滚方式 | 新批次先保持 existing hosted state；已错误升级的 node通过现有 privileged `rollback_sovereign_upgrade` 和经核验的部署恢复流程逐个处理，禁止批量回滚。 |
| 是否需要独立复核 | 是；复核者必须独立查看外部 Provisioning、阿里云/DNS/edge/支付资源的真实 preflight 与 receipt，并确认不存在仓外 active-binding consumer。 |

## F-0282｜供应网络汇总以调用参数绕过数据库 scope/RLS 边界

| 字段 | 记录 |
| --- | --- |
| 模块 | Catalog supplier network / Console-Web API / pricing-inventory-partner database boundary |
| 类型 | 身份与权限、数据可见性、数据库运行契约 |
| 严重级别 | **P2** |
| 置信度 | 高（仓内调用、会话 context、function body、grant 与测试直接证据；生产 role attributes 未验证） |
| 文件和精确位置 | `02_platform_pingtai/database/supabase/migrations/20260912120000_create_zhudatuan_supplier_network.sql:171-244`；`01_core_hexin/services/commerce/src/modules/catalog/03_application_yingyong/CatalogOperations.ts:98-115`；`01_core_hexin/services/commerce/src/modules/webbusiness/WebCatalogOperations.ts:20-37`；`01_core_hexin/services/commerce/src/foundation/infrastructure/DatabaseContext.ts:10-14`；`SupplierNetworkMigration.test.ts:41-49,69-76`。 |
| 当前/预期 | 当前 `console_supply_network(p_scope)` 是 `security definer`、`row_security=off`，接受两个 runtime role execute；其 supplier、agreement、pricing、inventory、reservation 与 source listing 汇总只以 `p_scope` 比对。调用 action 的确从认证 `access.scope.id` 传值，且 API transaction 会设置 `app.scope_id`，但函数没有用 `access.scope_allowed(p_scope)` 或 `current_setting('app.scope_id')` 将参数绑定到当前授权会话。预期为数据库读边界同时拒绝越权/错 scope，不能仅依赖特定 application action 永远正确传入 scope。 |
| 直接证据 | [FACT][E-AU-692-001] Console `SupplyChainPrefetch` 只以 `catalog.listings.read` capability 请求 `view=supply-network`，两套 Catalog action均调用 function并传 `access.scope.id`；[FACT][E-AU-692-002] API context 设定 `app.scope_id`，普通 relation通过 `access.scope_allowed` 作为 RLS predicate；[FACT][E-AU-692-003] function lines 171-175 设为 definer/RLS-off，193/197/207/210/212/213/221 均只由 `p_scope` 限制；[FACT][E-AU-692-004] lines 242-244 只向 identity/web API role grant execute；[FACT][E-AU-692-005] migration test fixture 把 `access.scope_allowed` 固定为 `true`，仅以默认 session 调同一 Mall happy path，未执行 runtime role/RLS/deny matrix。 |
| 调用链或运行入口 | Console supply-chain panel → `GET catalog.listings.read?view=supply-network` → Catalog/Web Catalog action → API DB transaction context → `catalog.console_supply_network(access.scope.id)` → partner agreement、price、stock/reservation/source aggregation。 |
| 用户影响 | 一旦任一调用方、scope resolver、连接 role 或后续 function consumer传入错误 scope，控制台可得到其他 scope 的供应方名称、协议编号/能力、价格区间、可售库存、库存价值和同步时间；当前未证明已有越权请求或生产泄露。 |
| 数据影响 | 本函数只读，不直接改写商品、协议、价格或库存；错误数据可见性会影响采购、运营和库存决策。 |
| 安全影响 | `row_security=off` 令 PostgreSQL 不再作为 defense-in-depth 层；两个有 execute 权限的 service role 能以任意参数读取函数覆盖的 scope facts，取决于应用层不发生 scope propagation 错误。 |
| 根因 | 跨 schema 汇总为简化 RLS 采用 security-definer/RLS-off，但没有把 session authorization 校验、最小 function contract 与真实 role execution test作为同一边界的一部分。 |
| 建议方向 | 从当时最新 `zdt-next` 建立独立 supplier-network read-boundary batch：先确认该 projection 是否应只对 console/operator开放；然后在函数开头以当前 session scope/`access.scope_allowed(p_scope)` fail closed，或以无 definer 的 narrow view/RLS query替代。将 execute 收窄到实际运行 role，并增加正式 migration runner 下的 same-scope allow、cross-scope deny、no-capability/no-role deny 和 direct invocation contract；不要改写此历史 migration。 |
| 预计修改范围 | 新前向 Supabase migration、最小 ACL/RLS/function contract test；必要时 Catalog action 仅做明确 capability gate。不得混入商品、协议、价格或库存数据修改。 |
| 验证方式 | 隔离 PostgreSQL 按基线 migrations，以 `zhudatuanidentityapi`、`zhudatuanwebapi`、无 execute role和相同/不同 `app.scope_id` 分别执行 function：仅授权 scope应得到 projection，越权/空 scope必须拒绝或空结果；核对不扩大 relation table grants。 |
| 回滚方式 | 回退独立前向 function/policy/grant migration至上一个受控版本；不删除供应方、协议、商品或库存记录。 |
| 是否需要独立复核 | 是；复核者必须独立检查 connection pool 的实际 role/session context、function owner/BYPASSRLS 与 production `pg_policies`，并重跑跨 scope contract。 |

## F-0283｜供应商报表的“净成交额”与退款率跨期且入口间口径不一致

| 字段 | 记录 |
| --- | --- |
| 模块 | Supplier analytics / Reporting-Web API / Console cockpit |
| 类型 | 正确性、财务/运营指标契约、时间窗口 |
| 严重级别 | **P2** |
| 置信度 | 高（SQL 聚合、UI 标签、调用入口和现有测试均为直接证据；最终业务会计口径需 Owner 确认） |
| 文件和精确位置 | `02_platform_pingtai/database/supabase/migrations/20260912130000_create_supplier_analytics_perspective.sql:26-107,150-231`；`01_core_hexin/apps/console/src/feature/cockpit/CockpitMetrics.tsx:8-17`；`01_core_hexin/services/commerce/src/modules/reporting/03_application_yingyong/query/GetDashboard.ts:20-45`；`SupplierNetworkMigration.test.ts:51-65`。 |
| 当前/预期 | 当前 cockpit 的 `current_totals` 与 `previous_totals` 直接加 `ordering.line.total_minor`，`periodSalesCents` 和 `netSalesRatio` 据此返回；Console 将其显示为“净成交额”或“供应成交额”。但 completed refunds 无 period 条件：`completed_refunds` 汇总所有历史 completed aftersale，`refundedCents`/`refundRate` 亦用全历史 totals。并且 `supplier_metric_rows('sales')` 则从请求 period 内订单总额减去这些订单关联的所有 completed aftersale。预期为一个明确、可复算的订单发生期或退款完成期口径，并让 dashboard、supplier metric 与 UI 标签在同一 scope/period 下返回一致净额、退款额及环比。 |
| 直接证据 | [FACT][E-AU-693-001] cockpit `supplied_lines` 不限退款状态，current/previous totals lines 165-173只按订单 `created_at` 限期；[FACT][E-AU-693-002] completed_refunds lines 160-164、after-sales detail lines 177-180及 `refundRate` lines 224-228均无退款完成时间条件；[FACT][E-AU-693-003] supplier metric sales lines 52-64在已按订单期限制的 `supplied_lines` 上扣所有 completed refund；[FACT][E-AU-693-004] Console lines 8-14将 `periodSalesCents` 直接标作“净成交额/供应成交额”；[FACT][E-AU-693-005] migration test只构造无退款 happy path，未覆盖跨期 completed aftersale 或两个 projection 对同一事实的对照。 |
| 调用链或运行入口 | Console cockpit → `reporting.dashboard.read` → `GetDashboard` → `PgReportingRepository.cockpit` → `reporting.cockpit(scope,supplier,period)`；运营 reports → `reporting.*.read?supplierid=...` → `reporting.supplier_metric_rows(scope,supplier,dimension,period)`。 |
| 用户影响 | 供应商、运营人员可能看到标为“净成交额”的未扣退款订单额，同时看到跨历史退款率；跨期退款可令 dashboard 环比、退款率和 supplier sales report 对同一期间相互矛盾，影响履约/结算判断。当前未读取生产指标，未量化范围。 |
| 数据影响 | 查询投影不写订单、退款或结算；风险在于错误经营事实被展示、缓存和用于人工决策。 |
| 安全影响 | 未发现直接授权绕过；函数的 database scope 边界另见 F-0282。 |
| 根因 | supplier cockpit 与 metric projection 独立实现订单/退款聚合，退款没有统一的 event-time/window definition，UI 标签假定了净额而 SQL 保留了 gross/current 与 all-time refund 的混合语义。 |
| 建议方向 | 从当时最新 `zdt-next` 建立独立 reporting-metric semantics batch：先由财务/运营明确订单发生期与退款完成期、部分退款/多 aftersale 和 refunded order 的归属；再抽出共享 supplier totals/refund window，或采用 versioned reporting fact。同步修正 UI 文案/字段、缓存 projection version，并补跨期、部分退款、多行订单、supplier ownership变更及 dashboard-vs-metric 对账 contract；不要在 audit branch 改历史 migration。 |
| 预计修改范围 | 新前向 reporting SQL/function 或 projection、最小 Reporting/Console contract tests，可能的 API schema/UI copy；不改订单、退款或结算历史数据。 |
| 验证方式 | 隔离 PostgreSQL 建立相同 supplier 的 current/previous orders、current/late refunds、partial refund和multiple aftersale fixture；逐一断言两个 API response 的净额/退款/环比符合经确认口径，并验证 cache key/version在退款事件后失效。 |
| 回滚方式 | 将独立前向 projection/function版本回退到上一已验证 version；保留原始订单和aftersale事实，禁止用报表修复回写交易数据。 |
| 是否需要独立复核 | 是；复核者须独立确认业务会计口径、实际 refund completion timestamp/source 和 production reporting cache invalidation，再以同一 fixture 重算两个入口。 |

## F-0284｜Supplier four-flow 新 relation 的 Purchase API grant 未闭合至 RLS

| 字段 | 记录 |
| --- | --- |
| 模块 | Purchase API / Supplier four-flow ledger / database tenant boundary |
| 类型 | 数据可见性、最小权限、运行时正确性 |
| 严重级别 | **P2** |
| 置信度 | 高（migration DDL/grant/policy全链检索与运行写入直接证据；生产 role attributes未验证） |
| 文件和精确位置 | `02_platform_pingtai/database/supabase/migrations/20260912190000_create_supplier_four_flow_ledger.sql:3-306`；`20260913021500_align_purchase_supplier_flow_access.sql:6-30`；`PlaceOrder.ts:259-334`；`supplier_four_flow_business_contract.sql:215-285`。 |
| 当前/预期 | 当前 supplier relationship/contract/route/route step、supply offer、line route step、supplier reservation fact与fulfillment responsibility在新 migration中创建；后续对 Purchase API 直接 grant其查询/写入所需权限。全 migration 检索未找到上述 relation的 `ENABLE ROW LEVEL SECURITY` 或 `zhudatuanpurchaseapi` scope policy。当前 application query以 Mall/order参数约束，预期数据库也应按当前 Purchase Mall/member/order context拒绝跨 scope读取和写入，不能只依赖每个调用点不发生 scope propagation 错误。 |
| 直接证据 | [FACT][E-AU-701-001] four-flow migration创建 relation并只对 shopapp/job作 broad grant；[FACT][E-AU-701-002] later migration lines 24-30向 Purchase API授予 exact relation privileges；[FACT][E-AU-701-003] full migration set对这些 exact relation的 RLS enable/policy检索无命中；[FACT][E-AU-701-004] PlaceOrder把 route/leg/reservation/responsibility写入 Purchase order transaction；[FACT][E-AU-701-005] business contract测试 money conservation/snapshot/refund/rollback，但未 `set role zhudatuanpurchaseapi` 或断言 cross-Mall deny。 |
| 调用链或运行入口 | Checkout/Purchase API → QuoteReader/PlaceOrder → supply offer/partner route read → order line/suborder/route steps/reservation/responsibility writes；支付/退款→后续四流 facts。 |
| 用户影响 | 若 Purchase context、route resolver或未来调用者传错 Mall/order，数据库可允许读取供应合同、路线、成本/库存关联或写入其他 Mall 的 supplier facts；当前没有生产请求或泄露证据。 |
| 数据影响 | 跨 Mall write 可污染订单路径、预留/履约责任和后续财务归集；正常现有路径仍由 application filters/transaction约束，生产受影响范围未知。 |
| 安全影响 | 合同、供应关系、库存和成本相关事实缺少 RLS defense-in-depth；direct DB runtime role被误用或后续宽松 query可跨租户访问。 |
| 根因 | four-flow schema与 Purchase runtime grant分两次引入，ACL对齐了直接 query所需 relation但未同时将新表纳入 tenant/RLS policy和真实 role contract。 |
| 建议方向 | 从当时最新 `zdt-next` 建立独立 supplier-four-flow ACL/RLS batch：确认每张表的 Mall/order-derived scope owner，启用 RLS并为 `zhudatuanpurchaseapi` 仅建立所需 SELECT/INSERT/UPDATE policy（复杂 child tables可通过受控 parent order predicate/function）；缩小不需要的 grants，并补真实 role同 Mall allow/跨 Mall deny/rollback matrix。不要改写历史 migration或重写业务数据。 |
| 预计修改范围 | 新前向 Supabase migration、isolated PostgreSQL role/RLS contract，必要时 Purchase repository改为受控 function；不改订单、库存、付款或财务历史。 |
| 验证方式 | 基线 migration runner建立至少两个 Mall、supplier/offer/route/order fixture；以 `zhudatuanpurchaseapi` 执行 QuoteReader/PlaceOrder SQL，验证自己的 Mall/order allow、另一 Mall的 select/insert/update必须无行或拒绝；同时验证 payment/refund/finance job roles未丢失必要路径。 |
| 回滚方式 | 独立前向 policy/grant migration回退到上一个 verified narrow版本；不删除四流事实，已写错误数据另建逐笔修复计划。 |
| 是否需要独立复核 | 是；复核者需独立检查 `pg_class.relrowsecurity`、`pg_policies`、Purchase connection role/inheritance及跨 Mall PostgreSQL execution结果。 |
## F-0285｜公司模板克隆以请求身份驱动，未绑定运行会话授权

| 字段 | 记录 |
| --- | --- |
| 模块 | SFL company template clone / Provisioning / Web API database boundary |
| 类型 | 身份与权限、租户/Realm 边界、特权数据写入契约 |
| 严重级别 | **P2** |
| 置信度 | 高（function body、grant、application adapter、SQL contract与PG17 execution为直接证据；生产 session/role部署细节未验证） |
| 文件和精确位置 | `02_platform_pingtai/database/supabase/migrations/20260912200000_create_sfl_company_template_clone.sql:88-220,227-359`；`01_core_hexin/services/commerce/src/modules/provisioning/03_application_yingyong/CloneCompanyTemplate.ts:4-12,58-93`；`CompanyTemplateCloneWorkflow.ts:8-18`；`sfl_company_template_clone_contract.sql:27-46,207-309`；`04_tools/scripts/check/sfl-company-template-clone.pg17-fixture.mjs:44-45`。 |
| 当前/预期 | 当前 `security definer` function 接受 request 中的 `source_realm_id`、`source_membership_id` 与 `requested_by`，并验证它们能连接到同一 active source operator membership/account；但未读取或校验当前 connection 的 actor、membership、scope、capability 或 workload。`CloneCompanyTemplate` 同样直接序列化该输入，function则直接授予 `zhudatuanwebapi` execute。预期是调用者不能仅凭已知的有效 source identifiers 冒充源 operator；数据库/API 边界应将请求身份与已认证运行上下文绑定并 fail closed。 |
| 直接证据 | [FACT][E-AU-702-001] migration 99-105 从 JSON取全部 source identity字段，185-220只把它们互相 join验证；函数唯一读取的 session setting是测试注入 `sfl.company_template_clone_interrupt`（129），未出现 actor/membership/scope authorization check；[FACT][E-AU-702-002] 358-359 revoke public后向 `zhudatuanwebapi` grant execute；[FACT][E-AU-702-003] adapter 60-69逐字转发 application input，workflow 16-17只委托；[FACT][E-AU-702-004] SQL contract以默认 fixture身份反复传入 source operator identifiers，覆盖成功/replay/rollback但未 `set role zhudatuanwebapi`、未设置/篡改 session identity或断言 mismatch deny；[FACT][E-AU-702-005] `npm run check:sfl-company-template-clone` 在 2026-09-15通过，证明拓扑与事务契约，不证明真实 API role/session authorization matrix。 |
| 调用链或运行入口 | 潜在 Web/API provisioning request → `CompanyTemplateCloneWorkflow` → `CloneCompanyTemplate` → `organization.clone_company_template(jsonb)` → enterprise/Mall/Realm/node/account/membership/scope/pool/application/pending-binding/outbox writes。固定基线未发现该 workflow 的注册 route/operation consumer；function的 direct Web API execute grant仍构成可调用数据库边界。 |
| 用户影响 | 错误接线、连接池 session丢失或获得 Web API DB调用能力的调用者，可能以任一已知有效 source operator membership/principal创建新的独立 company/Mall/Realm拓扑及其 target membership；当前无已发生越权克隆证据。 |
| 数据影响 | 会生成新的 organization、identity、access、catalog/experience 和 pending binding记录；设计上不复制业务订单、支付、财务、履约、库存、会话或凭据，且不执行基础设施动作。 |
| 安全影响 | 高权限 definer write surface把身份主张留给可控 JSON参数，缺少数据库层的 session principal/capability binding；可形成 source operator impersonation和未授权租户拓扑创建。 |
| 根因 | 克隆 SQL已实现 source 数据一致性和事务边界，但把“请求中说自己是谁”当成了授权事实；应用 adapter没有从认证 context派生不可伪造字段，验收也未将 real runtime role/session denial作为契约。 |
| 建议方向 | 从当时最新 `zdt-next` 新建单一 SFL clone-authorization batch：先定义允许发起 clone的 operator capability和可信 API context；再由受认证 request派生 source realm/member/principal，SQL对 current session/受控 capability进行 fail-closed match，或收紧为仅受控 command function可调用。补 same actor allow、different actor/member/source deny、empty session deny、idempotent replay和rollback的真实 role contract；不要修改本审计分支或历史 migration。 |
| 预计修改范围 | 一项前向 Supabase authorization migration、Provisioning command/API context adapter、最小 PostgreSQL role/session integration contract；不改变克隆业务拓扑模板、不批量处理既有 clones。 |
| 验证方式 | 隔离 PostgreSQL按正式 connection role设置 session actor/membership/scope；用授权 source operator得到一次 clone，用不同 actor、不同 membership、跨 Realm source、无 session和无 execute role分别验证拒绝；确认成功路径仍保持0基础设施动作、无业务历史复制、replay和注入rollback。 |
| 回滚方式 | 回退独立的 function/grant/policy前向版本至上一个已验证的受控边界；不要删除已有 clone或pending binding，异常创建记录另建逐项处置计划。 |
| 是否需要独立复核 | 是；复核者须独立核对生产 connection-pool role/session setter、function owner/BYPASSRLS、API route/operation registration及真正调用者，并亲自执行 mismatch matrix。 |
## F-0286｜Catalog 媒体 worker 对供应方 URL 直接发起无限制请求

| 字段 | 记录 |
| --- | --- |
| 模块 | Catalog source projection / media replication job / network egress |
| 类型 | 安全、外部输入验证、Worker 网络边界 |
| 严重级别 | **P2** |
| 置信度 | 中高（source parsing、job payload和direct fetch为直接证据；provider payload来源与生产网络egress policy未验证） |
| 文件和精确位置 | `01_core_hexin/services/commerce/src/modules/catalog/03_application_yingyong/CatalogSourceProjection.ts:23-25,36-50,94-100,128-137`；`05_interface_jieru/job/CatalogMediaReplicationJob.ts:46-65,80-95`；`CatalogMediaReplicationJob.test.ts:8-69`。 |
| 当前/预期 | 当前 Cake source的 `imagePaths` 仅要求非空字符串，原样写入 job；worker依次执行 `fetch(sourceUrl)`，只检查HTTP ok和非空 bytes。没有 scheme/host allowlist、DNS/IP private-range防护、redirect policy、content-type allowlist或最大响应尺寸。预期是只允许明确可信的 HTTPS media origin，并在每次 redirect后验证解析地址/host，拒绝私网、link-local、loopback与非图片/过大响应。 |
| 直接证据 | [FACT][E-AU-703-001] `cakeSource` 仅用 `stringArray`解析 `imagePaths`，projection同时把第一项直接放入 product attributes；[FACT][E-AU-703-002] lines 50-64对每项调用 native `fetch`，无 `URL`解析/host policy/size limit，header仅作为最终 content type默认值；[FACT][E-AU-703-003] job unit tests仅覆盖404 fallback、all unavailable、replication incomplete和payload结构，未包含被拒绝的 URL或redirect；[FACT][E-AU-703-004] 定向 Vitest在本基线因 `vitest: command not found`（exit 127）未启动。 |
| 调用链或运行入口 | Cake catalog payload → `CatalogSourceProjection.project` → `runtime.job(kind=catalogmediareplication)` → Catalog worker `QueueJob` → `CatalogMediaReplicationProcessor.download` → worker network fetch。 |
| 用户影响 | 恶意或被污染的供应方图片地址可使后台 job请求内部服务、metadata/控制平面或不预期第三方；也可能以超大响应耗尽 worker网络/内存。当前无实际攻击或生产网络可达性证据。 |
| 数据影响 | 成功响应可被复制为产品媒体并发布 cover URL；失败通常进入job retry。 |
| 安全影响 | 形成 SSRF/非预期 egress surface，实际严重性取决于 worker网络、DNS和provider payload信任链。 |
| 根因 | 将外部 catalog图片字段当作可直接下载的可信 URL，下载组件没有独立网络安全契约。 |
| 建议方向 | 从当时最新 `zdt-next` 新建单一 media-egress hardening batch：在入队或下载前使用统一 URL policy（HTTPS、provider allowlist、redirect revalidate、private/link-local/loopback deny、timeout/size/content-type cap），将拒绝原因可观测地记为不可重试或受控重试，并补 egress tests。不要在本审计分支修改 worker、provider或对象存储配置。 |
| 预计修改范围 | Catalog media URL validator/downloader、最小 job error classification和定向 unit/integration tests；可能需要受控 provider origin configuration。 |
| 验证方式 | 隔离 worker以允许来源、HTTP、file/data、localhost、127.0.0.1、IPv6 loopback、private/link-local、DNS rebinding模拟、跨 host redirect、oversize及非image responses运行；仅允许来源可复制，其他均无网络请求或明确拒绝且不发布 product binding。 |
| 回滚方式 | 回退独立 downloader policy版本或临时只保留已验证 provider allowlist；不删除既有media object/replica/binding，失败重试另行受控。 |
| 是否需要独立复核 | 是；安全复核者必须独立确认生产 egress、DNS resolver、HTTP redirect行为、provider origin ownership和对象存储凭据隔离。 |

## F-0287｜媒体复制队列乱序完成可用旧供应方图片回退最新封面

| 字段 | 记录 |
| --- | --- |
| 模块 | Catalog source projection / media replication queue / product media persistence |
| 类型 | 正确性、并发、异步幂等与最终一致性 |
| 严重级别 | **P2** |
| 置信度 | 高（job identity、worker concurrency、upsert/write SQL和测试覆盖缺口均为直接证据） |
| 文件和精确位置 | `CatalogSourceProjection.ts:94-100`；`CatalogJobsRuntime.ts:208-216`；`CatalogMediaReplication.ts:49-73`；`PgCatalogMediaPersistence.ts:18-40,50-64`；`CatalogProductMediaRegistration.ts:28-52`；`CatalogMediaReplicationJob.ts:26-44`；`CatalogMediaReplicationJob.test.ts:8-69`。 |
| 当前/预期 | 当前 job id包含 `product + imagePaths`，故source图片变化生成不同 job；媒体 QueueJob并发为2。旧/新job同时运行时，replication以固定的 `media:hash(product:purpose)` identity写同一 media row，persistence对 media/binding执行无版本的 upsert，processor最终无条件覆盖 `catalog.product.attributes.coverUrl`。预期是只允许与当前 source revision/active job相符的完成结果发布，旧job完成应被丢弃或成为无副作用的历史记录。 |
| 直接证据 | [FACT][E-AU-703-005] projection 94以source URL集合创建 job id，100仅对相同id `on conflict do nothing`，并未使旧id失效；[FACT][E-AU-703-006] runtime 208-216为该 kind启用 processor且 concurrency=2；[FACT][E-AU-703-007] replication 51固定 media id为 product+purpose，persistence 22-24/36-38和53为无条件 conflict update，processor 39-43无 source revision/product version predicate更新cover URL；[FACT][E-AU-703-008] 现有测试没有 source连续更新、两个job逆序完成或CAS拒绝旧结果情形，且本次定向Vitest未能启动。 |
| 调用链或运行入口 | Provider source update → CatalogSourceProjection enqueue old/new media jobs → two concurrent `catalogmediareplication` workers → object replication/persistence → productmedia binding + `catalog.product.attributes.coverUrl`。 |
| 用户影响 | 商品图片更新后，较慢的旧任务可重新显示旧封面/媒体，造成陈列与供应方当前商品不一致；若有内容合规或价格关联图，运营判断会受误导。 |
| 数据影响 | `mediaobject`、replica状态、`productmedia`和product attributes可被旧结果覆盖；对象存储会留下未再引用的新/旧对象。 |
| 安全影响 | 非主要安全问题；但过时媒体可能绕过业务侧对最新供应资料的人工复核。 |
| 根因 | job去重使用内容地址但发布使用 product+purpose共享状态，缺少source revision、supersession/cancellation或compare-and-set边界。 |
| 建议方向 | 从当时最新 `zdt-next` 新建单一 media-publication-ordering batch：把source revision/expected media job或hash随job保存，发布时对当前声明做条件更新；新的source更新应 supersede/mark stale旧job，media history可保留但不得回写current binding。补受控 retry、并行/逆序完成与rollback contract。 |
| 预计修改范围 | runtime.job payload/metadata及索引或前向 migration、Catalog projection/processor/persistence条件写、最小 concurrency tests；不改历史商品媒体。 |
| 验证方式 | 为同一product写入A/B两批source job，故意令A最后完成；断言product cover、productmedia和current media hash保持B，A可记录为stale但不得改写；重跑同一B验证幂等，注入失败验证不破坏已有ready binding。 |
| 回滚方式 | 回退独立条件发布版本，保留media/replica事实；对错误回退的当前封面用受控最新source重排队恢复，禁止批量删除对象。 |
| 是否需要独立复核 | 是；复核者必须独立阅读QueueJob claim/lease并发语义、source更新写入路径、数据库事务边界和对象存储不可逆性，并亲自完成逆序job测试。 |
## F-0288｜HBBTZN Storefront L6 回填会激活非 active membership，且单一无密码成员可阻断整笔迁移

| 字段 | 记录 |
| --- | --- |
| 模块 | HBBTZN Storefront identity migration / hosted member registration |
| 类型 | 数据迁移、身份状态、可恢复性 |
| 严重级别 | **P2** |
| 置信度 | 高（target query、registration function body及transaction assertion为直接证据；生产数据状态未验证） |
| 文件和精确位置 | `02_platform_pingtai/database/supabase/migrations/20260913020500_backfill_hbbtzn_storefront_member_l6.sql:21-60,65-83`；`20260912020000_create_sfl_member_registration_progression.sql:108-128,165-175,225-279`。 |
| 当前/预期 | 当前 backfill选择固定 Mall所有无 registration的 `client='storefront'` membership，未检查 membership status；每个目标必须找到 active password credential，否则抛 `HBBTZN_STOREFRONT_MEMBER_L6_IDENTITY_MISSING`。外层 migration transaction因此整体回滚，且注册函数本身未验证目标 membership active。预期是只对明确 active、可登录且符合业务身份条件的成员创建 active L6 identity topology；异常对象须形成可复核清单或按预先批准策略单独处置，而非使全部历史回填不可执行。 |
| 直接证据 | [FACT][E-AU-707-001] target query 27-38仅以 Mall、`client='storefront'`和没有 registration筛选；[FACT][E-AU-707-002] 40-42对空/非64位 active password credential直接 raise；[FACT][E-AU-707-003] registration function 236-254无 membership status join即创建 active consumer Realm/node，262-273写 registration；[FACT][E-AU-707-004] assert 67-77同样检查全部 Storefront membership而非仅 active集合，故不能把inactive对象安全排除；[FACT][E-AU-707-005] migration有 begin/commit，任一 raise会回滚前序写入。 |
| 调用链或运行入口 | Supabase migration runner → fixed HBBTZN Mall target enumeration → `organization.register_hosted_member_node` → identity Realm、organization node/relation、member node registration。 |
| 用户影响 | 含历史禁用成员时可生成不应活动的 consumer topology；含仅 federated/无active password成员时，全部合格成员也无法完成该次回填。当前未证明生产数据满足任一条件。 |
| 数据影响 | 可能新增 active Realm/node/registration与已停用 membership不一致；失败路径为事务性回滚而非局部半完成，但缺少可操作的遗漏记录。 |
| 安全影响 | inactive membership自身仍可能被 session/login状态检查阻止使用；但 active node/Realm拓扑会扩大数据和治理面，并提高后续错误接线的风险。 |
| 根因 | 历史回填把“所有无 registration membership”与“可注册 active consumer身份”视为同一集合，并将 credential缺口作为全局硬失败。 |
| 建议方向 | 从当时最新 `zdt-next` 新建独立 HBBTZN registration reconciliation batch：先以只读报告确定 active/disabled/federated/password缺失集合与已登记节点；明确定义可回填资格，针对不合格项写不可变 exception receipt或经授权的补齐流程。使用前向可重入 reconciliation，不改写此历史 migration。 |
| 预计修改范围 | 新前向 migration或受控 reconciliation command、最小 exception ledger/contract及数据所有者审批；不得批量删除现有 Realm/node/registration。 |
| 验证方式 | 隔离 PostgreSQL构造 active password、inactive password、active federated-only、revoked password与已registered成员；验证仅允许集合创建L6，异常集合明确报告且不会阻断其它允许对象；重复运行幂等、注入失败不留orphan Realm/node。 |
| 回滚方式 | 对错误创建的单条 Realm/node/registration先审计实际登录/关系/业务引用，再走独立受控反向迁移；不可直接删除历史 identity topology。 |
| 是否需要独立复核 | 是；复核者需独立查看 HBBTZN生产 membership/credential/registration分布、migration execution receipt、node/realm references和身份状态语义。 |
## F-0289｜HTTP 的 checkout 延后手机验证与现行 registration trigger 契约漂移

| 字段 | 记录 |
| --- | --- |
| 模块 | Identity Registration / Storefront L6 / database write trigger |
| 类型 | 正确性、身份验证、前后端/数据库契约 |
| 严重级别 | **P2** |
| 置信度 | 高（HTTP branch、当前 trigger定义和历史 trigger语义均为直接证据；生产请求使用率未验证） |
| 文件和精确位置 | `01_core_hexin/services/commerce/src/modules/identity/05_interface_jieru/http/RegistrationOperations.ts:178-185,212-215`；`02_platform_pingtai/database/supabase/migrations/20260904010000_allow_platform_owner_l6_registration.sql:78-198`；`20260911190000_bind_operator_registration_to_realm_console.sql:20-148`。 |
| 当前/预期 | 当前 HTTP registration在 Storefront 且 request body `phoneVerification='checkout'` 时不调用 `consumeChallenge`，并设置 `app.registration_phone_verification=checkout`。0401的旧 trigger曾将该 setting作为 deferred phone proof；但现行 111900 create-or-replace trigger只以 `challenge.consumed_at>=transaction_timestamp()` 计算 registration_allowed，未读取该 setting。因此后续 membership/role/scope write会拒绝请求。预期是该公开输入模式要么在入口被明确拒绝并返回稳定业务错误，要么 current database trigger和完整验证流程支持它；不能静默跳过OTP后才在DB边界失败。 |
| 直接证据 | [FACT][E-AU-709-001] HTTP 180定义 deferred branch，181-185跳过 challenge consume，212-215写两个 app settings；[FACT][E-AU-709-002] 0401 163-166以 `registration_phone_verification='checkout'` 允许 deferred proof；[FACT][E-AU-709-003] 111900 93-113只查询已消耗 registration challenge，112-118将 registration_allowed限定为 invite role与challenge成功，且function body无该 phone setting；[FACT][E-AU-709-004] L6 test覆盖 challenge accepted 正常路径，未覆盖 deferred branch对 current database trigger的行为。 |
| 调用链或运行入口 | Storefront registration HTTP request → `RegistrationOperations` → transaction `app.registration_mall_id`/可选 phone setting → identity/account/membership/role/scope writes → `access.protect_zhudatuan_registration_access_write` current trigger。 |
| 用户影响 | 请求带该可接受值的 Storefront注册用户可能在OTP被跳过后收到低层 registration boundary失败，而非完成注册或获得明确可恢复提示。 |
| 数据影响 | trigger拒绝应使当前 transaction回滚，正常情况下不会留下部分 identity/membership写入；实际 transaction wrapper和错误映射仍待运行验证。 |
| 安全影响 | 当前数据库 fail-closed，不构成OTP绕过；风险是API公开语义与数据库授权不一致，未来若误恢复豁免可能产生未审查的身份验证降级。 |
| 根因 | 后续 operator Realm/console trigger replacement没有保留或显式废弃早期 L6 checkout-deferred phone-verification contract，HTTP entry仍保留旧开关。 |
| 建议方向 | 从当时最新 `zdt-next` 建立单一 registration-phone-verification contract batch：产品/安全Owner先决定是否允许 deferred checkout；若不允许，在 HTTP schema/handler先拒绝并移除无效 setting；若允许，设计可验证且不可绕过的 checkout proof/回执，再以最小前向 trigger/API test对齐。不要在审计分支或历史 migration中改写。 |
| 预计修改范围 | Identity API request validation/registration flow、必要的前向 access trigger/receipt schema和定向 PostgreSQL+HTTP contract；不批量改变现有 credentials/memberships。 |
| 验证方式 | 在完整基线 migration head，以真实 Identity API role测试 OTP success、missing OTP、`phoneVerification=checkout`、operator invite和Owner Storefront；断言每个路径的HTTP code/业务码、事务原子性、challenge状态和未产生越权membership。 |
| 回滚方式 | 回退独立入口/trigger contract版本；对已失败请求不需要数据回滚，对未来引入的 deferred proof须保持可撤销/过期。 |
| 是否需要独立复核 | 是；复核者必须独立阅读 mobile/checkout 产品流程、actual client payload、trigger replacement链和完整 transaction error mapper。 |
## F-0290｜Mall Owner provisioning function 未绑定 Mall 输入关系与当前会话授权

| 字段 | 记录 |
| --- | --- |
| 模块 | Mall Provisioning / L1 Owner / database authorization boundary |
| 类型 | 身份与权限、数据完整性、特权写入契约 |
| 严重级别 | **P2** |
| 置信度 | 高（function body、grant、adapter和当前 CreateMall caller为直接证据；生产 provisioning role/session未验证） |
| 文件和精确位置 | `02_platform_pingtai/database/supabase/migrations/20260906010000_add_l1_owner_role_and_named_scope.sql:46-92`；`01_core_hexin/services/commerce/src/modules/provisioning/01_public_gongkai/MallOwnerProvisioningPort.ts:21-70`；`03_application_yingyong/CreateMall.ts:73-100`。 |
| 当前/预期 | 当前 `access.provision_mall_owner` 只验证 source operator membership与principal匹配；它不验证 `p_organization`/`p_scope`/`p_mall` 相等或合法关联、不验证目标是 active Mall/parent hierarchy，也不读取 current session actor/scope。随后直接插入 operator membership、L1 role、三类 scopegrant与 mallowner。正常 CreateMall确实传相同 `plan.mall` 三值。预期是特权 DB function自行拒绝不一致/未授权 Mall输入，而非依赖所有 current/future callers永远正确传值。 |
| 直接证据 | [FACT][E-AU-713-001] function 59-65唯一输入校验是 source operator/profile/principal；67-88按各自独立参数写 role/membership/role assignment/scope grants/mallowner；[FACT][E-AU-713-002] function为 `security definer`，provisioning runtime声明其 execute依赖；[FACT][E-AU-713-003] adapter 59-66原样传入六个参数；[FACT][E-AU-713-004] CreateMall 93-100为正常路径固定 `organization=scope=mall=plan.mall`，因此未证明当前调用已越权但也不能替代数据库校验。 |
| 调用链或运行入口 | Mall provisioning command → CreateMall creates organization/pool/application → MallOwnerProvisioningPort → `access.provision_mall_owner` → access membership/role/scopegrant/mallowner writes。 |
| 用户影响 | 错误接线、后续调用者缺陷或获得 Provisioning API DB调用能力者可将一个合法 source operator写成任意目标组织/范围/Mall的 owner，或写入内部不一致的 owner关系；当前未发现生产实例。 |
| 数据影响 | 可污染 membership、role assignments、scope grants和 mallowner topology；后续 scope/owner resolvers可能得到错误治理结果。 |
| 安全影响 | security-definer write boundary未对目标资源/调用者做 defense-in-depth，造成潜在 owner elevation与跨 Mall治理越权。 |
| 根因 | 函数把 application preflight/plan正确性当作授权事实，未把目标 Mall identity、组织关系和 session capability纳入数据库 contract。 |
| 建议方向 | 从当时最新 `zdt-next` 新建单一 Mall-owner provisioning authorization batch：定义可发起 owner provisioning的 authenticated capability，函数内验证 active Mall、`organization=scope=mall`、parent/tenant relationship、source actor和session scope，再执行写入；必要时收窄 direct function execute。不得修改本审计分支或历史 migration。 |
| 预计修改范围 | 前向 Supabase function/grant migration、Provisioning API session-context adapter、最小 role/transaction contract；不批量重写 existing mallowner。 |
| 验证方式 | 隔离 PostgreSQL以 provisioning role执行相同 Mall成功、不同 organization/scope/mall、inactive/non-Mall、foreign actor/source及无 session均拒绝；断言失败 transaction没有 membership/role/scopegrant/mallowner残留，并验证 CreateMall正常preflight/rollback。 |
| 回滚方式 | 回退独立 function/grant version；对已发现的不一致 owner关系逐条审查并用单独数据修复流程处理，禁止批量删除。 |
| 是否需要独立复核 | 是；复核者必须独立检查 production function owner/BYPASSRLS、API connection/session context、Mall provisioning入口和现有 `mallowner` 数据关系。 |

## F-0291｜MORVIA 产品资产映射未与 Console/Storefront 的可追踪接入对齐

| 字段 | 记录 |
| --- | --- |
| 模块 | 视觉资产 / Auth、Console、Storefront 品牌交付 |
| 类型 | 文档与运行集成漂移、可维护性 |
| 严重级别 | **P3** |
| 置信度 | 高（固定基线的资产映射、生成脚本、全仓运行源码 import 均直接检索；仓外发布复制未验证） |
| 文件和精确位置 | `05_docs_ziliao/VI_shijue/current/ZHU-VI-1.5/PRODUCT-ASSET-MAP.md:3-17`；`01_core_hexin/apps/auth-web/src/screens/MorviaIdentityShell.tsx:2`；`IdentityAudienceSwitch.tsx:3`；`apps/auth-web/src/index.css:6`。 |
| 当前/预期 | 资产映射声明 Storefront、Console、Auth 共用同一母版；但固定基线仅有 Auth Web 直接导入白色 lockup、M 标记和字体，未发现 Console/Storefront 对 `ZHU-VI-1.5` 的源码 import、复制任务或发布 manifest。预期是该共享声明有可追踪的构建/发布消费者，或明确标为人工设计交付而非运行时集成。 |
| 直接证据 | [FACT][E-AU-715-001] 三个 Auth 源文件分别导入 SVG/字体；[FACT][E-AU-715-002] 对 `01_core_hexin`、`02_platform_pingtai`、`03_quality_ceshi`、`04_tools` 的资产包路径与 MORVIA asset 名称检索未得到 Console/Storefront 消费者；[FACT][E-AU-715-003] `PRODUCT-ASSET-MAP.md` 明确声称三端共用母版。 |
| 调用链或运行入口 | Auth Web bundle → `MorviaIdentityShell`/`IdentityAudienceSwitch`/CSS → 当前视觉资产包；Console/Storefront 的对应链在仓内未建立。 |
| 用户影响 | Console/Storefront 可在不触发代码审查或构建校验的情况下继续使用旧/不同品牌资产；当前生产显示是否已经漂移未验证。 |
| 数据影响 | 无。 |
| 安全影响 | 无直接安全影响。 |
| 根因 | 视觉资产包以文档和人工交付为中心，没有为三端声明建立统一的源码消费、复制或制品清单契约。 |
| 建议方向 | 后续单一品牌交付批次先确定三端是直接 import、受控复制还是仓外设计交付；为选定方式补最小可追踪 manifest/check，不在审计分支移动或删除资产。 |
| 预计修改范围 | 一个视觉交付 manifest 或各产品明确的资源接入点与定向验证；具体取决于产品实际发布模式。 |
| 验证方式 | 在独立分支检查 Auth、Console、Storefront 的实际构建输入和上线页面，断言选定资产版本/哈希一致；不以截图替代制品关系验证。 |
| 回滚方式 | 回退独立交付契约改动；保留现有资产包与已发布版本。 |
| 是否需要独立复核 | 否。 |

## F-0294｜阿里云运行模板使用无效 Kubernetes Deployment API 版本，且发布定位互相矛盾

| 字段 | 记录 |
| --- | --- |
| 模块 | Aliyun template delivery / release documentation |
| 类型 | 发布配置正确性、文档与控制面漂移 |
| 严重级别 | **P2** |
| 置信度 | 高（模板和仓内检查器为直接证据；当前正式发布消费者/集群实际对象未验证） |
| 文件和精确位置 | `02_platform_pingtai/infrastructure/aliyun/runtime.template.yml:1,86,97`；`DEPLOY-阿里云.md:14`；`02_platform_pingtai/infrastructure/projects_xiangmu/hbbtzn/README.md:43,52`；`04_tools/scripts/check/deployment.mjs:4-31`。 |
| 当前/预期 | 当前 runtime 模板把 Deployment/HPA target API 写为 `01_core_hexin/apps/v1`。Kubernetes 内置 Deployment 应使用 `apps/v1`；前者若直接渲染并 `kubectl apply` 会被 API discovery 拒绝。部署文档又把该模板称为配置真值，而 hbbtzn README 将同级 delivery 称为旧部署参考且禁止作为正式输入。预期是正式控制面只有一个明确、可解析且可追溯的模板来源。 |
| 直接证据 | [FACT][E-AU-735-001] runtime template 第 1、86、97 行均出现该无效 API 字符串；[FACT][E-AU-735-002] DEPLOY 文档第 14 行称 runtime/migration/delivery/backup 为配置真值；[FACT][E-AU-735-003] hbbtzn README 43、52 行称 `../../aliyun/delivery.yml` 是旧参考且不得直接作为正式发布输入；[FACT][E-AU-735-004] `check/deployment.mjs` 只拼接文件文本、检查 token，不解析 YAML 或向 Kubernetes API 验证。 |
| 调用链或运行入口 | 文档指定的 signed Release Bundle → `deploy.sh`/`SHOP_CUTOVER_CONTROLLER`（仓内实际 adapter 未在本 AU 验证）→ template render/apply；`check:deployment` 只能发现文本 token 缺失。 |
| 用户影响 | 若该模板仍被正式发布流程使用，发布会在启动 Api/Jobs 前失败；若已不使用，文档与静态检查会继续给维护者错误的发布真值。 |
| 数据影响 | 无直接数据写入；失败发布可能延长维护窗口。 |
| 安全影响 | 无直接权限提升；错误控制面会削弱发布前故障发现。 |
| 根因 | 旧通用 Aliyun/ACK 模板、hbbtzn 参考定位与现行 `zdt-next` 交付控制面没有收敛为一个明确 owner/source-of-truth，静态检查没有做 YAML/Kubernetes schema 验证。 |
| 建议方向 | 在最新 `zdt-next` 建立单一“release control-plane truth”治理批次：先确认正式 adapter 是否消费该模板；若消费，前向修正为 `apps/v1` 并添加离线 YAML/Kubernetes schema 定向验证；若不消费，将文档和检查器明确为历史/参考并从正式 gate 移除。不要在审计分支修改模板，也不要在未确认正式控制面的情况下删除。 |
| 预计修改范围 | 发布文档、受控 adapter/template、`check:deployment` 的解析性验证以及最小定向测试；不变更业务代码或线上资源。 |
| 验证方式 | 在隔离环境对选定正式模板做 render + Kubernetes dry-run/schema validation；验证 release adapter 的实际输入只指向该来源；在不执行生产 cutover 的情况下运行定向 check。 |
| 回滚方式 | 回退独立控制面变更；保留先前已签名制品和当前 active release 指针，禁止把审计分支用于部署。 |
| 是否需要独立复核 | 是；复核者必须独立检查当前 `zdt-delivery`/release adapter 输入、ACK API discovery、实际部署命令和生产集群发布证据。 |

## F-0295｜默认 staging README 仍提供绕过 Full 门禁的旧 PM2/Caddy 操作路径

| 字段 | 记录 |
| --- | --- |
| 模块 | Staging operations / release control-plane |
| 类型 | 文档与运行控制面漂移、发布安全 |
| 严重级别 | **P2** |
| 置信度 | 高（README 操作命令、legacy config 及 Full profile 的明确拒绝逻辑均为直接证据；实际是否仍有人按 README 操作未验证） |
| 文件和精确位置 | `02_platform_pingtai/infrastructure/zhudatuan/aliyun/staging/README.md:7-58`；`delivery.yml:6-18`；`ecosystem.config.cjs:3-51`；`ecosystem.full.config.cjs:3-5`；`PREPARE.md:11-23,97-118`。 |
| 当前/预期 | 默认 README 将本目录描述为隔离预发布入口，指导直接 `caddy reload` 与 `pm2 startOrReload`，使用 `/opt/zhudatuan-staging`、3101 和 default PM2 Api/Jobs；同目录 Full staging 已使用 `/opt/zhudatuan-staging-full`、九个 systemd unit、证据 P00–P12，并明确 Full 禁止 PM2。预期是操作者只有一个明确的正式候选入口，legacy profile 必须被清楚标注为历史/专项用途且不能与 Full 操作手册混淆。 |
| 直接证据 | [FACT][E-AU-744-001] README 7-11 定义非 full 路径，40-58 直接执行 Caddy reload 与 PM2 start；[FACT][E-AU-744-002] default delivery/PM2 config 同样绑定 legacy release root、3101、ApiMain/JobsMain；[FACT][E-AU-744-003] `check.mjs` 仍 require default ecosystem 和读取 delivery，证明其不是死文件；[FACT][E-AU-744-004] full ecosystem 在加载时直接抛出 systemd-only 禁令，PREPARE 11-23、97-118 将 full 启动置于 gate/授权与 fail-closed Full Jobs 之后。 |
| 调用链或运行入口 | 操作者阅读默认 README → 直接 Caddy/PM2 legacy profile；Full 操作者应走 PREPARE → candidate artifacts/evidence → `verify-readiness` → systemd/Caddy candidate 步骤。 |
| 用户影响 | 操作者可能把 legacy API/Jobs 当作当前 Full staging 启动方式，跳过候选制品、主机身份、数据库角色、ACL、负向路由与 Full Jobs 的明确停机边界。 |
| 数据影响 | legacy Jobs 若被错误启动，可能对其所配置的 staging DB/Redis/provider scope 产生异步写入；实际 host env 和运行状态未验证。 |
| 安全影响 | 直接 reload/PM2 路径绕开 Full profile 的 source=installed、DynamicUser、root-owned evidence 和 gate checks，增加配置误接线或非预期公开入口风险。 |
| 根因 | legacy staging profile 与 Full staging profile 同目录共存，但 README 的默认入口没有明确优先级/退役状态，仓内静态检查仍把 legacy config 当作有效输入。 |
| 建议方向 | 在最新 `zdt-next` 建立单一 staging control-plane clarification batch：先确认 legacy profile 是否仍有正式专项消费者；若有，给 README/配置加明确 profile/owner/禁止 Full 使用标识，并让入口按 profile 显式选择；若无，制定经运行证据验证的退役计划。不要在审计分支删除 PM2/Caddy 配置，也不要直接执行 README 命令。 |
| 预计修改范围 | 操作文档、profile manifest/check、可能的 legacy runner 保护或迁移说明；不改业务实现，不接触线上。 |
| 验证方式 | 独立分支确认实际 `zdt-delivery` 与 staging runbook 的唯一入口、目标主机运行单元和现有 PM2 inventory；分别验证 legacy 专项路径与 Full systemd path 不可交叉启动。 |
| 回滚方式 | 回退独立文档/control-plane 变更；保留当前 active release 与受控 legacy 配置，除非另获专门退役授权。 |
| 是否需要独立复核 | 是；复核者需独立检查当前 staging 主机的 PM2/systemd/Caddy 状态、发布控制面和实际操作者 runbook。 |

## F-0296｜Purchase 发布门禁仍锚定已移除的 `api.zhudatuan.com` Caddy block

| 字段 | 记录 |
| --- | --- |
| 模块 | Purchase release gate / Caddy routing |
| 类型 | 发布验证正确性、运行配置漂移 |
| 严重级别 | **P2** |
| 置信度 | 高（固定基线的 checker、Caddyfile 和定向执行失败为直接证据；实际在线 Caddy/购买流量未验证） |
| 文件和精确位置 | `04_tools/scripts/check/purchase-deployment.mjs:43,355-359`；`02_platform_pingtai/infrastructure/zhudatuan/aliyun/Caddyfile:97-111`。 |
| 当前/预期 | checker 用 `api.zhudatuan.com {` 到 `media.zhudatuan.com {` 截取 Caddy block，再断言 purchase routes 的 503 gate；当前 Caddy 已只有 `api.fufu.wang {`，因此 checker 在任何后续断言前抛 `CADDY_HOST_BOUNDARY_MISSING`。预期是 release gate 的 host boundary 与当前受控 Caddy 真值一致，或明确把该 gate 标为历史不可执行。 |
| 直接证据 | [FACT][E-AU-746-001] checker 43 使用硬编码 `api.zhudatuan.com`/`media.zhudatuan.com` marker；[FACT][E-AU-746-002] current Caddy 97 开始 `api.fufu.wang`，112 才有 media block，未含旧 marker；[FACT][E-AU-746-003] 在固定基线执行 `node 04_tools/scripts/check/purchase-deployment.mjs`，实际退出并报 `CADDY_HOST_BOUNDARY_MISSING`。 |
| 调用链或运行入口 | purchase release/pre-cutover verification → `purchase-deployment.mjs` → Caddy public-route/503 assertions；当前在 source parsing 阶段失败。 |
| 用户影响 | 团队无法依赖该正式检查证明 public purchase API 在 cutover blocked 状态被精确 503 拦截；若有人忽略失败，域名/路由变化可绕过预期发布安全验证。 |
| 数据影响 | 当前 release YAML 仍标记 public cutover blocked，未证明有直接数据写入；缺失 gate 会增加后续错误开放支付/订单入口的风险。 |
| 安全影响 | 购买 API 的公开暴露、负向路由和 503 fail-closed 约束没有被可运行的自动检查覆盖。 |
| 根因 | 域名/Caddy 拓扑已迁移至 fufu.wang，purchase checker 仍把旧 zhudatuan.com Caddy 文本当作唯一边界。 |
| 建议方向 | 从最新 `zdt-next` 建立单一 purchase-release-gate alignment batch：先确认当前正式公开域名、purchase upstream 和 blocked route owner；再以 parser/明确 site identity 重写 checker，保留精确 POST/OPTIONS 503 与负向路由断言。不要在审计分支修改 Caddy、release YAML 或执行 reload。 |
| 预计修改范围 | purchase check、受控 Caddy/release contract、必要的 fixture 与定向 tests；不改业务付款实现。 |
| 验证方式 | 在隔离 release candidate 上运行修正后的 checker；验证当前 selected host 的每个 purchase path 对 POST/OPTIONS 的预期 503/allowed 行为、非 purchase 路径及 Caddy syntax，并保留 `publicCutover=blocked` 直到 E2E receipt 满足。 |
| 回滚方式 | 回退独立 gate/Caddy contract commit；保持当前 public cutover blocked，不通过绕过 check 恢复发布。 |
| 是否需要独立复核 | 是；复核者须独立确认生产与候选 Caddy site、DNS、purchase API port/route owner及当前 cutover receipt 状态。 |

## F-0297｜MVP Journey suite 以全局静态字符串替代指定业务链路验证

| 字段 | 记录 |
| --- | --- |
| 模块 | Quality / MVP journey traceability |
| 类型 | 测试可信度、可维护性 |
| 严重级别 | **P3** |
| 置信度 | 高（JourneyHarness 与所有 MVP03–MVP23 caller 为直接证据；CI 实际执行覆盖未验证） |
| 文件和精确位置 | `03_quality_ceshi/tests/journeys/JourneyHarness.ts:23-95`；`mvp03_platform.spec.ts:1-2`；`mvp14_malldashboard.spec.ts:1-2`；`mvp23_providers.spec.ts:5-10`。 |
| 当前/预期 | 每个 MVP spec 只给 harness 传 operation/table/event 名称。Harness 读取整个 migration/module tree，以全局 regex 检查 `skip locked`、deadletter、foreign key、audit table 和文本 module 名；不启动 API/DB/worker/provider，也不将这些不变量限定到被声明的 operation/table。预期是这类 suite明确标为静态 traceability，关键写链路另有定向集成/契约验证。 |
| 直接证据 | [FACT][E-AU-753-001] 23-35 只验证 catalog/SDK/module source 路径；[FACT][E-AU-753-002] 50-64 对整个 migration tree 匹配 idempotency/deadletter 文本；[FACT][E-AU-753-003] 82-95 对全局 migration text 匹配 check/foreign key/audit，不验证指定 table 的实际约束；[FACT][E-AU-753-004] 二十一个 spec 多为单行 `journey(...)` 声明。 |
| 调用链或运行入口 | npm/node test → MVPxx spec → `journey()` static file scan → pass/fail；没有 HTTP server、PostgreSQL、队列或 provider invocation。 |
| 用户影响 | 测试通过可能被误解为对应业务工作台已验证完整主路径、并发、失败恢复和数据约束，实际上只证明静态元数据/文本仍存在。 |
| 数据影响 | 无直接数据写入。 |
| 安全影响 | 权限检查只确认 operation 有 canonical permission 与授权器文本存在，不能证明真实 session/scope/DB boundary 拒绝越权调用。 |
| 根因 | 将 requirement traceability 与运行行为验证合并到一个通用 harness，使用低成本全局 regex 作为统一证据。 |
| 建议方向 | 从最新 `zdt-next` 建立单一 journey-test-evidence batch：保留当前 suite 但更名/报告为 static traceability；优先为支付、身份、订单、权限、provider 写链建立少量真实 PostgreSQL+HTTP/worker 定向契约测试，并让每个高风险 MVP 指向可运行证据。 |
| 预计修改范围 | JourneyHarness 命名/断言、测试报告说明、少量高风险 module integration fixtures；不改业务功能。 |
| 验证方式 | 故意移除无关 migration 的 `deadletter` 或 `check` 文本、保留目标表缺约束，确认新 tests 对目标链路失败；在 isolated DB 对选定写操作验证幂等、scope denial、事务回滚和 outbox/dead-letter。 |
| 回滚方式 | 回退独立 test/label 变更；保留原 static traceability suite，避免短期丢失需求索引。 |
| 是否需要独立复核 | 否。 |

## F-0298｜Console release 测试直接覆盖应用工作树的 `dist` 产物

| 字段 | 记录 |
| --- | --- |
| 模块 | Quality / recovery / Console release artifact |
| 类型 | 测试隔离、开发者工作区安全 |
| 严重级别 | **P3** |
| 置信度 | 高（test 的 `spawnSync`、Vite config 和清理范围为直接源码证据；未实际运行该会写入工作树的测试） |
| 文件和精确位置 | `03_quality_ceshi/tests/recovery/console-release.spec.ts:29-59,63-104`；`01_core_hexin/apps/console/vite.config.ts:15-30,58-67`。 |
| 当前/预期 | 当前第一个 test 以 Console 应用目录为 cwd 执行 `vite build`，随后从固定 `apps/console/dist` 读取制品；该 test 只清理另两个临时目录。Vite config 没有设置替代 `outDir`，plugin 也默认/跟随 `config.build.outDir` 写入该 `dist`。预期是测试构建只能写入自己的临时输出目录，并在 finally 中清理。 |
| 直接证据 | [FACT][E-AU-757-001] spec 31-43 调用 `node_modules/vite/bin/vite.js build`，cwd 固定为 `apps/console`；[FACT][E-AU-757-002] 45 直接读取 `apps/console/dist`；[FACT][E-AU-757-003] 61-104 的 `rmSync` 只覆盖 `shop-console-artifact-*`、`shop-console-tampered-*` 临时目录；[FACT][E-AU-757-004] config 29 仅设置 `manifest: true`，plugin 60-67 以 Vite 的 `build.outDir` 解析输出目录。 |
| 调用链或运行入口 | `npm run test:integration` → `node --import tsx --test .../recovery/*.spec.ts` → Console recovery spec → Vite build → 应用工作树 `dist`。 |
| 用户影响 | 在开发者已有未跟踪 Console build 产物或并行本地构建时，定向测试可能覆盖其制品，令复现/调试输入不稳定。 |
| 数据影响 | 仅工作树生成制品；无数据库、线上或客户数据写入。 |
| 安全影响 | 无直接权限或凭据影响。 |
| 根因 | 把真实生产构建作为 test fixture，但没有把 Vite 输出重定向到 test-owned temporary directory。 |
| 建议方向 | 从最新 `zdt-next` 创建单一 test-isolation 批次：支持显式、受控的临时 outDir，spec 使用 `mkdtemp` 并在 finally 清理；保留同一制品 digest/manifest 断言。不要在审计分支修改测试或清理任何现有 `dist`。 |
| 预计修改范围 | Console Vite build test 和必要的 build-output 参数/fixture；不改变发布制品契约或线上 Console。 |
| 验证方式 | 在含预置 sentinel 文件的临时 outDir 与应用 `dist` 并存时运行该 spec；断言 sentinel 未变、临时目录被清理，并保留 artifact tamper/dual-node 断言。 |
| 回滚方式 | 回退独立测试隔离提交；不触及已发布客户端制品。 |
| 是否需要独立复核 | 否。 |

## F-0299｜Security suite 只验证纯授权器和 synthetic HTTP handler，未覆盖真实安全链路

| 字段 | 记录 |
| --- | --- |
| 模块 | Quality / security test evidence |
| 类型 | 测试可信度、安全验证覆盖 |
| 严重级别 | **P3** |
| 置信度 | 高（两个 spec 的 fixture/handler 构造为直接证据；现有其它安全集成 suite 的覆盖不在本 AU 结论内） |
| 文件和精确位置 | `03_quality_ceshi/tests/security/authorization.spec.ts:5-21`；`03_quality_ceshi/tests/security/http.spec.ts:7-18,20-62`。 |
| 当前/预期 | authorization spec 传入内存 `MembershipAccess` 直接调用 `decide`/`checkAssurance`；HTTP spec 为 OperationCatalog 的每个 route 注入统一 `200 {accepted:true}` synthetic handler。预期是 suite 标签或高风险补充测试能区分纯 policy/HTTP middleware 验证与真实 session、authorizer、controller、数据库 scope/RLS 的集成证明。 |
| 直接证据 | [FACT][E-AU-758-001] authorization spec 5-7 声明固定 mall/access/now，9-21 仅调用 authz pure functions；[FACT][E-AU-758-002] HTTP `application()` 10-15 对全部 operation 注入相同 closure；[FACT][E-AU-758-003] 20-62 只到 `HttpApp.handle`，没有 bootstrap、真实 operation handler、session resolver、数据库或 RLS fixture。 |
| 调用链或运行入口 | `npm run test:security` → 两个 spec → `@shop/authz` / RouteRegistry + HttpApp middleware；业务服务不进入调用链。 |
| 用户影响 | CSRF、Origin、body limit、header、scope/step-up 的基础单元行为可被验证，但通过结果不能证明真实登录会话、membership access version、controller authorizer 和数据库数据边界会拒绝越权请求。 |
| 数据影响 | 测试不写入数据库；真实数据隔离未由本 suite 证明。 |
| 安全影响 | 对真实授权整合、RLS 和具体敏感 operation 的回归覆盖可能存在盲区；未发现利用路径或实际越权证据。 |
| 根因 | 用统一 synthetic handler 和内存 access fixture 低成本覆盖横切 policy/middleware，却没有为高风险写操作连接真实 bootstrap/persistence boundary。 |
| 建议方向 | 从最新 `zdt-next` 建立单一 security-integration-evidence 批次：保留快速单测，新增少量隔离 PostgreSQL + bootstrap 的身份、退款、导出、跨 mall/tenant denial 测试；明确不同 suite 的证据等级。不要在审计分支调整安全策略。 |
| 预计修改范围 | security tests、最小 isolation fixture/CI label；不改业务授权规则。 |
| 验证方式 | 使用真实 session/membership/scope 数据分别调用敏感 controller，验证跨 tenant/mall、过期 access version、缺 step-up、CSRF/Origin 与 SQL RLS 都 fail-closed；故意移除其中一个 boundary 时测试必须失败。 |
| 回滚方式 | 回退独立测试/fixture 提交，保留现有快速 policy/HTTP 单测。 |
| 是否需要独立复核 | 否。 |

## F-0338｜微信支付唯一执行文档的责任树与复跑命令仍指向已移除目录

| 字段 | 记录 |
| --- | --- |
| 模块 | 微信支付 / 验收与运行文档 |
| 类型 | 文档执行路径漂移、支付验收可复核性 |
| 严重级别 | **P3** |
| 置信度 | 高（固定文档行号、路径存在性与当前支付入口直接证据） |
| 文件和精确位置 | `05_docs_ziliao/docs_wendang/微信支付生产接入与MVP验收.md:828-932,950-966`。 |
| 当前行为 | 文档第14节将 `apps/storefront`、`services/commerce`、`database/supabase` 列为完整责任树，第15.2节以 `npx vite ... apps/storefront` 作为复跑命令；固定基线中三条路径均不存在。当前支付实现位于 `01_core_hexin/services/commerce-api/src/api/wechatPayment*.ts`、`01_core_hexin/services/commerce/src/entry/Payment*Main.ts`、`01_core_hexin/extensions/payment/wechat/` 与 `02_platform_pingtai/`。 |
| 预期行为 | 被另一验收说明指定为微信支付唯一执行文档的责任树、命令和入口应解析到当前正式运行/测试路径，或明确标记为历史快照并提供当前受控入口。 |
| 直接证据 | [FACT][E-AU-879-001] 文档 828-932/950-966 的旧路径与命令；[FACT][E-AU-879-002] 三个旧路径在固定基线均不存在；[FACT][E-AU-879-003] 当前微信支付 API、Webhook、Jobs、extension 与 MvpServer 路径存在。 |
| 调用链或运行入口 | `测试环境验收-会员与支付.md` → 本文档作为唯一执行文档 → 人工复跑/验收/发布取证；当前实际入口为 payment API/Webhook/Jobs runtime。 |
| 用户影响 | 评审或验收人员可能无法复跑浏览器编排、错误定位支付职责或把旧目录的状态当成当前交付证据。 |
| 数据影响 | 不直接改变支付或财务数据；错误验收结论可能影响资金功能的发布判断。 |
| 安全影响 | 真实资金与密钥前置条件仍在文档中明确未完成；未发现凭据泄露或当前可利用路径。 |
| 根因 | 仓库重组后，长期作为唯一执行说明的目录树和本地启动命令未随当前支付运行单元同步。 |
| 建议方向 | 从修复时最新 `zdt-next` 建立单一 payment-document-paths 批次，逐条解析并更新责任树、复跑命令、测试入口和历史标记；不得在同一批变更支付协议、密钥、数据库或发布状态。 |
| 预计修改范围 | 本文档及其唯一引用/受控运行说明；不改支付业务实现。 |
| 验证方式 | 自动或人工逐条验证文档中每个源码/命令路径存在且入口可解析；旧路径应明确标为历史，MvpServer 命令仅在隔离本地环境验证。 |
| 回滚方式 | 回退单一文档/链接更新提交，保留原历史快照引用。 |
| 是否需要独立复核 | 否（P3）；若文档被外部正式验收或发布系统消费，升为发布 Owner 专项复核。 |

## F-0339｜历史测试验收单在版本库保留指向受控域名的明文登录材料

| 字段 | 记录 |
| --- | --- |
| 模块 | 身份 / 测试环境验收材料 |
| 类型 | 凭据暴露风险、历史测试账号治理 |
| 严重级别 | **P2** |
| 置信度 | 高（文档明文材料与当前节点/发布域配置直接证据；账号有效性未验证） |
| 文件和精确位置 | `05_docs_ziliao/docs_wendang/测试环境验收-会员与支付.md:11-22`；`02_platform_pingtai/infrastructure/projects_xiangmu/hbbtzn/deployment/aliyun.yml:15-22`；`02_platform_pingtai/infrastructure/release/zdt-next.release.json:21`。 |
| 当前行为 | 历史验收单以明文列出多组测试环境登录材料并指定 `https://hbbtzn.com/`；固定基线仍将 hbbtzn 域列为节点和发布受控域。文档声明为历史，但没有给出已撤销、隔离、轮换或访问限制的可复核证据。 |
| 预期行为 | 版本库不应保留可能用于受控环境登录的可用明文凭据；历史验收应使用已失效标识、受控凭据引用或经批准的临时获取机制，并保留轮换/撤销证据。 |
| 直接证据 | [FACT][E-AU-881-001] 文档 11-22 包含测试账号与明文密码；[FACT][E-AU-881-002] 当前 hbbtzn 节点/发布配置仍列该域。账号有效性、外网可达性、数据敏感度和轮换状态均为 [UNVERIFIED]。 |
| 调用链或运行入口 | 人工历史验收说明 → 可能的测试环境登录；当前受控域/节点配置 → hbbtzn storefront、API、accounts 等运行单元。 |
| 用户影响 | 若材料仍有效且文档访问范围超出预期，可能使测试或受限账号被非授权使用；若已失效，仍会误导验收人员并鼓励在文档中保存凭据。 |
| 数据影响 | 未验证账号权限、测试数据或生产数据边界；不得推断无数据影响。 |
| 安全影响 | 可能绕过正常凭据分发和轮换流程；未发现实际登录、利用、泄露范围或线上入侵证据。 |
| 根因 | 历史验收步骤把可操作登录材料直接写入版本化文档，未与当前节点、账号生命周期和凭据治理解绑。 |
| 建议方向 | 从修复时最新 `zdt-next` 建立单一 historical-test-credential-governance 批次：由身份/安全 Owner 只读确认账户存在性、realm、权限、有效性、日志和轮换状态；先失效/轮换并迁移文档到受控引用，再更新验收材料。不得用本审计分支登录、删除账号或改动凭据。 |
| 预计修改范围 | 受控测试账号/凭据治理、验收文档、访问日志与最小测试验证；具体范围需专项 Owner 裁定。 |
| 验证方式 | 在授权隔离环境验证旧材料已不可用、替代受控流程可审计且最小权限；复核无生产/真实用户权限、无 PII/资金影响并保留轮换收据。 |
| 回滚方式 | 回退文档引用；账号轮换/禁用按身份系统受控恢复流程执行，不能以恢复旧明文材料为回滚。 |
| 是否需要独立复核 | **是**；安全与身份 Owner 必须重新核对当前域、账号状态、角色、可达性、日志、保留期和恢复方案。 |

## F-0340｜被 Storefront README 引用的生产型 MVP 说明仍将历史架构和验收快照写作当前事实

| 字段 | 记录 |
| --- | --- |
| 模块 | Storefront / MVP 架构与验收文档 |
| 类型 | 文档事实漂移、运行与验收可复核性 |
| 严重级别 | **P3** |
| 置信度 | 高（文档日期/声明、当前 README、当前路由和 API 入口直接证据） |
| 文件和精确位置 | `05_docs_ziliao/docs_wendang/生产型MVP开发说明.md:1-6,56-77,104-111`；`01_core_hexin/apps/storefront-web/README.md:25-38`；`01_core_hexin/apps/storefront-web/src/config/showcaseAccess.ts:1-28`。 |
| 当前行为 | 2026-07-24 文档仍把阶段访问码、旧 API 表、Supabase Data API、Vinext/Cloudflare、6 迁移/27 表/16 测试和旧端入口写作当前能力；但当前 Storefront README 已将旧 `src/App.tsx`/`src/screens/*` 退出标准工程，展示路径限定为 labs，本轮已核对的 Identity/API/支付运行单元也已重组。README 仍直接把本文件指作完整边界/接口/验收说明。 |
| 预期行为 | 被当前 README/章程引用的说明应标注其历史快照范围，并把当前身份、API、运行单元、展示边界、质量/验收证据链接到可解析的现行来源。 |
| 直接证据 | [FACT][E-AU-882-001] 文档日期及旧访问码/API/统计/技术栈陈述；[FACT][E-AU-882-002] Storefront README 的旧 UI 退出与 labs-only 展示声明；[FACT][E-AU-882-003] showcase access 明确生产/本地/labs 边界。 |
| 调用链或运行入口 | Storefront README/主章程 → 本文档 → 人工架构理解、实施和验收；实际入口由当前 Storefront、身份 API、运行 target 与受控发布控制面决定。 |
| 用户影响 | 维护者可能按退休接口、访问码和旧端路由估计当前能力或验收状态，造成错误复跑、错误发布判断或错误文档依赖。 |
| 数据影响 | 无直接数据写入；错误说明可能间接影响数据导入、身份和支付验收的决策。 |
| 安全影响 | 旧阶段认证/运行说明可能削弱环境和权限审查清晰度；未发现当前生产放行或利用证据。 |
| 根因 | 早期 MVP 快照保留为活动入口，未与重组后的运行/发布事实建立同步或历史标记。 |
| 建议方向 | 从修复时最新 `zdt-next` 建立单一 mvp-guide-current-facts 批次：明确历史快照，替换 README/章程指向为现行运行图与验收入口，或更新文档为当前事实；不在同批改身份、支付、API 或发布实现。 |
| 预计修改范围 | MVP 说明、Storefront README/章程链接及可选路径/事实校验；不改运行代码。 |
| 验证方式 | 每一现行链接和命令可解析；历史统计具有日期/基线；当前身份/展示/交付边界与实际配置一致。 |
| 回滚方式 | 回退独立文档和校验提交；不涉及制品、线上状态或业务数据。 |
| 是否需要独立复核 | 否（P3）；若外部验收合同引用该说明，交由产品/发布 Owner 复核。 |

## F-0341｜296 条需求展开索引声明的工作簿哈希与当前权威 mapping 不一致

| 字段 | 记录 |
| --- | --- |
| 模块 | 需求追踪 / 人工派生索引 |
| 类型 | 文档派生物漂移、需求可追溯性 |
| 严重级别 | **P3** |
| 置信度 | 高（文档哈希、当前工作簿散列、mapping 元数据与 generator 输出列表直接证据） |
| 文件和精确位置 | `05_docs_ziliao/docs_wendang/福利商城296条需求修改点.md:1-5`；`05_docs_ziliao/docs_wendang/requirements/mapping.json:1-6`；`04_tools/tools/requirementgen/src/RequirementGenerator.ts:159-182`；`04_tools/scripts/audit/requirements.mjs:10-35`。 |
| 当前行为 | 展开索引自称由 mapping 展开且引用 `6f5a…` 工作簿哈希；当前权威工作簿与 mapping 使用 `78cfc3…`。generator 生成 mapping/YAML，不生成该 Markdown；正式 requirement graph gate 不读取该索引。 |
| 预期行为 | 若人工展开索引仍保留为需求阅读入口，必须以当前 authority/mapping 受控生成或明确标为历史快照，且哈希、数量、ID、操作/路由映射不得与机器权威源漂移。 |
| 直接证据 | [FACT][E-AU-883-001] 文档首行源哈希 `6f5a…`；[FACT][E-AU-883-002] 当前工作簿和 mapping 的 `78cfc3…`；[FACT][E-AU-883-003] generator outputs 不含该 Markdown，gate inputs 也不含该 Markdown。 |
| 调用链或运行入口 | 人工需求阅读/实施计划 → 展开索引；正式需求事实 → authority workbook → mapping/YAML/contract → `check:requirementgraph`。 |
| 用户影响 | 使用该索引的人可能把过期的需求来源、路由、操作或完成状态当作当前事实，造成实现优先级、验收和发布判断偏差。 |
| 数据影响 | 无直接数据写入。 |
| 安全影响 | 无直接安全影响；错误需求映射可间接影响权限/支付等需求审查覆盖。 |
| 根因 | 人工 Markdown 派生物未纳入 requirement generator 与正式 gate 的哈希/输出一致性检查。 |
| 建议方向 | 从修复时最新 `zdt-next` 建立单一 requirement-human-index 批次：决定从当前 mapping 生成并在 gate 校验，或标记历史并将阅读入口指向 machine-readable authority；不得在同批更改需求内容、代码或发布状态。 |
| 预计修改范围 | 该索引、requirement generator/检查或引用文档。 |
| 验证方式 | 重生后哈希/数量/ID/操作/路由与 mapping 一致；故意改动 authority 或 mapping 时生成/检查稳定失败；状态不因存在映射而误升为验收/发布。 |
| 回滚方式 | 回退独立文档/生成器/检查提交，保留历史快照。 |
| 是否需要独立复核 | 否（P3）；若它被外部需求合同引用，需求 Owner 复核。 |

## F-0342｜架构基线文件的实际 SHA 与上游锁定的 Authority 哈希不一致

| 字段 | 记录 |
| --- | --- |
| 模块 | 架构 authority / 发布完整性 |
| 类型 | 内容完整性漂移、目标 Authority Snapshot 不可复核 |
| 严重级别 | **P2** |
| 置信度 | 高（实际 SHA 与多个上游精确文本直接证据） |
| 文件和精确位置 | `05_docs_ziliao/docs_wendang/福利商城架构和补齐修改清单.md`（完整文件 SHA）；`福利商城代码修改清单.md:8`；`福利商城全系统根治方案.md:71,6212`。 |
| 当前行为 | 架构文件实际 SHA-256 为 `d4a94ab427ef26ed451930c1b47b98949121737533905ac0515d5f553d5b048b`；代码蓝图和根治/全系统方案仍将同一路径锁定为 `48f7d95dfad87aa9cc06705ff52a35561d7dabfb1ef5e75636e8418405a24ad2`，并把后者列作 Authority Snapshot 的精确 canonicalPath 预期值。 |
| 预期行为 | 所有把文件作为受控 authority 输入的路径、SHA、size/mode 和引用应对应同一批准版本；变更必须原子更新 authority/reference 或明确冻结历史版本。 |
| 直接证据 | [FACT][E-AU-889-001] 当前文件 SHA 为 `d4a94…`；[FACT][E-AU-889-002] 两份上游文档固定 `48f7d…`；[FACT][E-AU-889-003] 全系统方案将该预期 SHA 纳入 AuthoritySnapshot 精确条目。 |
| 调用链或运行入口 | 架构/代码蓝图/全系统方案 → 计划中的 AuthorityAuthorization/AuthoritySnapshot → 未来 cutover/post-tree 授权；当前该控制面是否执行为 [UNVERIFIED]。 |
| 用户影响 | 若按文档实施 authority capture 或依赖其 SHA 判定基线，可能直接拒绝当前文件，或迫使操作者绕过完整性控制；当前运行产品未证实受影响。 |
| 数据影响 | 无直接数据库写入证据。 |
| 安全影响 | 破坏目标发布/变更审计的内容绑定清晰度；未发现当前发布绕过或线上攻击证据。 |
| 根因 | 架构文件更新后，上游锁定哈希与拟议 authority snapshot 记录未同步更新，或引用目标历史版本但缺少明确冻结副本。 |
| 建议方向 | 从修复时最新 `zdt-next` 建立单一 authority-hash-reconciliation 批次：先确认哪个版本为批准 authority、是否存在外部历史副本和是否有当前 capture consumer；随后原子更新或正式冻结所有引用/测试。不得混入架构内容、代码、部署或凭据变更。 |
| 预计修改范围 | Authority/reference 文档、相关 hash/fixture/检查；视 Owner 决定是否新增冻结副本。 |
| 验证方式 | 同一批准文件的 SHA 在 authorities、引用、capture 输入与验证 fixture 中一致；故意篡改任一字节稳定拒绝；历史引用有可解析冻结版本。 |
| 回滚方式 | 回退独立 authority/reference 提交或恢复经批准的冻结副本；不触及运行制品。 |
| 是否需要独立复核 | **是**；架构与发布 Owner 需重新追踪 authority consumer、批准版本、capture 行为和外部交接。 |

## F-0343｜生产订单筛选被前端发送，但后端和契约未定义或消费

| 字段 | 记录 |
| --- | --- |
| 模块 | Console 订单工作台 / Order Operation 契约 |
| 类型 | 前后端契约漂移、用户可见查询正确性 |
| 严重级别 | **P2** |
| 置信度 | 高（当前前端、测试、OpenAPI/operation 定义和后端查询直接证据） |
| 文件和精确位置 | `01_core_hexin/apps/console/src/feature/order/OrderQuery.ts:25-48`；`01_core_hexin/apps/console/src/feature/order/OrderQuery.test.ts:80-109`；`01_core_hexin/services/commerce/src/modules/order_dingdan/03_application_yingyong/services_fuwu/OrderOperations.ts:29-49`；`01_core_hexin/packages/contract/definitions/operations.yml:1554-1572`；`05_docs_ziliao/docs_wendang/订单管理升级前详细预案-WCHS-MCBS-20260901.md:126-136`。 |
| 当前行为 | Console 在非 preview 的生产 scope 把 `placed`、`lifecycle`、`payment`、`fulfillment`、`mall`、`view` 作为“权威服务端筛选”发送，测试固定该行为；但 `order.orders.read` 的 operation/OpenAPI 未声明 query fields，当前 `OrderOperations` SQL 只消费内部 `order` 精确 ID 和 keyset cursor/limit，未读取六项筛选参数。 |
| 预期行为 | 页面可操作且标为服务端筛选的每个字段，都应由稳定契约声明、后端按授权范围真实执行并有结果正确性测试；若能力未实现，应在生产界面禁用或明确标为不可用，而非静默发出无效参数。 |
| 直接证据 | [FACT][E-AU-891-001] `OrderQuery.ts` 无 preview 分支、直接构造六项 query；[FACT][E-AU-891-002] `OrderQuery.test.ts` 明确命名“authoritative server filters to production scopes”；[FACT][E-AU-891-003] operation 定义无 request fields/OpenAPI parameters，Order SQL 条件仅含 `orders.id=$5` 与 cursor。预案仍保留“仅 preview 发送”的历史陈述。 |
| 调用链或运行入口 | Console `/orders` → `readOrders` → SDK `GET /api/v1/orders` → `order.orders.read` → `OrderOperations` SQL。 |
| 用户影响 | 运营人员可能以为日期、状态、商城或异常视图已缩小生产订单集合，实际得到未按选择条件筛选的结果，影响查单、售后、导出和异常处置判断。 |
| 数据影响 | 当前读取路径无写入证据；基于错误集合做后续人工订单操作可能产生间接业务风险。 |
| 安全影响 | SQL 仍用 scope/closure 条件限制范围，未发现跨范围读取证据；问题主要是筛选语义而非授权绕过。 |
| 根因 | Console 能力与目标 OMS 预案先行，未与 `order.orders.read` 的参数 schema、服务端 projection 和端到端结果断言原子落地。 |
| 建议方向 | 从修复时最新 `zdt-next` 建立单一 order-read-filter-contract 批次：逐项裁决保留/下线筛选，原子更新 operation schema、SDK、授权范围内 SQL/projection、UI 文案与真实数据测试；不要在同批处理订单写操作、VI 重构、导出、迁移或发布。 |
| 预计修改范围 | Order contract/SDK、Console 查询/测试、Order read handler/投影及定向集成测试；由订单 Owner 先确认每个筛选的产品定义。 |
| 验证方式 | 每项筛选以两个权限范围和相异数据集证明结果集合变化正确、组合筛选稳定、cursor 不重复/漏项、无筛选时向后兼容；契约拒绝未知字段或明确兼容策略。 |
| 回滚方式 | 回退该独立契约/读模型批次；在无法保证语义时先禁用对应 UI 控件，不能保留静默无效筛选。 |
| 是否需要独立复核 | **是**；订单、Console 与契约 Owner 必须独立追踪运行路由、参数解析、SQL/projection、生成 SDK 和真实结果样本。 |

## F-0344｜认证可靠性说明把历史单机手工部署写作当前运行基线

| 字段 | 记录 |
| --- | --- |
| 模块 | 身份 / 短信 / 运行与发布文档 |
| 类型 | 文档运行事实漂移、生产启用判断 |
| 严重级别 | **P3** |
| 置信度 | 高（文档日期/拓扑、当前受控发布 policy 与全仓引用检索直接证据） |
| 文件和精确位置 | `05_docs_ziliao/docs_wendang/AUTH-RELIABILITY-ARCHITECTURE-2026-08-15.md:7-19,21-38,84-104`；`02_platform_pingtai/infrastructure/release/zdt-next.remote-policy.json:18-37,44-51`。 |
| 当前行为 | 说明将“单 ECS、单进程副本和手工部署”列为当前可恢复性/发布风险，并给出历史迁移与环境变量启用清单；当前受控 policy 列出多节点、多个 target 及多组 systemd 单元。未发现任何当前运行、构建、发布、质量脚本或现行文档引用该说明。 |
| 预期行为 | 历史可靠性评估应明确冻结日期、环境和不再适用的运行假设；当前生产启用、容量、服务清单和恢复判断只能链接现行受控发布/运行图。 |
| 直接证据 | [FACT][E-AU-893-001] 文档 7-19/84-104 的单机、手工部署和启用步骤；[FACT][E-AU-893-002] 当前 remote policy 的多节点/多 target/systemd 列表；[FACT][E-AU-893-003] 全仓未找到该文件的当前消费者。 |
| 调用链或运行入口 | 人工可靠性/启用判断 → 本说明；真实发布/运行入口 → `zdt-delivery` → release policy → systemd target。 |
| 用户影响 | 操作者可能遗漏当前运行单元、错误估计可用性/容量，或按历史变量和迁移步骤判断生产已启用。 |
| 数据影响 | 无直接数据写入；错误执行历史启用建议可能间接影响身份/短信数据治理。 |
| 安全影响 | 旧凭据、短信和运行边界说明会降低当前变更审查清晰度；未发现可利用路径、当前密钥泄露或线上事故。 |
| 根因 | 运行控制面在 2026-08-15 后演进，但历史评估没有建立 current/historical 标记或受控入口链接。 |
| 建议方向 | 从修复时最新 `zdt-next` 建立单一 auth-reliability-document-currentness 批次：冻结历史结论，替换当前运行/启用入口为现行发布 policy 和运行图，并逐条标记不可执行旧步骤；不改身份、短信、迁移、部署或云资源。 |
| 预计修改范围 | 本说明及明确的人工入口/链接；不改运行实现。 |
| 验证方式 | 每个当前运行/启用链接可解析到受控 policy；无文档将历史单机、旧变量或迁移步骤写作当前；外部验收引用同步更新。 |
| 回滚方式 | 回退独立文档/链接提交，保留完整历史快照。 |
| 是否需要独立复核 | 否（P3）；若有外部运行手册或合规材料使用它，身份与发布 Owner 复核。 |

## F-0345｜授权摘要把不完整的数据库角色集合写作唯一允许集合

| 字段 | 记录 |
| --- | --- |
| 模块 | 授权 / 数据库权限文档 |
| 类型 | 文档权限事实漂移、角色矩阵可复核性 |
| 严重级别 | **P3** |
| 置信度 | 高（当前摘要、实际 authz/AccessPipeline 路径和受控迁移角色定义直接证据） |
| 文件和精确位置 | `05_docs_ziliao/docs_wendang/AUTHORIZATION-IMPLEMENTATION.md:3-17`；`01_core_hexin/packages/authz/src/index.ts`；`01_core_hexin/services/commerce/src/foundation/security/AccessPipeline.ts:34`；`02_platform_pingtai/database/supabase/migrations/20260829210000_owner_operator_coverage.sql:1-12`；`02_platform_pingtai/infrastructure/zhudatuan/aliyun/postgres-reconcile-registration-boundary.sql:35-38,380`。 |
| 当前行为 | 摘要称数据库角色“只允许”四类应用/迁移/最小只读角色；现行受控迁移和运行边界还明确包含 bootstrap、节点和受限读角色。其 `packages/*`/`services/*` 相对路径也未反映当前 `01_core_hexin` 根目录。 |
| 预期行为 | 授权摘要若充当当前边界，应链接版本化角色矩阵并区分 runtime、migration、bootstrap、节点和只读角色；若只是原则说明，应明确不是完整权限清单。 |
| 直接证据 | [FACT][E-AU-894-001] authz 和 AccessPipeline 当前存在；[FACT][E-AU-894-002] 摘要 13-17 的唯一角色陈述；[FACT][E-AU-894-003] 当前受控 SQL 列出额外角色。未验证线上实际 role membership。 |
| 调用链或运行入口 | 人工授权理解 → 摘要；实际授权 → authz/AccessPipeline/数据库受控迁移与运行角色矩阵。 |
| 用户影响 | 审计、运维或变更人员可能把合法受限角色误判为越权，或遗漏应检查的角色类别。 |
| 数据影响 | 无直接写入证据。 |
| 安全影响 | 降低最小权限审查和事故排查的完整性；未发现可利用越权或线上授权事故。 |
| 根因 | 极简原则摘要未随多节点/多 realm 运行边界演进为受控矩阵引用。 |
| 建议方向 | 从修复时最新 `zdt-next` 建立单一 authorization-summary-role-matrix 批次：保留原则、链接权威角色矩阵、标注摘要范围和当前路径；不改策略、SQL、角色或会话逻辑。 |
| 预计修改范围 | 授权摘要及角色矩阵交叉引用。 |
| 验证方式 | 每个文档角色均可追溯到版本化定义，runtime/migration/bootstrap 类别无遗漏；线上实际成员关系仅由获授权数据库 Owner 只读复核。 |
| 回滚方式 | 回退文档/引用提交，不改变数据库角色。 |
| 是否需要独立复核 | 否（P3）；若作为合规/生产 runbook，身份与数据库 Owner 复核。 |

## F-0346｜读镜像说明将未列入当前发布单元的可选 sidecar 写作已落地服务

| 字段 | 记录 |
| --- | --- |
| 模块 | 公开目录缓存 / 运行文档 |
| 类型 | 文档运行事实漂移、缓存部署可复核性 |
| 严重级别 | **P3** |
| 置信度 | 高（文档断言、当前源码/部署配置/release policy 和 AU-172 直接证据） |
| 文件和精确位置 | `05_docs_ziliao/docs_wendang/CORE-BUSINESS-READ-MIRROR.md:157-175,178-193`；`01_core_hexin/services/commerce-api/src/api/coreReadCache.ts:25-104`；`02_platform_pingtai/infrastructure/storefront-compatibility/aliyun/ecosystem.core-cache.config.cjs:4-9`；`02_platform_pingtai/infrastructure/release/zdt-next.remote-policy.json:18-37`。 |
| 当前行为 | 文档声称独立 `services/core-read-cache`、Tair 链路和备份程序已落地；当前源码树未发现该服务实现，只有 Commerce API 的可选 cache client 和 compatibility 部署目录的 loopback PM2 sidecar 配置；现行 release policy 未列该 target。AU-172 证明 client 在缓存缺失/失败时安全回源。 |
| 预期行为 | 读镜像文档必须区分已部署运行单元、可选兼容性配置、客户端能力和目标计划；当前部署判断以受控 release policy 为准。 |
| 直接证据 | [FACT][E-AU-895-001] 文档 157-175 的“已落地”列举；[FACT][E-AU-895-002] 当前 cache client 与 AU-172 回源证据；[FACT][E-AU-895-003] sidecar 仅存于 compatibility 配置，当前 release policy 无该单元。 |
| 调用链或运行入口 | public catalog → `coreReadCache` client → （配置时）私有 cache endpoint；当前受控部署 → release policy targets，未注册 core-read-cache。 |
| 用户影响 | 操作者可能误以为跨区域缓存、Tair、备份和性能指标已受控上线，导致错误的容量、故障或数据新鲜度判断。 |
| 数据影响 | 客户端回源路径不写缓存失败；未发现当前缓存双写、资金或订单一致性事故。 |
| 安全影响 | 错误地启用历史 PM2/Tair 配置可能绕开当前发布控制面；未发现当前外露端口、密钥或可利用路径。 |
| 根因 | 早期兼容性 sidecar/目标架构未与后续受控多单元发布模型同步标记。 |
| 建议方向 | 从修复时最新 `zdt-next` 建立单一 core-read-mirror-currentness 批次：标注历史/目标，链接现行 cache client 与 release policy，并裁决该 sidecar 是否正式产品化或退休；不在同批创建 Tair、部署服务、改缓存逻辑或删除兼容性文件。 |
| 预计修改范围 | 读镜像说明及当前运行/兼容性入口链接。 |
| 验证方式 | 每一“已部署”单元在 release policy/制品/健康检查中可解析；可选配置明确不代表运行；缓存缺失时定向目录读仍安全回源。 |
| 回滚方式 | 回退独立文档/链接提交；不影响缓存或运行服务。 |
| 是否需要独立复核 | 否（P3）；若决定正式启用/退休 sidecar，缓存与发布 Owner 专项复核。 |

## F-0347｜数据与微信支付预案仍将已完成的路由和 UnionID 身份工作写作待办

| 字段 | 记录 |
| --- | --- |
| 模块 | 商品同源 / 微信支付 / 身份文档 |
| 类型 | 文档事实漂移、实施与验收误导 |
| 严重级别 | **P3** |
| 置信度 | 高（文档日期/待办陈述、当前 router/handler/migration 直接证据） |
| 文件和精确位置 | `05_docs_ziliao/docs_wendang/DATA-AND-PAYMENT-EXECUTION-PLAN.md:23-96,158-185,263-296`；`01_core_hexin/services/commerce-api/src/api/routes/storefrontRouter.ts:9,46-50`；`01_core_hexin/services/commerce-api/src/api/wechatAuthRoutes.ts:36-74`；`02_platform_pingtai/database/supabase/migrations/20260814130000_wechat_order_payment_compliance.sql:18-38,186-214`。 |
| 当前行为 | 预案称微信路由接线未纳入 Git、UnionID 仍等待 Ethan 决定后才可落地；当前 router 已注册订单/预支付/状态 handler，认证文件已有会话/绑定 handler，当前迁移已有 `member_wechat_identities` 与 `union_id` 的约束、索引和处理逻辑。未发现当前消费者。 |
| 预期行为 | 实施前预案应冻结基线并把已完成/仍未验证/真实待决项区分清楚；当前支付与身份验收必须以现行契约、迁移、运行图和受控凭据流程为准。 |
| 直接证据 | [FACT][E-AU-896-001] 预案 38-64、158-185 的待接线/未决陈述；[FACT][E-AU-896-002] 当前 handler 注册与实现；[FACT][E-AU-896-003] 两套受控迁移均含 union identity 结构。线上商户配置、微信开放平台状态和真实支付验收为 [UNVERIFIED]。 |
| 调用链或运行入口 | 人工支付实施/验收 → 历史预案；真实 API → storefront/public router → Wechat handlers → 当前数据库迁移/运行配置。 |
| 用户影响 | 维护者可能重复实施已存在的结构、按旧路径/命令评估支付 readiness，或错误地把历史决策阻塞当成当前未完成项。 |
| 数据影响 | 不直接写数据；按陈旧方案重做身份/支付迁移可能引入重复 identity 或支付链风险。 |
| 安全影响 | 文档列出凭据变量但不含实值；错误的旧流程可能削弱当前受控凭据/发布审查，未发现泄露或当前利用证据。 |
| 根因 | 2026-08-14 预实施计划没有在后续路由、迁移和身份实现合入后冻结或链接 current authority。 |
| 建议方向 | 从修复时最新 `zdt-next` 建立单一 data-payment-plan-currentness 批次：冻结历史快照，链接当前 API/identity/payment authority，逐项标记已完成、未验证和真实待决项；不得在同批改支付代码、迁移、密钥、微信配置或发布。 |
| 预计修改范围 | 本预案及明确人工入口/链接。 |
| 验证方式 | 每项 current 链接可解析；已完成与未验证状态由可复现证据区分；任何真机支付/凭据验证只在单独授权的隔离流程进行。 |
| 回滚方式 | 回退独立文档/链接提交，保留历史版本。 |
| 是否需要独立复核 | 否（P3）；若外部支付验收或合同使用该计划，支付、身份与发布 Owner 复核。 |

## F-0348｜多端交付标准引用不存在的门禁并复述断链矩阵的完成裁决

| 字段 | 记录 |
| --- | --- |
| 模块 | 多端交付 / 发布证据文档 |
| 类型 | 文档交付事实漂移、质量门误导 |
| 严重级别 | **P3**（关联 F-0063 P2） |
| 置信度 | 高（文档、根脚本、当前 contract 和 F-0063 固定基线证据） |
| 文件和精确位置 | `05_docs_ziliao/docs_wendang/MULTI-PLATFORM-DELIVERY-STANDARD.md:7-17,118-138`；`01_core_hexin/packages/api-contract/src/platform.ts:48-88`；`01_core_hexin/packages/api-contract/src/delivery-matrix.json:1-67`；`package.json:105-111`；`04-findings.md:F-0063`。 |
| 当前行为 | 文档称 machine-readable matrix 由 `npm run check:platform-delivery` 守门，并按其把三个购物能力判为 Web/小程序完成；当前根脚本不存在该命令，只有 `check:delivery`，F-0063 已证明 matrix 的小程序证据路径不存在且正式 gate 不消费 matrix。 |
| 预期行为 | 多端完成裁决必须绑定真实可执行的门禁、每端可解析入口及结果证据；标准文档应链接现行 authority 或冻结为历史。 |
| 直接证据 | [FACT][E-AU-898-001] 文档 15、118-138 的 gate/完成断言；[FACT][E-AU-898-002] `platform.ts` 端口仍在；[FACT][E-AU-898-003] `package.json` 未定义该命令；[FACT][E-AU-898-004] F-0063 的 matrix 小程序路径与 gate 断链证据。 |
| 调用链或运行入口 | 人工交付判断 → 标准/matrix；实际质量入口 → `check:delivery` 与当前 requirements/delivery 配置。 |
| 用户影响 | 评审可将未被有效门禁证明的小程序能力误判为可发布的跨端闭环。 |
| 数据影响 | 无直接数据写入。 |
| 安全影响 | 无直接安全影响；错误完成状态可能间接绕过支付/身份等跨端验收。 |
| 根因 | 标准、矩阵与正式 delivery gate 在仓库重组后没有共同 authority 和漂移检查。 |
| 建议方向 | 从修复时最新 `zdt-next` 建立单一 platform-delivery-authority 批次，先处理 F-0063 的权威归属与路径解析，再更新本标准的 gate/完成表述；不得在同批实施缺失端能力或发布。 |
| 预计修改范围 | 标准、matrix、delivery checker/测试与权威入口。 |
| 验证方式 | 文档命令存在并运行；matrix 每项 evidence 可解析；releaseReady 只在 required platform 真实实现和定向结果证据齐全时允许。 |
| 回滚方式 | 回退独立文档/matrix/gate 提交，保留历史快照。 |
| 是否需要独立复核 | 否（P3）；F-0063 的 P2 修复由产品、多端和发布 Owner 复核。 |

## F-0349｜Smart Shell 融合施工计划仍把历史候选分支和未注册 Operation 写作当前实施入口

| 字段 | 记录 |
| --- | --- |
| 模块 | Console / 组织开通 / 发布迁移文档 |
| 类型 | 历史目标计划漂移、实施/切换误导 |
| 严重级别 | **P3** |
| 置信度 | 高（文档状态/基线、当前路径/contract 检索与 release domain 直接证据） |
| 文件和精确位置 | `05_docs_ziliao/docs_wendang/SMART-SHELL-OPERATION-API-INTEGRATION-PLAN.md:1-58,129-174,270-320`；`01_core_hexin/apps/console/src/shell/ScopeShell.tsx`；`01_core_hexin/packages/contract/definitions/operations.yml`；`02_platform_pingtai/infrastructure/release/zdt-next.release.json:21`。 |
| 当前行为 | 文件标为 `Shop/smart-wing`、待批准实施，列出已不存在的 `src/app`/`adminBff`/CockpitApi 路径及拟新增组织/Experience Operation；当前 ScopeShell 已在 `src/shell`，拟议 Operation 未在 contract/服务注册。受控 release 清单含 smart/t 域，但不证明文中灰度/切换已执行。 |
| 预期行为 | 历史施工计划应冻结其候选分支、路径和拟议 scope；任何现行组织、Console 或发布操作必须从 current contract/运行图和授权工作包开始。 |
| 直接证据 | [FACT][E-AU-899-001] 文档状态/基线与路径/拟议 Operation；[FACT][E-AU-899-002] 当前 ScopeShell 路径；[FACT][E-AU-899-003] contract 未见四个拟议 Operation；[FACT][E-AU-899-004] release domains 仅证明域名受控。 |
| 调用链或运行入口 | 人工实施/切换 → 历史计划；实际 Console/组织/发布 → 当前 source/contract/release policy。 |
| 用户影响 | 维护者可能在错误分支或历史路径上实施，误认为组织开通/灰度能力已可用，或对受控域执行未经批准的切换。 |
| 数据影响 | 错误执行文中迁移/组织创建会触及真实层级、绑定与业务事实；本审计未执行。 |
| 安全影响 | 文档中的 Cookie/CORS/旧 API 隔离建议具有安全意义，但不构成当前授权；错误执行可能扩大域名或会话边界。 |
| 根因 | 历史候选分支施工计划未随当前 Console 重组、contract 演进和受控发布模型更新为 current/historical 双入口。 |
| 建议方向 | 从修复时最新 `zdt-next` 建立单一 smart-shell-plan-currentness 批次：冻结历史计划，链接当前 Console/contract/release authority，并把任何仍需的组织/切换目标拆为独立批准工作包；不得在同批改代码、组织、数据库、域名、Cookie 或发布。 |
| 预计修改范围 | 本计划及人工入口/链接。 |
| 验证方式 | 历史路径/分支/目标均明确标注；现行链接可解析；任何拟实施 Operation 在 contract、权限、handler、迁移、测试和发布计划中有完整独立证据。 |
| 回滚方式 | 回退独立文档/链接提交，保留冻结快照。 |
| 是否需要独立复核 | 否（P3）；若重新批准 Console 切换，Console、组织、数据与发布 Owner 专项复核。 |

## F-0350｜商城总纲的代码地图和机器真值索引仍指向重组前路径与断链交付矩阵

| 字段 | 记录 |
| --- | --- |
| 模块 | 上位产品/治理总纲 / 架构文档入口 |
| 类型 | 文档入口漂移、交付事实误导 |
| 严重级别 | **P3**（关联 F-0063、F-0340） |
| 置信度 | 高（总纲、当前目录、消费者和既有固定基线 findings 直接证据） |
| 文件和精确位置 | `05_docs_ziliao/docs_wendang/SMART-WING-MALL-MASTER-CHARTER.md:14-36,596-672,775-813,932-966`；`01_core_hexin/packages/api-contract/src/platform.ts`；`01_core_hexin/packages/api-contract/src/delivery-matrix.json`；`04-findings.md:F-0063,F-0340`。 |
| 当前行为 | 总纲被数据支付和 VI 收敛方案引用为上位文件；其代码地图/关键文件索引仍写根级 apps/packages/services/database 与 `apps/wechat-miniapp`，而当前源码/平台目录已重组为 `01_core_hexin`/`02_platform_pingtai`，miniapp 路径也不同。它把 delivery matrix 写为真实多端完成度 authority，F-0063 已证明该矩阵的小程序证据和正式门禁断链。 |
| 预期行为 | 上位总纲保留产品/冻结决议，但所有 current code/authority/交付入口应解析到现行路径，并将历史或待验证状态显式隔离。 |
| 直接证据 | [FACT][E-AU-900-001] 总纲 596-672、932-966 的旧路径/matrix 断言；[FACT][E-AU-900-002] 当前 package/Console/miniapp 目录；[FACT][E-AU-900-003] 两份当前方案引用总纲；[FACT][E-AU-900-004] F-0063/F-0340 现有证据。 |
| 调用链或运行入口 | 上位产品/实施方案 → 总纲 → 人工架构/验收判断；实际实现/发布事实 → 当前源码、contract、release policy 与受控质量门。 |
| 用户影响 | 后续开发、审计或 AI 可能在不存在的目录中定位实现，将 history/目标/断链矩阵误读为当前可发布能力。 |
| 数据影响 | 无直接数据写入。 |
| 安全影响 | 过期身份、权限、支付和发布索引会降低变更审查清晰度；未发现当前绕过或泄露。 |
| 根因 | 上位文档在仓库重组和 delivery authority 分叉后未建立自动路径/状态校验。 |
| 建议方向 | 从修复时最新 `zdt-next` 建立单一 master-charter-current-index 批次：保留产品冻结决议，原子更新 current path/authority 链接，明确历史引用，并与 F-0063/F-0340 的权威裁决对齐；不得在同批改业务、权限、支付、数据库或发布。 |
| 预计修改范围 | 总纲的使用说明、代码地图、状态和关键文件索引，以及必要交叉链接。 |
| 验证方式 | 每个 current 路径和命令可解析；matrix 不再作为未验证交付事实；引用方案可跳至当前 authority；冻结决议文本不被意外改变。 |
| 回滚方式 | 回退独立文档/链接提交，保留完整历史快照。 |
| 是否需要独立复核 | 否（P3）；上位决议/外部合同存在时由 Owner/架构/发布 Owner 复核。 |

## F-0351｜VI 收敛计划引用已重组路径与不存在的生成/门禁命令

| 字段 | 记录 |
| --- | --- |
| 模块 | VI / 前端工具与实施文档 |
| 类型 | 文档工具链漂移、设计验收误导 |
| 严重级别 | **P3**（关联 F-0016） |
| 置信度 | 高（计划、根脚本、当前生成器和既有审计证据） |
| 文件和精确位置 | `05_docs_ziliao/docs_wendang/VI-CONVERGENCE-EXECUTION-PLAN.md:8-17,103-177,239-342`；`package.json:1-123`；`04_tools/scripts/build-web-tokens.mjs:1-30`；`04-findings.md:F-0016`。 |
| 当前行为 | 计划仍指定根级 `apps/wechat-miniapp`/`packages/design-system`，并称 `build:miniapp-assets`、`check:miniapp`、`build:web-tokens`、`check:vi` 为现有或将新增的验收命令；当前根脚本未定义这些命令，现有 web token generator 读写 `01_core_hexin/packages/design`。F-0016 已证明旧 token CSS/检查路径与 canonical 输出脱节。 |
| 预期行为 | 被当前方案引用的 VI 计划应把机制目标与可执行的 current generator/checker 分开，所有路径/命令可解析，且历史 baseline/目标状态显式标注。 |
| 直接证据 | [FACT][E-AU-901-001] 计划的路径/命令/任务陈述；[FACT][E-AU-901-002] 根 scripts 未定义四个命令；[FACT][E-AU-901-003] generator 当前输出；[FACT][E-AU-901-004] AU-849/F-0016 既有证据。 |
| 调用链或运行入口 | 数据支付/pilot notes → VI 计划 → 人工样式/门禁操作；实际 token 生成/质量 → 当前 scripts/package commands。 |
| 用户影响 | 执行者可能运行不存在的命令、修改错误 token 副本或误把历史 VI baseline 当作当前质量状态。 |
| 数据影响 | 无直接数据写入。 |
| 安全影响 | 无直接安全影响；未授权素材治理仍应保留。 |
| 根因 | 仓库与 design package 重组后，实施计划未与 current scripts/quality authority 同步。 |
| 建议方向 | 从修复时最新 `zdt-next` 建立单一 vi-plan-toolchain-currentness 批次：冻结历史基线，链接 current generator/checker/paths，裁决 F-0016 的 token authority 后再更新验收命令；不得在同批批量改 CSS、生成、引入素材或改产品界面。 |
| 预计修改范围 | VI 计划、pilot note 链接及工具/质量入口说明。 |
| 验证方式 | 每个命令存在、针对正确 source/output 执行；故意改变 canonical token 时目标 checker 稳定失败；无外部素材未经授权进入制品。 |
| 回滚方式 | 回退独立文档/入口提交，保留历史计划。 |
| 是否需要独立复核 | 否（P3）；若恢复/替换 VI gate，由 VI、前端和工具 Owner 复核。 |

## F-0352｜VI T1 打样记录的参照提交、路径和历史通过结论不能复核当前工具链

| 字段 | 记录 |
| --- | --- |
| 模块 | VI / 工具链工程记录 |
| 类型 | 历史验证证据漂移、实施误导 |
| 严重级别 | **P3** |
| 置信度 | 高（记录、当前 git 历史、generator、根脚本直接证据） |
| 文件和精确位置 | `05_docs_ziliao/docs_wendang/VI-CONVERGENCE-PILOT-NOTES.md:1-18,136-182`；`04_tools/scripts/build-web-tokens.mjs:1-30`；`package.json:1-123`。 |
| 当前行为 | 记录引用 `fafc0b7` 打样提交、根级 design-system/apps 路径和已接入的命令，并称三应用构建/miniapp 检查通过；当前可见 generator 历史不含该参照提交，generator 指向 `01_core_hexin/packages/design`，根脚本未定义文中命令。 |
| 预期行为 | 历史打样的经验可保留，但其 commit、路径、命令、产物与测试结果必须标为对应历史基线；当前工具链结论需由当前可重现命令证明。 |
| 直接证据 | [FACT][E-AU-902-001] 记录的提交/路径/通过声称；[FACT][E-AU-902-002] generator 现行 source/output；[FACT][E-AU-902-003] 当前根 script 清单；[FACT][E-AU-902-004] 脚本 git 历史未见 `fafc0b7`。 |
| 调用链或运行入口 | VI 执行计划 → pilot notes → 人工生成/验证判断；实际工具入口 → 当前 generator/package scripts。 |
| 用户影响 | 维护者可能把无法复现的历史通过结论当成当前 gate，或按旧路径改错 token 副本。 |
| 数据影响 | 无直接数据写入。 |
| 安全影响 | 无直接安全影响。 |
| 根因 | 打样记录未与仓库重组和 current quality toolchain 建立可验证的历史/现行边界。 |
| 建议方向 | 从修复时最新 `zdt-next` 建立单一 vi-pilot-evidence-currentness 批次：冻结历史提交/结果，链接 current generator/paths/commands，并引用 F-0016/AU-901 的现行裁决；不得生成、批量改 UI 或改变 token 母版。 |
| 预计修改范围 | 打样记录与 VI 计划的交叉链接/证据说明。 |
| 验证方式 | 历史 commit 可解析或明确不可用；current 命令/路径可解析；当前生成/构建只能以新的受控测试结果写入。 |
| 回滚方式 | 回退独立文档/链接提交，保留历史记录。 |
| 是否需要独立复核 | 否（P3）；若用作正式设计门禁证据，VI/工具 Owner 复核。 |

## F-0353｜VI 移植日志把历史工作树/Fresh Replay 结果保留为易被误读的完成证据

| 字段 | 记录 |
| --- | --- |
| 模块 | VI / Console 历史施工证据 |
| 类型 | 历史执行结果漂移、验收证据误导 |
| 严重级别 | **P3** |
| 置信度 | 高（日志、当前 Operation 规模和当前文档哈希直接证据） |
| 文件和精确位置 | `05_docs_ziliao/docs_wendang/VI-PORT-LOG.md:1-24`；`01_core_hexin/packages/contract/src/operations/CommerceOperations.ts`；`05_docs_ziliao/docs_wendang/福利商城代码修改清单.md`；`福利商城根治实施方案.md`；`福利商城架构和补齐修改清单.md`。 |
| 当前行为 | 日志以“工作树”“待阶段提交”、历史 Fresh Replay/Chrome 结果记录 P0–P3，最多声称 215 Operations；当前 catalog 已达 242 Operations，日志所写三份基线文档 hash 已非当前文件 hash。未发现当前消费者。 |
| 预期行为 | 历史施工记录应明确不可替代 current commit、current quality、current release 或生产验收；需要复用结论时必须从固定当前基线重新验证。 |
| 直接证据 | [FACT][E-AU-903-001] 日志的工作树/待提交与 215 Operation 语义；[FACT][E-AU-903-002] 当前 242 Operation 观察；[FACT][E-AU-903-003] 当前三份文档已不匹配日志 hash。 |
| 调用链或运行入口 | 人工历史追溯 → 日志；当前事实 → 当前 contract/source/hash/定向验证。 |
| 用户影响 | 维护者可能误把历史本地通过、已迁移数量或页面验收当作现行可发布状态。 |
| 数据影响 | 无直接数据写入。 |
| 安全影响 | 无直接安全影响；错误质量判断可间接影响高风险域发布。 |
| 根因 | 临时施工记录没有与阶段提交、重组后基线和 current evidence 建立冻结/替代关系。 |
| 建议方向 | 从修复时最新 `zdt-next` 建立单一 vi-port-log-evidence-boundary 批次：标记所有工作树/历史结果及适用 hash，链接 current audit records；不回填通过、重跑迁移或改业务实现。 |
| 预计修改范围 | 日志的证据标记及交叉链接。 |
| 验证方式 | 读者可区分历史/current/未验证；任何 current completion 引用都有当前 commit、输入 hash、命令与结果。 |
| 回滚方式 | 回退独立文档/链接提交，保留原日志。 |
| 是否需要独立复核 | 否（P3）；若引用到外部验收，由质量/发布 Owner 复核。 |

## F-0354｜GX 累计数与可枚举候选编号不一致，独立复核范围尚不可完整证明

| 字段 | 记录 |
| --- | --- |
| 模块 | 审计治理 / 死代码候选与独立复核清单 |
| 类型 | 审计证据一致性、复核覆盖风险 |
| 严重级别 | **P3** |
| 置信度 | 高（当前 audit artifact 的静态计数直接证据） |
| 文件和精确位置 | `05_docs_ziliao/docs_wendang/architecture/full-codebase-audit-20260913/05-dead-code-candidates.md:22-2328,2562`；`04-findings.md:5,43-2708`；`10-coverage-manifest.csv:3306,3325`。 |
| 当前行为 | 最新累计行报告 GX 52、G3 0；同一文件可用 `GX-####` 枚举的唯一编号只有 38，且 P1 candidates/RV 由 findings 分散记录。manifest 仅有两个明确“需要专项专家复核”文件。 |
| 预期行为 | 所有 P1、G3 与 GX 必须具有唯一 ID、当前状态、证据位置、复核 Owner/方法和第二轮结果；汇总数应可由该清单机械重算。 |
| 直接证据 | [FACT][E-AU-905-001] manifest 4,238 条目且无暂未审阅；[FACT][E-AU-905-002] 17 个显式 P1 candidates、20 个 RV 编号；[FACT][E-AU-905-003] 38 个可枚举 GX ID 与最新累计 GX 52 的差异。 |
| 调用链或运行入口 | 首轮 findings/candidates/manifest → 独立复核调度 → 最终问题/候选计数与治理排序。 |
| 用户影响 | 若直接使用汇总数安排复核，可能漏掉 14 个未定位的高风险候选，或错误宣称所有 GX 已完成二次核验。 |
| 数据影响 | 无直接数据写入。 |
| 安全影响 | GX 中含身份、支付、迁移与历史登录材料；范围不完整会削弱安全/数据风险复核的覆盖证明。 |
| 根因 | 首轮多批次累计使用了增量数字，但没有同步维护可机械重算的统一 GX/RV authority 清单。 |
| 建议方向 | 在审计分支建立单一 independent-review-index：从现有 findings/candidates 逐项映射 P1/RV/G3/GX、文件/入口、首审结论、复核方法和状态；保留未定位项，不得为凑数删除或降级。随后每次独立复核只更新对应条目和第二轮证据。 |
| 预计修改范围 | 审计报告/复核索引；不改生产实现。 |
| 验证方式 | ID 唯一、计数可机械重算、每项可追溯首审与第二轮证据；G3/P1/GX 没有复核记录时不能在最终汇总标为完成。 |
| 回滚方式 | 回退单一审计索引/报告提交，保留原始首审记录。 |
| 是否需要独立复核 | **是**；审计主审与另一独立审阅者必须先对索引完整性达成可复算结果，再开始结论性 GX/P1 收口。 |
