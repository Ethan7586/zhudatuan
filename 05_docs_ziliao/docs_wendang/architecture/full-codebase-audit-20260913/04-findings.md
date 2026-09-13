# 全代码库系统审计｜04 问题清单

## 1. 计数口径

本文件只收录已经形成最小证据链的问题。AU-003 结束时累计：P0 0、P1 候选 1、P2 11、P3 1、NIT 1。P1 项尚未完成第二轮独立复核，因此不会写成最终定级。

## F-0001｜fufu Console 公网入口与发布制品指针分裂

| 字段 | 记录 |
| --- | --- |
| 模块 | 发布与运行 / Console 静态制品 |
| 类型 | 运行配置漂移、可用性、发布事实源分裂 |
| 严重级别 | **P1 候选**；未完成 RV-0001 前不作最终 P1 |
| 置信度 | 高：当前行为与路径证据直接；影响范围和持续时间未知 |
| 文件和精确位置 | `02_platform_pingtai/infrastructure/release/zdt-next.release.json:611`；`02_platform_pingtai/infrastructure/zhudatuan/aliyun/Caddyfile:65-91`；线上 `/etc/caddy/Caddyfile:115`（只读观察） |
| 当前行为 | [FACT][E-AU-001-020][E-AU-001-021] 线上 Caddy 指向 runtime recovery current 下的 Console dist，该目录无 index；release target current 的 static/index.html 存在；公网根返回 404 |
| 预期行为 | [FACT][E-AU-001-017] release manifest 对 `https://console.fufu.wang/` 只允许 200，且 Console 制品应由其声明的 pointer root 对外提供 |
| 直接证据 | E-AU-001-017、E-AU-001-020、E-AU-001-021 |
| 调用链或运行入口 | workflow/release build → `/opt/zhudatuan/targets/console/current/static`；浏览器 → Caddy → `/opt/sfl/nodes/zhudatuan-l0/current/.../console/dist` |
| 用户影响 | [INFERENCE] 直接访问 Console 根的运营用户无法加载页面；是否存在替代域名/路径、影响人数和起始时间未知 |
| 数据影响 | 未发现直接数据写入或数据损坏证据 |
| 安全影响 | 未发现直接安全暴露证据 |
| 根因 | [UNKNOWN] 多套 current/pointer 与 Caddy 安装流程并存是直接冲突；具体由哪次配置或发布引入尚未追溯 |
| 建议方向 | 后续独立修复批次只统一“被 release 更新的 pointer”和“Caddy 实际读取的 pointer”，先确认权威路径；本审计分支不实施 |
| 预计修改范围 | [UNKNOWN] 可能涉及 Caddy 配置、release target/policy 或激活流程中的一处或数处；复核前不得猜定 |
| 验证方式 | 第二审计者重新核对实例身份、Caddy active config、两个 current 指针、制品版本和直连 SNI；穷举 200/404/5xx/连接失败，并检查其它域名无变化 |
| 回滚方式 | 修复批次保留原 Caddy 与原 pointer，按当时正式发布流程回切；本次未执行 |
| 是否需要独立复核 | 是，RV-0001；P1 强制 100% 重追入口 |

