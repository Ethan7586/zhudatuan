# Canonical Console 登錄收斂日誌

日期：2026-08-28（Asia/Shanghai）

## Owner 授權與範圍

Owner 在確認「先登錄系統，再權限系統」後下達「開始吧」。本輪只收斂 `accounts.zhudatuan.com` 到 Console 的密碼登錄、Session、回跳與 CSRF 鏈路；不部署、不修改正式資料、不接 OTP／微信／企業微信／SSO／Step-up，也不開始權限工作台改造。

## 已完成

- 保留已批准的 3003 三段式 `LoginPage` VI／UI／UE；沒有替換頁面、樣式或品牌資產。
- Console 登錄改接 `identity.sessions.create` 與 `identity.tickets.exchange`，使用記憶體內 PKCE、一次性 Ticket、精確 Console Origin 白名單及 API Host-only Cookie。
- Ticket 不進 URL、History、Local Storage 或 Session Storage；密碼只停留在當前表單記憶體與 POST Body，不進 URL 或 Web Storage。
- 多會員身份由服務端按 `target=console` 篩選並權威確認；歷史 `operator` 值只在服務端邊界正規化為 `console`。
- Ticket 兌換綁定當前 Session Token，鎖定 Ticket 與 Session，並以同一 SQL 原子消費 Ticket、旋轉 Session Token；並發兌換時再次核對舊 Token。
- 身份建立與 Ticket 兌換的冪等紀錄只保存 409 一次性重放結果，不持久化 Cookie、CSRF 或 Ticket。
- Console Session Schema 保留 API 回傳的 CSRF；跨子域寫操作顯式帶入，退出不再依賴 Console JavaScript 讀取 API Cookie。
- Canonical 登錄與 Ticket 兌換只接受精確白名單 Origin；CORS 補齊 `x-device-id`；API 只信任本機 Caddy 傳入的合法 `X-Real-IP`。
- 本地正式 Console 開發入口統一為 `127.0.0.1:4173`，身份中心為 `127.0.0.1:3002`，Canonical API 為 `127.0.0.1:3001`。

## 驗證證據

- Auth TypeScript：通過。
- Auth Unit：2 files／13 tests 通過。
- Console TypeScript：通過。
- Console Session／Request Context：2 files／7 tests 通過。
- Commerce TypeScript：通過。
- Identity Ticket／秘密冪等／可信代理／HTTP 合同：4 files／9 tests 通過。
- Commerce 全量 Unit：49 files／199 tests 通過。
- Security HTTP：4 tests 通過。
- Auth production build：通過。
- Console production build：通過。
- Owner-approved UI Hash 門禁：3 surfaces／59 locked files 通過。
- 本地瀏覽器只讀目視：3003 三段式登錄、企微／微信既定入口、品牌與表單視覺均保留；未提交任何憑據。

## 尚未宣稱完成的部分

- 真 PostgreSQL Migration／Seed／Browser E2E 本輪未完成。啟動隔離測試庫時，財務並行任務新增的 6 個 Migration 尚未進入資料庫序列白名單，`REPAIR_MIGRATION_SEQUENCE_DRIFT` 正確阻止建庫；本輪沒有繞過或修改財務範圍。
- 現存 Compatibility 使用者的 Alias／PBKDF2 憑據尚未遷入 Canonical HMAC／scrypt 身份庫；目前可使用 Canonical Seed／正式建立的 Canonical 帳號。憑據遷移需要單獨 Owner 批准、一次性 Migration、對帳與回滾方案。
- 消費者註冊、找回與消費登入仍在 Compatibility BFF；本輪沒有假裝它們已經合流。
- 生產 `API_ALLOWED_ORIGINS`、`AUTH_RETURN_TARGETS`、Secrets、RDS Migration 與阿里雲制品尚未變更；必須另行批准部署。

## 回退方式

本輪沒有資料或雲端不可逆變更。回退只需撤回本日誌所列的 Auth／Identity／Console Session／本地環境配置修改；不得回退或覆蓋同一工作樹中的財務升級內容。

## 手動登入／註冊驗收準備

- 已實際打開 `http://127.0.0.1:3002/login?client=console`，確認批准的登入頁可見並保留給 Owner 操作。
- 修正本地環境生成器遺留的舊端口：Console 由 `5173` 統一為 `4173`，Auth 由 `5176` 統一為 `3002`；`@shop/localinfra` TypeScript 驗證通過，並重新生成忽略提交的本地環境檔。
- 真實 Canonical 登入仍未提交憑據：資料庫序列目前只剩 `20260828100000_finance_reconciliation_repair_workflow.sql` 一個未進白名單的 Finance Migration；本輪沒有繞過該門檻。
- 現有「新用戶註冊」仍呼叫 Compatibility `/api/v1/auth/register/username`，只建立 Storefront 員工帳號，不能用來驗證 Canonical Console 身份。
- Canonical 註冊還需接通「解析邀請 → OTP Challenge → 建立會員」三步、服務端條款 Hash 與 Canonical 密碼策略；在此完成前，不把註冊按鈕顯示等同於可正式註冊。
