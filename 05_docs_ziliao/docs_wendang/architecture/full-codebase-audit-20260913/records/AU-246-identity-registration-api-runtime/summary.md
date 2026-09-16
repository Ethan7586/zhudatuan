# AU-246｜Commerce IdentityRegistrationApiRuntime 深审

独立身份注册 API 在开始监听前加载节点清单与identity runtime定义，读取数据库/会话/identity密钥，并可选加载微信凭据；随后验证registration database、运行契约、数据库边界、节点数据库清单和对象存储readiness。成功后才将访问管线、审计、密钥、KMS、对象存储和可选微信网关绑定进容器。现有fixture锁定manifest来源、密钥引用和兼容性查询，但不执行runtime组装、失败时pool关闭、容器绑定或微信开关，记录F-0225/P2；无P0/P1问题。
