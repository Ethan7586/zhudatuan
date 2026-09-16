# AU-001｜仓库入口与自动发现机制审计总结

## 1. 唯一目的与边界

本单元只建立“文件如何进入构建、路由、进程与发布”的第一张证据图。允许读取根工作区、前端入口、Commerce bootstrap/entry、release engine、工作流、systemd/Caddy/Cloudflare 配置，并对授权 ECS 做只读运行核对；只允许写本审计目录。

明确未做：业务模块实现深审、数据库/权限结论、垃圾代码分类、修复、删除、依赖安装、全量测试、构建、推送、合并、部署、服务重启或线上写入。

- 预计时间盒：75–90 分钟。
- 超时/停止条件：发现已由两类证据证明的 P0、基线漂移、审计目录外改动或无法隔离的重叠写入。
- [UNKNOWN] 本单元取证跨越了前一轮会话，可靠的连续人工耗时记录未保留；不伪造实际分钟数。没有因 F-0001 擅自升级为 P0。

## 2. 基线与工作区

- [FACT][E-AU-001-001] 固定基线仍为 `5a1ce71eebbefaa826368a9e1dc17730f9363bc4`。
- 审计分支：`codex/full-codebase-audit-20260913`。
- AU 开工 HEAD：`337562a37b86b568ea6680879e32831b2adf3b6b`。
- 开工状态：干净；没有吸收基线后 origin 变化。

## 3. 覆盖

- 深入审阅：14 个人工源码文件，863 物理行；每个文件有 29 字段 FILE 记录、全部导出符号记录及适用的关键函数记录。
- 结构性审阅：168 个人工源码/配置文件，23,664 物理行；只核对入口、注册、构建、发布或运行字段，没有被标成深入审阅。
- 自动生成支持证据：2 个节点 manifest、396 物理行；保持“自动生成”状态，只核对生成来源和消费者。故本 AU 一共触及 184 个证据文件、24,923 物理行，其中人工深审与结构审阅池为 182 个文件、24,527 行。
- 文件级状态以 `10-coverage-manifest.csv` 为唯一总账；结构性证据集包括 43 个 workspace manifest、前端启动/route manifest、Commerce 非测试 entry、release/workflow/node/systemd/Caddy/Cloudflare 入口和根权威文档。
- 自动生成代码、业务实现、测试实现、迁移与归档没有在本 AU 提升审阅状态。

## 4. 结论

1. [FACT] 核心生产可达面以显式注册为主：Console 15 模块、Commerce 32 运行模块、OperationCatalog 路由、33 Job、10 个正式服务 target。
2. [FACT] 目录/文件发现只出现在受控位置：npm workspace、Storefront App Router、全量 Commerce `*Main.ts` 构建和若干配置生成链。
3. [FACT] Storefront 将 Compatibility public router 直接编入 fetch 入口，因此 Compatibility 服务目录有真实生产调用线索。
4. [CONFLICT] fufu Console 的发布 pointer 与线上 Caddy 静态根分裂，公网根在观察时为 404；记录为 F-0001 P1 候选，不是 P0。
5. [FACT] Playwright 正式入口有四个不存在的 workspace；ESLint 三个前端规则块漏掉 auth-web/storefront-web。
6. [CONFLICT] 线上运行单元清单包含两个基线内没有同名 unit 文件的 active service；其所有权尚未确认。

## 5. 问题与复核

| 编号 | 等级 | 状态 | 二次复核 |
| --- | --- | --- | --- |
| F-0001 | P1 候选 | 当前路径和 404 已复现；影响范围/根因 UNKNOWN | RV-0001 强制独立复核 |
| F-0002 | P2 | npm workspace 失败已复现 | 测试专项修复后反事实验证 |
| F-0003 | P2 | 当前 glob 与目录直接冲突 | 质量专项反事实验证 |
| F-0004 | P3 | 两个仓库外 active unit 已确认 | 运维专项追来源 |

P0 数量为 0。本单元未建立任何 G0–GX 垃圾代码候选。

## 6. 验证纪律

- 运行了一个与 F-0002 直接相关的 npm workspace 解析命令；失败只记录，没有修复。
- 对 fufu Console 运行一次规定的直连 SNI 只读请求，并读取 active Caddy、符号链接和文件存在性。
- 对生产只读取 IMDS、systemctl 状态和 unit 元数据；未读取环境文件内容。
- 未运行完整 E2E、全量测试、typecheck、build 或数据库重放。

## 7. 自检

- 10 条入口关系完成同一主审的反向重追抽检；P1 候选不把该抽检冒充独立复核。
- 所有 UNKNOWN 都写明缺少的外部运行、模块实现或所有权证据。
- 未从零引用、文件名、文档或当前 404 推导删除结论。
- 未修改任何生产代码、测试、配置、工作流、迁移、依赖、锁文件或生成清单。
- 下一单元应是 AU-002 页面与运行入口总图；按照用户协议，本检查点提交后停止。
