# 全代码库系统审计｜04 问题清单

## 1. 计数口径

本文件只收录已经形成最小证据链的问题。AU-001 结束时：P0 0、P1 候选 1、P2 2、P3 1、NIT 0。P1 项尚未完成第二轮独立复核，因此不会写成最终定级。

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

## 2. 本单元未定级事项

- [UNKNOWN] Cloudflare h5/mini wrangler 配置无仓库内发布调用者。缺少外部平台证据，不能写成“未部署”或垃圾代码。
- [UNKNOWN] release workspace resolver 不处理通配 export 的规则是否会影响未来/外部服务构建；当前目标图没有证明故障，不列问题。
- [CONFLICT] README、DEPLOYMENT、SOURCE-MANIFEST 与当前 release/域名配置存在漂移；统一文档专项再决定是 P3 还是历史归档职责。
- [UNKNOWN] 非 target 白名单的 Main 入口是否承担本地、staging、恢复或兼容职责；不进入死代码清单。
