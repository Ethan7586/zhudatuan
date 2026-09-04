# OSS/CDN 发布投影

Catalog 与 Experience 是商品和商城装修真值；OSS/CDN 只保存已发布 Version 的不可变投影，不承担交易写入或回退真值。

- Job 从 Target Schema 读取已发布 Listing、Price Summary、Asset 与 Experience Version。
- 发布前验证 Schema、资源 Hash、Action Operation、域名、Capability、Listing 和 Collection 引用。
- 对象键包含 Mall、Version 与内容 Hash；对象使用一年 immutable 缓存。
- `releases/current.json` 或 Mall Publication 指针使用 `no-store`，仅在完整投影上传并验证后原子切换。
- Storefront 与 Miniapp 读取同一 Version/Hash；Checkout 仍通过 Commerce 重验资格、价格、库存和有效期。
- 图片上传执行大小、MIME、Magic Bytes、恶意软件、Image Bomb 与 Scope 校验；私有对象只返回短期签名 URL。

生产静态发布由签名 Release Bundle 和 `infrastructure/aliyun/deploy.sh` 完成，不保留独立发布脚本、浏览器直传、测试 Bucket 默认值或本地文件回退。
