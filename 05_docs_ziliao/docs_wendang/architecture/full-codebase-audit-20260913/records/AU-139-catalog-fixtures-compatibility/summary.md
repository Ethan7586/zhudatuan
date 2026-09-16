# AU-139｜Catalog 测试夹具与兼容入口深审

两个 JSON fixture 都被已审的 package/media persistence 测试直接加载，并明确标注 simulated/mock；它们不是运行货盘或生产配置。其余八个 root/legacy 路径均为单向 re-export，分别指向已深审的 Catalog module、operation、public port、selected operator module 或 import worker；主 jobs catalog 仍从 legacy job path 导入 CatalogImportProcessor。

全部 10 个 Catalog 剩余文件均已获得文件级状态；兼容入口归类 G0，保留为仓内旧 import 和公共 export 的稳定路径。未发现 P0–P3 新问题；未运行测试（本批不引入新行为，且 AU-138 已记录审计 worktree 缺少 Vitest）。
