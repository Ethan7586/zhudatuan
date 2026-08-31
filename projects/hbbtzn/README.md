# hbbtzn 子項目

`hbbtzn` 是築大團平台下的獨立部署／租戶子項目。它共享築大團已批准的正式代碼與制品，但域名、資料、密鑰、雲資源、發布、驗收和回滾必須與 `zhudatuan.com` 主項目隔離。

## 當前定位

- Parent：`zhudatuan`
- 類型：配置型租戶部署子項目
- 狀態：保留並獨立維護
- Owner：Ethan
- 正式發布資格：`false`
- 本輪策略：保持現狀，不遷移、不下線、不改 DNS、不切資料

目前沒有一套名為 `hbbtzn` 的獨立 App、Service 或資料庫代碼。它實際由歷史 Smart Wing 域名／部署配置與築大團共享制品組成。因此本子項目不複製 `apps/`、`services/`、`packages/` 或 `database/`，也不建立第二套代碼 fork。

## 與築大團主項目的關係

```text
zhudatuan（主平台、唯一正式代碼）
└── hbbtzn（獨立部署／租戶子項目）
    ├── 引用經批准的共享制品
    ├── 保持自己的域名與資料邊界
    └── 獨立發布、驗收與回滾
```

共享代碼仍位於 `../../apps/`、`../../services/`、`../../packages/` 與 `../../database/`。正式制品真值仍只有 [`../../config/artifacts.json`](../../config/artifacts.json)；本子項目不得自行增加 App、Service 或合同，也不得加入根 npm Workspace。

## 必須隔離的內容

- 域名與 TLS
- PostgreSQL／Supabase 資料庫與 Migration 執行目標
- Redis Instance 或 Key Namespace
- 阿里雲 ACK Namespace、OSS Bucket／Prefix、KMS／Secret Scope
- 微信、支付、短信與 Provider 憑據
- Release、資料快照、備份、監控、驗收和回滾證據

任何個性化只能在 Owner 批准後，以配置、Theme 或 Feature Flag 接入；不得複製或直接修改一整套共享前後端。

## 現有資料位置

- 子項目機器可讀身份：[`project.yml`](./project.yml)
- 阿里雲部署画像：[`deployment/aliyun.yml`](./deployment/aliyun.yml)
- 舊部署參考：`../../infrastructure/aliyun/delivery.yml` 與 `../../infrastructure/storefront-compatibility/`
- 歷史代碼真值：`../../../archives/smart-wing/` 與 `../../../archives/smart-wing-20260826/`

歷史目錄只讀，不是構建或部署來源。舊配置中仍存在 Cookie、Host 判斷、回跳、圖片與支付回調等 `hbbtzn` 硬編碼；本次只是建立子項目身份邊界，不代表運行隔離已完成。

## 後續批准門

在 Owner 另行批准前，不得：

- 把舊 `delivery.yml` 直接作為築大團或 hbbtzn 的正式發布輸入；
- 移動、複製或刪除共享前後端；
- 修改 hbbtzn 的 DNS、資料庫、Secret、支付配置或正式流量；
- 宣稱 hbbtzn 已完成獨立部署或生產驗收。