为什么不是 P0：当前只证明单一 Console 表面的 404，没有证据证明正在发生严重数据损失、安全事故或全系统中断，也未独立确认业务影响规模。按用户定义，不能为了谨慎而把证据不足的 P1 候选升级为 P0。

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
| 文件和精确位置 | `01_core_hexin/apps/miniapp/miniprogram/app.js:1-9`；`04_tools/scripts/audit/navigation.mjs:13-46`；`04_tools/scripts/audit/runtimegraph.mjs:17-24`；`04_tools/scripts/check/tests.mjs:39-50`；`04_tools/scripts/release/candidate.mjs:19-34`；`01_core_hexin/packages/api-contract/src/delivery-matrix.json:1-65`；`04_tools/scripts/audit/regression.mjs:6-18` |
| 当前行为 | [FACT][E-AU-002-018][E-AU-002-019][E-AU-002-020] 目录只有 9 个文件；无 app.json/pages/api/client/navigation/actions。navigation 正式命令必现 ENOENT；test topology 只见 app.js 就通过；candidate 无条件复制片段；delivery matrix 又把已被 regression 标为 retired、当前不存在的 wechat-miniapp 路径作为四项 implemented 能力证据 |
| 预期行为 | 若 Miniapp 是 required/current client，构建、测试、导航、runtime compatibility、candidate 和 delivery matrix 应共享同一最小可启动拓扑；若已外置或下线，机器契约应明确指向真实所有者/制品 |
| 直接证据 | E-AU-002-018、E-AU-002-019、E-AU-002-020、T-AU-002-003/005/009 |
| 调用链或运行入口 | generate scripts → 8 outputs；微信 runtime → app.js；quality → navigation/runtimegraph/tests；release → candidate clients/miniapp；contract → delivery matrix |
| 用户影响 | [UNKNOWN] 本仓库无法重建/导航一个完整 Miniapp；是否有外部工程持续供给线上小程序未验证 |
| 数据影响 | [UNKNOWN] delivery matrix 声称 cart/order/payment 能力 implemented，但当前证据文件不存在；不能推导线上写入是否缺失 |
| 安全影响 | [UNKNOWN] 缺 API client 无法审阅身份/header/权限边界，但不等于已存在漏洞 |
| 根因 | 多个门禁各自采用不同的“Miniapp 存在”判据，且 delivery matrix 保留 retired 路径；外部工程/产品迁移决定未入当前事实源 |
| 建议方向 | 独立产品/发布治理批次先确认唯一 Miniapp 所有者、源码位置和当前发布状态，再统一机器清单；不得凭当前缺失自动补工程或删片段 |
| 预计修改范围 | UNKNOWN；可能涉及外部仓库链接、delivery matrix、candidate、检查脚本或正式客户端，但必须拆批 |
| 验证方式 | 微信开发者工具/CI 的真实构建与导航；candidate 内容；API header；外部工程 SHA/发布记录；再重跑四类 check |
| 回滚方式 | 机器清单与构建/发布规则分提交回退；现有 9 文件在事实确认前保留 |
| 是否需要独立复核 | 否（P2）；若后续拟删除/判 GX/G3，则必须第二轮独立复核 |

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
| 模块 | 数据与迁移 / 正式 release executor |
| 类型 | 事务边界、失败恢复、迁移可重复性 |
| 严重级别 | P2 |
| 置信度 | 高：query 顺序和迁移事务包装直接；窗口发生概率与具体数据影响未知 |
| 文件和精确位置 | MigrationRunner.ts:51-78；database-migration-executor.mjs:22-46；zdt-next.remote-policy.json:57；remote/agent.mjs:499-529,580-613,840-857 |
| 当前行为 | [FACT][E-AU-003-012][E-AU-003-013] runner 先 client.query(sql)，完成后再单独 INSERT schema_migrations。300 个 SQL 中 207 个现代文件自含 BEGIN/COMMIT；因此 SQL 内 COMMIT 成功后到 ledger INSERT 成功前存在进程、连接或 ledger 写失败窗口。93 个无显式事务文件均属于冻结历史，不是本结论的主要触发面 |
| 预期行为 | 对每个迁移，数据库可观察效果与“已应用”记录应具有同一恢复语义；任一失败点都不能让自动重试无法判断是否应再次执行 SQL |
| 直接证据 | E-AU-003-012、E-AU-003-013、E-AU-003-014；RS-AU-003-003 |
| 调用链或运行入口 | GitHub deploy → database-migration target → remote agent → DatabaseMigrationExecutor → MigrationRunner → SQL 自提交 → ledger INSERT → target schema check |
| 用户影响 | [INFERENCE] 窗口命中后发布失败；下一次自动执行会把缺 ledger 的同一 SQL 再运行，可能持续阻断发布，需要人工判断已发生的数据库效果 |
| 数据影响 | [INFERENCE] 取决于具体 SQL 的可重复性，可能只是再次失败，也可能重复 DML；本单元没有故障注入或逐迁移证明，不写成已发生数据损坏 |
| 安全影响 | 无直接安全影响；迁移 owner 权限使错误影响面较大，但当前角色校验是明确门禁 |
| 根因 | 事务所有权分裂：迁移文件自行提交业务 DDL/DML，runner 在文件事务之外维护 ledger；advisory lock 只解决并发，不解决提交原子性 |
| 建议方向 | 数据专项先定义受管的单迁移 commit/ledger 协议和已提交未登记恢复流程；不得通过伪造 ledger 或改历史文件快速掩盖 |
| 预计修改范围 | MigrationRunner、迁移编写契约、故障注入测试和 runbook；是否需要新 forward migration 由当时状态决定 |
| 验证方式 | 临时数据库在 SQL commit 后、ledger insert 前故障注入；验证重启能确定性恢复且历史哈希、target head、forward-only receipt 仍成立 |
| 回滚方式 | 该类修复必须 forward-safe；代码提交可回退，但已执行数据库效果不可依赖代码回退，需预先定义恢复 migration/备份路径 |
| 是否需要独立复核 | 否（当前 P2）；任何实际 ledger 分裂、数据修复或迁移协议变更应按 P1/GX 级别双人复核 |

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
