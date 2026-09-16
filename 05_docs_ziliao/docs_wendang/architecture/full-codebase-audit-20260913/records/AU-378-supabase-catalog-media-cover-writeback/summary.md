# AU-378｜Supabase 商品封面回写

`20260815030000_catalog_media_cover_writeback.sql` 定义批量回写产品封面的 service-role RPC：输入必须为 1–200 条、产品 ID 不重复、所有产品均存在，且封面 URL 必须符合当时的 `img.hbbtzn.com/catalog/products/...` 路径。它不会接受浏览器或匿名调用。

公开目录与购物车展示当前统一经过 `commerce-api` 的 `publicCatalogCoverUrl`。该逻辑只把 `media.zhudatuan.com` 识别为正式媒体源；旧 Amazon 图源经 HMAC 签名代理读取，非同源且非受准来源则拒绝。因此旧回写 RPC 若继续写入其原先允许的 `img.hbbtzn.com` URL，当前公开 API 不会把该 URL 作为可展示的规范封面返回。

全仓未找到此 RPC 的应用、任务或脚本调用；Compatibility 分支已存在同名 forward-only 迁移，将写入域改为 `media.zhudatuan.com`，但它不能证明当前 Supabase 迁移执行序列已接入该替代。该对象列为 G1：运行或运维调用及历史媒体兼容尚未排除，禁止删除；需在独立复核中核对实际迁移 ledger、现有 cover_url 域分布与媒体写回作业。

未发现新增 P0–P3；未执行媒体写入、对象存储检查、测试或线上访问。
