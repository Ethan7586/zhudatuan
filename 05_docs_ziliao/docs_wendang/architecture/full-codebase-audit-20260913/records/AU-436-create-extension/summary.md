# AU-436｜扩展与安装管理初始模型

## 范围与方法

- 主审文件：`02_platform_pingtai/database/supabase/migrations/20260821025000_create_extension.sql`。
- 交叉核对：扩展生命周期迁移、范围授权解析、领域契约发布与 Commerce extension repository/health worker。
- 本批为静态迁移语义与调用关系审阅；未执行数据库重放、构建、测试、外部健康检查或线上操作。

## 运行结论

该迁移建立带哈希和签名的 manifest、每个 scope 的安装记录、连接健康历史、契约版本和状态切换历史。安装外键固定 manifest 版本，非 `private` 安装要求 base URL、secret reference 和 health operation；唯一键限制同一扩展在同一 scope 的安装记录。

后续生命周期迁移把启用唯一性、配置大小、RLS 与可见状态收敛为当前模型。Commerce repository 实际锁定和更新安装状态、记录状态历史，health worker 读取待检查安装；通知、渠道和 operation contract 消费相同生命周期事件与读取接口。

## 审计结论

- G0：扩展清单签名、按范围安装、健康记录和激活审计的基础关系模型，不是删除候选。
- 真实签名验签、secret reference 的存取边界和外部健康检查结果未在本批运行验证；保持未验证。
- 本批未新增 P0–P3。
