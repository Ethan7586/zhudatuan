# AU-290｜Compatibility 商品媒体域边界

该 forward-only migration 将 Compatibility `api_sync_catalog_media_covers` 限制为 `media.zhudatuan.com/catalog/products/<id>/<hash>/cover-<size>.webp`，校验数组大小、重复 ID、产品存在性，并只向 service_role 授权。它明确不回写历史行，须先确认对象已迁移；Compatibility API 的公开媒体逻辑也只将该正式媒体域视为 canonical，其他来源需经过受签名代理或拒绝。

仓内没有该 RPC 的自动生产者，但 SOURCE-MANIFEST 明确指定它为 Compatibility 媒体写回前置 migration。这是一次性/运维调用责任而非无用代码，候选分类为 G0；不得因零静态调用删除。未发现 P0–P3 新问题；实际对象存在性与生产服务调用未验证。
