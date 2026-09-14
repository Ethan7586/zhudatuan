# AU-123｜Extension 安装列表读取与模块边界深审

安装列表通过 repository list 和 RLS scope 过滤；HTTP 层只注册 read operation。public index、manifest、测试和兼容入口的边界一致，未发现 P0–P3。
