# 全代码库系统审计｜04 问题清单

## 1. 计数口径

本文件只收录已经形成最小证据链的问题。AU-022 结束时累计：P0 0、P1 候选 13、P2 46、P3 38、NIT 1。P1 项尚未完成第二轮独立复核，因此不会写成最终定级。

## F-0001｜fufu Auth、Console 公网入口与发布制品指针分裂

| 字段 | 记录 |
| --- | --- |
| 模块 | 发布与运行 / Auth、Console 静态制品 |
| 类型 | 运行配置漂移、可用性、发布事实源分裂 |
| 严重级别 | **P1 候选**；未完成 RV-0001 前不作最终 P1 |
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
| 是否需要独立复核 | 是，RV-0001；P1 强制 100% 重追入口 |

为什么不是 P0：当前证明两个前端入口 404，但没有证据证明正在发生严重数据损失、安全事故或全系统中断，也未独立确认影响规模。按用户定义，不能为了谨慎而把证据不足的 P1 候选升级为 P0。

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

## F-0015｜正式生产 workflow 固定使用 Direct，成功回执跳过可用性验收与健康回滚

| 字段 | 记录 |
| --- | --- |
| 模块 | 发布与运行 / GitHub → release engine → ECS agent |
| 类型 | 发布门禁、失败检测、回滚语义 |
| 严重级别 | **P1 候选**；未完成 RV-0002 前不作最终 P1 |
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
| 是否需要独立复核 | 是，RV-0002；P1 候选必须 100% 重追入口 |

为什么不是 P0：未发现正在造成严重数据损失、安全事故或全系统中断的证据；F-0001 的两个 404 也尚未建立到 Direct 的排他因果。当前只能保留 P1 候选。

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
| 严重级别 | **P1 候选**；未完成 RV-0003 前不作最终 P1 |
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
| 是否需要独立复核 | 是，RV-0003；P1与权限边界强制100%重追 |

## F-0022｜正式运行目标没有 OutboxRelay 与 RuntimeScheduler

| 字段 | 记录 |
| --- | --- |
| 模块 | 共享状态 / runtime outbox、inbox、job、scheduler |
| 类型 | 异步控制面缺失、注册与部署边界漂移 |
| 严重级别 | **P1 候选**；未完成 RV-0004 前不作最终 P1 |
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
| 是否需要独立复核 | 是，RV-0004；P1且跨模块异步链强制100%重追 |

## F-0023｜生产 PostgreSQL 17 编排与仅接受 PostgreSQL 16 的初始化脚本互斥

| 字段 | 记录 |
| --- | --- |
| 模块 | 共享状态 / PostgreSQL 创建与恢复 |
| 类型 | 版本契约、首次初始化、灾难恢复路径 |
| 严重级别 | **P1 候选**；未完成 RV-0005 前不作最终 P1 |
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
| 是否需要独立复核 | 是，RV-0005；P1和恢复路径强制100%重追 |

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
| 严重级别 | **P1 候选**；未完成 RV-0007 前不作最终 P1 |
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
| 是否需要独立复核 | 是，RV-0007；P1强制从producer到浏览器/SDK重新取证 |

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
| 严重级别 | **P1 候选**；未完成 RV-0008 前不作最终 P1 |
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
| 是否需要独立复核 | 是，RV-0008；必须重新从角色/entitlement到数据库写入取证 |

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
| 严重级别 | **P1 候选**；未完成 RV-0009 前不作最终 P1 |
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
| 是否需要独立复核 | 是，RV-0009；必须重新检查线上角色数据、不能只复述旧handoff文档 |

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
