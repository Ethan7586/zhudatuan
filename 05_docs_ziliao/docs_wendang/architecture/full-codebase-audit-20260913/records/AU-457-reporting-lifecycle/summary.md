# AU-457｜报表投影、导出与授权生命周期

- 主审 `20260821048000_reporting_lifecycle.sql`（98 行），并人工反查 reporting repository、projection/export Worker 与任务注册；未执行迁移、导出、对象访问或线上查询。
- 迁移为导出补齐范围授权快照、游标、记录数、对象大小、扫描、生成/错误状态；旧 completed 导出失效。完成状态被约束为必须拥有 clean 对象、哈希、大小、生成与过期时间，防止未扫描或无过期控制的可下载结果。
- `reporting.projectionevent` 用 event id 去重，repository 继续维护 projection offset/watermark；导出 SQL 以 job scope 为连接条件并记录进度。资源 scope 和 RLS 接入统一授权路径。
- **G0**：现有 API、投影与导出 Worker 依赖该模型。**GX-0016**：导出历史、授权快照及对象安全边界迁移，禁止删除、改写或单独重放。未发现新增 P0–P3；未验证真实对象扫描、跨 scope RLS、投影重放与过期恢复。
