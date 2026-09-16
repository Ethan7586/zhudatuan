# AU-300｜Compatibility 商品媒体初始写回迁移

该 initial migration 创建批量商品封面写回 RPC，校验数组规模、重复商品、商品存在性和当时的 `img.hbbtzn.com` CDN URL，并仅向 service_role 授权。AU-290 已用同名 `create or replace` 将运行有效实现前向替换为 `media.zhudatuan.com` 域，同时明确不回写历史行。

本文件不再代表当前 URL 接受规则，但仍是已应用 migration 的历史 schema 责任；删除会破坏从空数据库重放的版本链。分类 G0，非删除候选。未发现 P0–P3 新问题。
