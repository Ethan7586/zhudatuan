# AU-211｜Commerce AuditSink contract 深审

AuditSink将操作审计与访问审计限定为在当前数据库事务中写入的应用层端口；CommerceRuntime绑定唯一RecordAudit实现，底层redaction、hash chain和persistence由既有深审记录承接。无P0–P3问题。
