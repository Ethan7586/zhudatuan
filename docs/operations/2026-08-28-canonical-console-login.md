# Canonical 登錄與員工註冊收斂日誌

日期：2026-08-28（Asia/Shanghai）

## Owner 授權與範圍

Owner 指示先完成登錄系統，再完成註冊，最後一次性推送與部署；並明確要求「可以收緊，但是界面不要改動」。本輪保留已批准的 3003 三段式 VI／UI／UE，只接通 Canonical Console 密碼登錄與員工自助註冊所需的身份、安全及 Session 鏈路。

本輪不授予新用戶 Console 權限、不接通微信／企業微信／SSO／Step-up、不修改財務功能，也不把 Fixture 或 Compatibility 登錄當成 Canonical 成功證據。

## 已完成的登錄鏈路

- Console 密碼登錄改接 `identity.sessions.create` 與 `identity.tickets.exchange`。
- 使用記憶體內 PKCE、一次性 Ticket、精確回跳 Origin 白名單與 API Host-only HttpOnly Cookie。
- Ticket、密碼、Session Token 與 CSRF 均不進 URL、History、Local Storage 或 Session Storage。
- 多會員身份由服務端按 `target=console` 篩選並權威確認；錯誤 Target 或已停用 Membership fail-closed。
- Ticket 兌換綁定當前 Session Token，原子消費 Ticket並旋轉 Session Token／CSRF。
- 登錄與 Ticket 兌換的冪等重放只保存 409，不保存可重放的身份秘密。
- Console 寫操作顯式攜帶 Session API 返回的 CSRF；API 只信任本機反向代理傳入的客戶地址。

## 已完成的註冊鏈路

- 新用戶註冊依次調用 `identity.invitations.read`、`identity.challenges.create` 與 `identity.members.create`。
- 僅接受中國大陸 11 位手機號或標準 E.164 國際手機號；不接受郵箱替代手機。
- 邀請碼必須有效、已生效、未過期，並與允許的手機目的地綁定。
- OTP Challenge 綁定 `purpose=registration` 與手機 Hash，不能跨用途或換手機重放。
- 密碼要求 12–128 位，且同時包含大寫字母、小寫字母、數字和符號。
- 條款與隱私政策由服務端邀請返回，建立會員時提交並核對該版本的 `termsHash`。
- 同一手機建立身份前取得鎖並檢查重複 Subject；重複註冊返回 409，不覆蓋既有帳號。
- 公開註冊使用 `credentials: omit`；若瀏覽器意外帶入舊 API Cookie，仍須通過 CSRF，不會受舊會話影響。
- 新註冊固定建立 `storefront` Membership，不會自動授予 Console 權限。

## 視覺邊界

- 主登錄頁、左右布局、品牌、色彩、字體、四種入口與三階段骨架均保持已批准的 3003 版本。
- 註冊仍使用原有白色單卡 Modal、圓角、間距、按鈕、錯誤提示與協議 Modal 語言；只增加完成真實註冊必需的邀請驗證、手機 OTP、強密碼及條款校驗。
- `config/owner-approved-ui.json` 鎖定本次正式 Auth 文件 Hash；部署前必須通過 Owner UI 門禁。

## 已知邊界

- Canonical 註冊已能建立員工商城身份，但現有消費 Web 仍使用 Compatibility Session／業務 BFF。兩套合同未建立正式 Adapter 前，註冊成功不會假裝成消費 Web 已自動登錄。
- 新帳號如需進入 Console，必須在後續權限系統中由管理員明確授予 Console Membership；不得由自助註冊越權完成。
- 真實短信是否可投遞取決於 JobsMain、通知配置及阿里雲 SMS 憑據、簽名和模板。HTTP 202 只代表排隊，不等於投遞成功；正式驗收必須看到供應商回執。
- 真 PostgreSQL Migration／Seed／瀏覽器 E2E 必須使用隔離的築大團資料庫；不得借用 `hbbtzn` 或舊 Smart Wing Runtime。

## 驗證與發布記錄

在從 `01f1ed49dd5df67d28956a116de066f5fa1d5668` 建立的乾淨隔離工作樹完成：

- `npm ci`：通過；production audit 0 個已知漏洞。
- Auth：3 files／20 tests、TypeScript、production build 全通過。
- Console：15 files／67 tests、TypeScript、production build 全通過。
- Commerce：39 files／139 tests、2 files／7 contract tests、TypeScript、bundle 全通過。
- Security HTTP：6／6 通過。
- 全工作區 Unit：全部通過；根 TypeScript 全通過。
- Migration 靜態重放：165 個通過；unsafe cutover 被原子拒絕。
- Owner-approved UI：3 surfaces／60 locked files 通過。
- 1440×900 production build 目視：主登錄頁保持 3003 視覺；註冊 Modal 使用同一套 UI 語言。

Git 提交、GitHub Push、阿里雲 Release、真資料庫、真短信回執、域名驗收與回退點須在實際完成後追加；本地綠燈不等於生產完成。

## 回退方式

代碼回退以本輪獨立 Auth 提交的父提交為準。若生產資料庫沒有新增不可逆寫入，可回退 Auth／Console／Commerce 制品並恢復上一版 Release；既有使用者、邀請與註冊記錄不得以代碼回退方式刪除。
