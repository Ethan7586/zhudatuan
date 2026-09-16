# AU-458｜扩展安装、签名与健康检查生命周期

- 主审 `20260821051000_extension_lifecycle.sql`（113 行），并人工反查 extension repository、健康 Worker 和任务注册；未执行迁移、外部请求或线上查询。
- 迁移限制 manifest/contract 哈希、签名、大小、安装配置、HTTPS endpoint 与 secret 引用；旧 draft 安装转为 disabled，enabled 安装改为范围内部分唯一。RLS 使应用按 scope 读取安装及健康历史，禁止应用写 manifest/contract 或删除历史。
- `extensionhealth` 启动扫描并周期再调度；Worker 加载运行时安装、记录检查、按健康结果转状态并发布 enabled/disabled/degraded 事件。
- **G0**：当前任务、安装查询与 Channel 扩展路径依赖该模型。**GX-0017**：外部扩展供应链、凭据引用与历史状态切换，禁止删除、改写或单独重放。未发现新增 P0–P3；未验证签名/健康端到端、真实 secret 可见性和恢复演练。
