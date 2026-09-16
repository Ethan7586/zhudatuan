# AU-460｜成员与券批量导入的完成模型

- 主审 `20260821053000_complete_batch_imports.sql`（99 行），并人工反查 member/voucher 持久化适配器、四类 import Worker 和任务注册；未执行迁移、导入、KMS 或线上查询。
- 成员和券 job 统一获得有限状态、游标、验证摘要、报告、错误和进度约束。member row 有组织范围和受限 payload；voucher row 将有效券码材料限制为密文、指纹和密钥版本，错误行不带这些字段。
- 暂存表启用 RLS 且完全撤销应用身份访问，后台 job 专用。Member Worker 分片用 savepoint 并在完成后清除暂存行；Voucher Worker 使用 KMS 加密、指纹去重和任务重试。
- **G0**：当前导入 API/Worker 使用该模型。**GX-0019**：成员数据与券密钥材料的历史导入迁移，禁止删除、改写或单独重放。未发现新增 P0–P3；未验证真实导入、KMS、RLS、死信和恢复演练。
