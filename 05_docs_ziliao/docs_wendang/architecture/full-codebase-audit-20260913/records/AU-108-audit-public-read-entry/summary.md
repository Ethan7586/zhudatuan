# AU-108｜Audit 公开端口、读取 query 与 HTTP module 深审

AuditPort 是 Audit 的跨模块 repository contract，涵盖链前序、append、scope read、archive batch/complete 和 schedule。audit.records.read 必须先取得 access scope，以 fetch plus one 形成 keyset next cursor。AuditModule 仅将 auditRoutes 注册到 Commerce module，路由从 DI 取得 repository、pool 与 audit sink。

AU-051 已完成 append/chain、archive/recovery 和 redaction 逻辑的深审；本单元只覆盖当时仍未列入深入审阅的四个实际接口层/领域记录文件，不重复阅读。

结论：未发现 P0–P3 新问题。Vitest 未安装，未执行。
