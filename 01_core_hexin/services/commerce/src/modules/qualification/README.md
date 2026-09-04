# qualification_zizhi

资质模块统一骨架样板。其他模块只能通过 `index.ts` 和 `01_public_gongkai` 使用本模块，不能引用内部实现。

| 目录 | 含义 |
| --- | --- |
| `01_public_gongkai` | 对其他模块公开的能力、契约和事件 |
| `02_domain_yewu` | 资质自身业务模型和规则 |
| `03_application_yingyong` | 用例、命令和查询 |
| `04_adapters_shixian` | 数据库及外部系统实现 |
| `05_interface_jieru` | HTTP、任务和运行时接入 |
| `06_tests_ceshi` | 模块内部单元测试 |
