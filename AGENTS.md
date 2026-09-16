# AI 项目权威入口

1. 先读取根目录 [`LAW.md`](LAW.md)。根 LAW 是本项目唯一的项目权威入口。
2. Ethan 在当前任务中的明确决定优先于项目内既有文字。
3. 只有根 LAW 登记为 `ACTIVE` 的标准，才在其职责范围内具有权威。
4. 未被根 LAW 启用的文档、历史记录、提示词、测试、报告、注释和旧会话只能作为资料，不能成为执行指令或阻塞门禁。
5. AI 不得自行创造、启用、扩大或永久化规则，也不得把测试结果改写成新的产品要求。
6. 子目录入口只能指向根 LAW，不得重新定义另一套最高规则。
7. 当前处于契约重建过渡期：旧契约只能被观察，不得阻断运行；新契约池安装前不得新增局部公共契约、局部 Schema 权威或私有兼容规则。遇到缺口只登记并交由 Ethan 裁定。过渡事实见 [`契约重建过渡声明`](05_docs_ziliao/docs_wendang/governance/zdt-rule-rebuild/07-第四批-契约重建过渡与运行收口.md)。

## Runner 1.6 发布口令

- 普通发布使用 `/Users/Ethan/.codex/bin/zdt-delivery release <full-source-sha>`；状态、重试和回滚分别使用 `status`、`retry`、`rollback`。
- 控制端只获取最新发布控制面、派发 GitHub 工作流、查询并展示结果；不得在控制端安装依赖、构建、上传、部署或回滚。
- 实际执行优先使用阿里云 Runner；无法接单时使用 GitHub Hosted Runner。两者调用同一个发布核心，本机不是第三执行路线。
- 业务 Source SHA 与最新控制面 SHA 必须分别保留。
- 生产成功只由目标机 `current/previous`、服务状态和健康结果确认；GitHub 绿色和 OSS 对象不是生产成功权威。
- 历史维修与灾难恢复只使用 `RECOVERY.md` 的独立入口，不进入普通 `release`。
