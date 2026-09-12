# AI Delivery Engine

`04_tools/release-engine` 是项目中立的发布内核。它只处理 Git 差异、目标影响图、必需验证、逐目标制品、锁、候选、指针、验证和回滚；不内置域名、节点名、端口或业务服务。

## 接入一个新项目

每个项目只新增两份声明：

1. 构建端 adapter：声明项目根、状态目录、文件影响规则、目标依赖、定向测试、构建命令、制品输入、节点及独立指针；
2. 服务器 policy：声明允许的项目、节点、指针根、依赖层、候选/健康检查、唯一可重启进程和受保护进程。

通过 `--adapter <path>` 或 `AI_DELIVERY_ADAPTER=<path>` 选择项目，不复制内核。远端代理按 `--project` 读取 `/etc/ai-delivery/projects/<project>.json`，未列入策略的目标关闭式拒绝。

## 强制不变量

- 未知文件选择可达运行目标上界并继续，不能拒绝或跳过；
- 测试、文档和夹具可以只运行验证，不产生候选；
- 数据库迁移是独立目标，先于同一提交中的实际消费者且不重启服务；
- 生产数据库候选携带同一 source SHA 编译的官方 migration runner、完整受管 migration inventory 与 history contract；远端仅从既有受管 env/Secret Store 连接来源取凭据，执行前后按 `supabase_migrations.schema_migrations` 记录 ledger 摘要和实际选择集；
- 数据库执行失败时消费者 activation 保持未执行；数据库迁移只支持前向修复，目标指针回退不构成数据库回滚，receipt 会明确记录发布引擎未捕获恢复快照；
- 一份源码只构建一次，同一内容摘要可进入多个节点；
- 节点共享制品，不共享 `current/previous`、运行配置、锁或回滚；
- 生产机不安装依赖、不编译源码；
- 候选失败不切流，切流后失败恢复原指针；
- 所有阶段输出真实耗时；
- 项目 adapter 与远端 policy 必须逐项对齐；
- 制品来源、目标隔离和恢复证据只证明结果，不决定授权。

`zdt-next` 的正式用法、迁移顺序与当前生产边界见仓库根目录 `AI-DELIVERY.md`。SFL 项目以 1.8 的一次构建、节点独立发布指针和禁止被动跨节点借道为上位标准。
