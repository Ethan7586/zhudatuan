# AU-054｜experience 页面配置、发布与 CDN 投影深审

- 运行入口：`ExperienceModule` 在 Commerce module 表中注册全部 Experience operation；`experiencepublish` 在 Job catalog 注册为 queue `experience` 的 Worker。Identity API 另以 `IdentityOperatorExperienceModule` 只暴露四个创建/读取/更新/复制操作，属于受限运营面而非 Commerce 主发布面。
- 主链：运营端写入 application/version → publish 在同一 operation transaction 创建 scheduled release 与 `experience.published` outbox → outbox 转为 job inbox → Worker 先将规范 V2 文档按内容哈希写入对象存储，再以 inbox 行锁与 application advisory lock 激活 publication/release/application，并在提交后更新 public-read cache。
- 数据和失败边界：application/version/release/binding/publication 都有外键、状态检查和 RLS；对象路径、规范化字节、SHA-256、content type、大小及 clean scan 都被上传/复用前后核对。对象写入先于数据库激活，崩溃后可按不可变内容寻址安全重试；交易失败不会将 release/publication/inbox 标为完成。
- 公开读取仅通过 `experience.read_published(mall)` 选择已激活、已验证且有效的绑定；缓存只是该读路径的短期投影，不是发布真源。
- 未发现 P0/P1 新问题。新增 F-0144（P2）：主 Experience 主链的 application/version/publish/worker 事务没有模块专用行为测试；现有测试只覆盖 identity 受限操作清单和 CDN publisher 的局部对象语义。正式 Vitest 未运行（固定审计 worktree 缺 `vitest` 命令），未安装依赖或改变运行状态。
