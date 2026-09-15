# 全代码库系统审计｜12 最终摘要

## 基线与覆盖

- 固定基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`（`origin/zdt-next`）；审计分支始终未变基到后续主线。
- 文件级覆盖：4,238 个基线受控文件均在 `10-coverage-manifest.csv` 中记录；人工源码与结构化配置主审阅池为 3,238 个文件、400,887 物理行，其中人工源码为 3,073 个文件、322,808 行。
- 排除逐行风格审阅的范围：69 个自动生成文件、507 个视觉历史归档、3 个已跟踪编译产物及第三方/二进制资源；均已记录生成/保留原因。两项高风险工具仍标为专项专家复核，未执行。

## 真实架构与主要瓶颈

- 客户端由 Console React Router、Auth Web host/runtime registry、Storefront App Router/Worker 和 Miniapp 片段组成；Storefront Worker 先进入 Compatibility public router，再回落页面路由。
- Canonical Commerce 以显式 API/Jobs target、模块/操作/任务注册表运行，依赖 PostgreSQL、Redis、对象存储与 Secret/KMS；数据库迁移、节点 manifest 和发布策略构成运行契约。
- GitHub workflow、release manifest/agent、systemd、Caddy 与 OSS 构成发布面。最大的通信与可靠性瓶颈是发布控制面写入的制品指针与 active Caddy/运行单元读取的指针并非同一事实源，且 Direct 与受保护发布语义分裂。

## 当前风险档案

| 等级 | 当前数量 |
| --- | ---: |
| P0 | 0 |
| P1 | 23 |
| P2 | 199 |
| P3 | 124 |
| NIT | 7 |
| 已关闭 | 1 |

所有可定位 P1 已完成独立复核。当前候选台账为 G0 67、G1 142、G2 5、G3 0、GX 52；GX 中 50 个有唯一编号和复核记录，另两个仅存在于历史累计数字中，未被虚构为对象。

## 值得保留与最危险问题

- 值得保留：显式模块/路由/Job 注册、Node Manifest 与运行时环境解析、AutoNode 的 ownership ledger/补偿边界，以及部分 systemd 的最小权限隔离和 ready 检查，均提供了良好的可验证性基础。
- 最危险：财务动作 proof 已签发却未在命令事务消费（F-0243/P1）；其次是 Auth runtime 可选择未绑定 API 目的地（F-0083/P1）和发布/Caddy 制品指针分裂（F-0001/P1）。

## 最安全的前三个治理批次

1. F-0243：财务动作 proof 的事务消费与版本断言。
2. F-0083：Auth runtime 的 Manifest/摘要/目的地绑定。
3. F-0001：Auth/Console 发布指针与 active Caddy 的单一事实源。

每批都必须从修复当日最新主线另建独立分支；不得在本审计分支修复。

## 已知未知项与交付状态

- 两个 GX 历史计数没有对象标识；线上实际 runtime、Caddy/指针、数据库/RLS、备份恢复、外部 CI 与云资源状态均只在已有只读证据范围内结论，未验证处保持未知。
- 审计分支：`codex/full-codebase-audit-20260913`。最后检查点以交付时 `HEAD` 为准；本摘要不声称该分支可部署。
- 未推送、未合并、未部署；未修改生产代码、测试、配置、工作流、迁移、依赖或锁文件。
