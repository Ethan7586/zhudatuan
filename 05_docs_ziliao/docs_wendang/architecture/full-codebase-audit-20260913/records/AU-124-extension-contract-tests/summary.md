# AU-124｜Extension 公共 repository 契约与领域测试深审

`ExtensionLoader` 定义 loader、candidate、repository、health 和 state-sink 的唯一跨模块契约；factory 只构造 PgExtensionRepository。Installation 与 Manifest 测试覆盖核心状态转换和 manifest 限制。未发现 P0–P3。
