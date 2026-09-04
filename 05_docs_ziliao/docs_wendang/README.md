# zdt-next 文档中心

`05_docs_ziliao/docs_wendang/` 是 `zdt-next` 项目级文档的统一入口。

## 当前目录

- `architecture/`：旧系统审计、新系统架构、边界与迁移设计。
- `prompts/`：经过保留的标准提示词和专项实施提示词。

## 固定规则

1. 新增的产品说明、架构书、审计报告、迁移记录和决策记录统一放在 `05_docs_ziliao/docs_wendang/` 下。
2. 新系统总说明使用 `05_docs_ziliao/docs_wendang/zdt.md`；由 Ethan 审核确认后，才成为产品与架构基线。
3. 提示词统一放在 `05_docs_ziliao/docs_wendang/prompts/`，不再散落到桌面或项目根目录。
4. `AGENTS.md` 必须保留在项目根目录，供 Codex 自动加载。
5. `ZHU-VI-1.3/` 包含可运行源码、预览和视觉资料，作为完整设计系统保留在项目根目录；其组件内部文档随源码放置。
6. 文档中的绝对路径发生变化时，必须同步修正引用，避免继续指向旧桌面目录。

## 当前入口

- 旧系统架构审计：`architecture/00-zhudatuan-架构审计.md`
- zdt-next 目标系统架构图：`architecture/01-zdt-next-目标系统架构图.md`
- GitHub 分支谱系与收口图：`architecture/02-github-分支谱系与收口图.md`
- 阿里云运行真值与生产反推架构：`architecture/03-阿里云运行真值与生产反推架构.md`
- 阿里云生产状态机器快照：`architecture/evidence/production-state-2026-09-02.json`
- GitHub 分支关闭账本：`architecture/branch-closures/README.md`
- WCHS 朋友架构参考源：`architecture/reference-sources/wchs-backend-reconstruction.md`
- 标准与专项提示词：`prompts/`
- 新系统总说明：`zdt.md`（待 Ethan 定稿后建立）
