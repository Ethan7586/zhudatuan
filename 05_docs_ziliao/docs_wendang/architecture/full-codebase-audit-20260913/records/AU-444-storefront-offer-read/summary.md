# AU-444｜Storefront 商品报价只读接口

## 范围与方法

- 主审文件：`02_platform_pingtai/database/supabase/migrations/20260821034000_add_storefront_offer_read.sql`（40 行）。
- 交叉核对：后续 member operation 对齐、Web business scope resolver、Pricing 操作和 Storefront canonical client。
- 本批为静态契约与调用关系审阅；未执行 API、数据库或线上验证。

## 运行结论

迁移登记 `pricing.offers.read` 的 operation、permission、capability 和 platform entitlement，并把 catalog listing、pricing offer、inventory read 写入 self-service role；该 operation 随后由 Pricing 模块、SDK、OpenAPI、Web business API 与 Storefront 页面实际调用。

初始 capability audience 写作 operator；后续 `align_member_operations` 和当前 SDK/operation contract 明确将 browse operation 对齐为 member，且 Storefront scope resolver 同时覆盖报价、上架和库存读取。这是可追溯的契约演进，而非初始迁移无用的证据。

## 审计结论

- G0：正式报价读取 API、权限和能力登记，不是删除候选。
- 前后版本的 audience 演进应在契约生成/发布专项中保持一致；本批未执行真实未授权访问或报价越权验证。
- 本批未新增 P0–P3。
