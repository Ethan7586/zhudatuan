# 築大團部署總覽

本文件描述正式 `main/` 工程的部署邊界。舊靜態設計評審站、`hbbtzn` 部署腳本與歷史快照只保留在 `../archives/`，不是目前部署來源。

## 當前狀態

- 源碼、依賴、TypeScript、單元測試、合同測試及前後端構建已有可恢復基線。
- 核心營運 API 的真 PostgreSQL 整合測試尚未全部通過；消費端仍使用獨立 REST/RPC 相容合同。
- 因此目前可以建立測試制品，但不得宣稱已完成生產 MVP 驗收或把兩套 Migration 合併到同一資料庫。

## 域名責任

| 域名                    | 制品／服務            | 當前合同                             |
| ----------------------- | --------------------- | ------------------------------------ |
| `www.zhudatuan.com`     | `apps/storefront-web` | 消費端 REST/RPC 相容層，同源提供 API |
| `auth.zhudatuan.com`    | `apps/auth-web`       | 消費端相容身份流程                   |
| `console.zhudatuan.com` | `apps/console`        | Canonical Operation SDK              |
| `api.zhudatuan.com`     | `services/commerce`   | 217 個 Canonical Operations          |
| `chat.zhudatuan.com`    | 客服系統              | 尚未納入本次代碼基線                 |

## 部署軌道

### 核心營運軌道

`apps/console`、`services/commerce` 與 `database/supabase` 必須使用同一提交與合同 Hash。阿里雲正式拓撲和不可變 Release Bundle 規範見 [`infrastructure/aliyun/DEPLOY-阿里云.md`](./infrastructure/aliyun/DEPLOY-%E9%98%BF%E9%87%8C%E4%BA%91.md)。在真資料庫 E2E、權限負例和 Provider 沙箱證據完成前，只允許部署到隔離測試環境。

### 消費端相容軌道

`apps/storefront-web` 的 Worker 會同源嵌入 `services/commerce-api/src/api/router`；它與 `database/storefront-compatibility/supabase` 成套驗證。根命令 `build:commerce-api` 目前只生成歷史管理 AI 服務，不是完整消費 REST 服務，不能單獨當作正式 API 制品。

相容軌道完成 Adapter/BFF、真資料庫驗收與域名改造前，不使用歷史 `hbbtzn`／`/opt/smart-wing` 腳本部署。

## 本地基線驗證

```bash
cd /Users/Ethan/Desktop/Projects/zhudatuan/main
npm ci
npm run typecheck
npm run test:unit
npm run test:contract
npm run build
```

需要 PostgreSQL 的 Migration、Repository 與端到端驗證必須使用隔離測試庫，并顯式配置測試連線；不能因單元測試通過而跳過。

## Cloudflare 邊界

Cloudflare 目前只負責 DNS、TLS 與邊緣防護；正式運行真值仍在阿里雲。不得把資料庫密鑰、Supabase service role、支付證書或 ECS 環境文件上傳到 Cloudflare、GitHub 或前端制品。

## 回滾

GitHub 提交、簽名服務端鏡像、靜態客戶端制品、合同 Hash 與資料庫快照必須作為同一候選版本保存。任何資料庫 Migration 之後的回滾都必須同時恢復匹配的資料庫快照與客戶端／服務端制品，不能只回退前端。
