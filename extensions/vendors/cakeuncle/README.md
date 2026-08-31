# Cake Uncle integration

This package implements the documented Cake Uncle channel signature and HTTPS transport. Secrets are loaded from the platform Secret Store as `channelNo` and `channelKey`; no credential belongs in an endpoint map or source file.

## Connection endpoint keys

- Cake: `healthOperation=cake.categories`, `cake.categories=/channelapi/product/get_cats_list`, and exactly one `cake.category.<root-category-id>=/channelapi/product/get_products_list`.
- Flower: `healthOperation=flower.categories`, `flower.categories=/channelapi/product/get_cats_list`, and exactly one `flower.category.<root-category-id>=/channelapi/product/get_products_list`.
- Food voucher: the configured health endpoint must be `/couponrecharge/coupon_saas_api/get_product_lists`.
- Meal: every enabled store is configured as `meal.menu.<brand>.<encodeURIComponent(store-code)>` with the documented brand menu path. The health endpoint path must match the first configured menu scope.

Root category IDs and meal store codes are non-secret installation configuration. Cake and flower intentionally require separate root IDs so their catalog records cannot overlap.

## Enabled capabilities

- Cake and flower: `Catalog`, `Price`, `Inventory`.
- Food voucher: `Catalog`, `Price`.
- Meal: `Catalog`, `Price` for explicitly configured stores.

Catalog imports remain source records pending the platform's existing mapping and publishing process.

## Disabled release paths

- Physical and meal order builders are internal and are not exported or connected to an `Order` port. The current fulfillment job does not provide the vendor SKU/address/store/options payload and unconditionally schedules `Logistics`, which these APIs cannot satisfy.
- Webhooks are not exported or registered. The physical/meal signature does not cover event payload fields, and the food-voucher fulfillment callback is unsigned.
- Card issuance is not implemented: the documented production order endpoint uses plain HTTP, its callback is unsigned, and the AES mode/IV/padding contract is incomplete.
- The public documents do not provide production base URLs. Only an approved HTTPS base URL may be installed.
