# AU-741｜Staging 候选准备工具

- 审阅范围：普通 staging `check.mjs`、内部 TLS 生成、candidate release 准备、Caddy candidate 安装和成本批准验证。
- 审阅方式：深入审阅有本地/主机写入能力的 TLS/release/Caddy 脚本的 root、路径、符号链接、原子写入和人工后续步骤；check/cost validator 结构性审阅。未执行任何脚本。

## 审计结论

- **G0：全部保留。** 普通 staging check 固化 API/Jobs、Caddy、delivery 与环境隔离；TLS 脚本只接受固定 root-owned 路径、拒绝既有目标、临时生成后以 `wx`/0600原子落盘；release 准备拒绝 dirty worktree、符号链接、覆盖输出和输出/归档重叠。
- Caddy installer 验证 root ownership、managed marker、候选 Caddy syntax和 IMDS dedicated-host 条件，然后以临时文件 `mv` 安装；它刻意不 reload，要求独立批准步骤复核已安装字节并 daemon-reload/reload。
- 成本验证器要求结构/时间窗/外部证据 hash、资源价格和总额精确匹配、Ethan 显式批准；不读取或创建云资源。实际主机用户、IMDS、systemd/Caddy、cost evidence 和人批准均未验证。
