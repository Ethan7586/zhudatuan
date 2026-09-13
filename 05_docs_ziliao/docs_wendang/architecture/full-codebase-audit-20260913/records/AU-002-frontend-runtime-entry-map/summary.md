# AU-002｜Console、Auth、Storefront、Miniapp 页面与运行入口总图

## 1. 唯一目的与边界

本单元只回答四个客户端目录中的文件如何成为页面、如何进入运行时、如何加载样式与资源，以及页面到 API 的第一跳。后端 handler、数据库、完整身份/支付业务、真实视觉验收和任何修复均不属于本单元。

- 固定基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`。
- 审计分支：`codex/full-codebase-audit-20260913`；AU 开工 HEAD 为 `1a772714236f902a59bb9d98355a1f0080a9253f`。
- 纳入：`01_core_hexin/apps/{console,auth-web,storefront-web,miniapp}` 的 700 个受控文件，以及直接决定它们入口/质量契约的根脚本和机器清单。
- 明确未做：安装依赖、构建、全量测试、浏览器视觉验收、后端实现深审、垃圾代码分级、修复、删除、推送、合并、部署或线上写入。

## 2. 覆盖

- 四个应用共 700 个受控文件；其中 643 个当前人工可执行源码文件为 92,095 物理行，另有 46 个结构化配置/图片/字体等资源文件、8 个已确认生成文件和 3 个已跟踪构建产物。
- 本单元新增深入审阅 13 个关键入口文件、1,474 行；连同 AU-001 已深审的 Console 两个路由目录文件和 Storefront Worker，四应用入口池累计深入审阅 16 个文件、1,756 行。
- 其余 673 个非生成/非构建文件只提升为“已结构性审阅”：已逐文件进入本单元文件清单，并核对静态/动态 import、框架发现、路由、CSS/资源引用和第一跳角色；这不等于实现逻辑已深审。
- 8 个 Miniapp 生成输出继续标为“自动生成”，3 个 Console dist 文件继续标为“构建产物”。
- 全仓累计状态在 `10-coverage-manifest.csv` 中按文件记录；本单元没有用“100%”替代文件数和行数。

## 3. 真实入口结论

1. [FACT][E-AU-002-003][E-AU-002-004] Console 是 Vite/React Browser Router 应用：HTML → runtime config → document prefetch → 动态 providers → 作用域 loader/shell → 15 个显式 manifest、34 条模块 lazy route。
2. [FACT][E-AU-002-008][E-AU-002-009] Auth 是无 Browser Router 的 host/query 分流应用：构建内 registry 可使页面先渲染，同源 `identity-runtime.json` 随后校验/安装；App 当前只挂载 ConsumerIdentityPage、OperatorIdentityPage 或无效入口页。
3. [FACT][E-AU-002-013][E-AU-002-014][E-AU-002-015] Storefront 是 vinext App Router；同一个 Worker/Node fetch 先执行 host/runtime 门禁和 Compatibility public router，再回落页面 handler。认证业务再通过懒加载 productionApi → SDK client 进入节点绑定 API。
4. [CONFLICT][E-AU-002-018][E-AU-002-019][E-AU-002-020] Miniapp 只有 9 个文件和一个 `App()` 入口，没有 manifest/pages/API client/action dispatcher；与此同时 candidate、delivery matrix 和审计脚本仍把它当作当前客户端。其外部完整工程是否存在仍为 UNKNOWN，不能据此删除任何文件。

## 4. 本单元问题

| 编号 | 等级 | 结论 |
| --- | --- | --- |
| F-0005 | P2 | Auth 的 owner-approved 机器清单、运行挂载和锁定哈希三者漂移；正式门禁在 App 首个哈希处失败 |
| F-0006 | P2 | Miniapp 的“当前制品”“已实现平台”和实际可启动拓扑互相冲突，navigation 正式入口必现 ENOENT |
| F-0007 | P2 | 9 个 Auth 成功响应 Schema 的 `safeParse` 结果被丢弃，随后用类型断言继续消费未验证数据 |
| F-0008 | P2 | 前端边界门禁在 13 个未登记项上失败，不能通过 canonical-hard-cut 的 architecture 链 |
| F-0009 | P2 | 前端文件证据清单漂移：当前 958 项，对比记录新增 174、删除 2、变化 295 |
| F-0010 | NIT | Console 路由测试标题写“32”，断言和实际目录均为 34 |

本单元没有发现 P0；没有新增 P1、G3 或 GX，因此不触发立即停止或强制独立复核。F-0001 的既有 P1 候选保持原状态。

## 5. 验证结果

- `npm run check:approved-ui`：失败，首个错误是 Auth App 锁定哈希不一致；独立只读哈希核对发现 accounts 锁定集合共有 3 个漂移文件。
- `npm run check:navigation`：失败，读取缺失的 Miniapp `app.json` 时 ENOENT。
- `npm run check:frontend`：失败，13 个新增 DESIGN_TOKEN_BYPASS，另报告 33 个已登记项。
- `npm run check:frontendmanifest`：失败，`FRONTEND_FILE_MANIFEST_DRIFT`；内存重算得到 958/786 及 174/2/295 差集。
- `npm run check:tests`：通过，但对 Miniapp 只检查 `app.js` 是否存在，因此不能反证 F-0006。
- `npm run check:runtimegraph`：在加载 TypeScript 分析器前因本审计 worktree 未安装依赖而停止；源码仍明确要求当前不存在的 Miniapp API client。该命令结果只记录为“环境阻塞”，不写成运行图检查结论。
- Console/Auth/Storefront 的 Vitest 定向用例未执行：审计 worktree 没有 `node_modules/.bin/vitest`，且本单元禁止安装依赖。测试文件和分支覆盖只作静态可信度评估。

## 6. 删除纪律与未知项

- 六个无 CSS 文件名消费者的样式文件、未挂载的 Auth LoginPage、未进入当前 route 的 Console 子图都只记录可达性，不进行 G1–GX 分级。
- Storefront `/[device]` 会接住未知单段路径，但本单元没有实际 HTTP 响应证据；“是否返回 200 而不是 404”保留为 UNKNOWN。
- Cloudflare h5/mini 的实际发布者、Miniapp 外部工程、四应用线上制品是否与固定基线一致均未验证。
- 所有后续修复建议只是报告数据。若 Ethan 决定修复，必须在当时最新 `zdt-next` 的独立修复分支进行；本审计分支不会转为修复分支。

## 7. 检查点纪律

CP-02 只包含本审计目录内的报告和覆盖清单。提交前必须确认没有源码、测试、配置、工作流、迁移、依赖、锁文件或生成输出被夹带；提交后停止，等待下一 AU 授权。
