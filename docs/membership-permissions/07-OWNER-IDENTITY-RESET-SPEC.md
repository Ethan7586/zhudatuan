# Owner 身份重置與手機重新邀請規格

- 狀態：MVP 已實作
- 日期：2026-08-29
- 適用範圍：主打團 Root Owner／Console
- Canonical operation：`identity.members.reset`

## 1. 目的

Root Owner 可將一個非 Owner 的既有登入身份停用並釋放其手機登入標識，使同一手機可使用新的管理員邀請碼重新註冊。這不是會員資料的物理刪除。

## 2. 不變式

1. 全平台只能由 `role-platform-owner-v2` 執行身份重置；單純持有一般成員管理權限不成立。
2. Root 不可重置自己，也不可重置任何仍持有 Root Owner 角色的身份。
3. 請求只接受目標 Membership ID；Principal、Profile 與 Credential 一律由服務端解析。
4. 必須提供 `Idempotency-Key`、CSRF、Access Version、`If-Match`、至少四字的原因，以及同一 Session 十分鐘內的 Owner 密碼再驗證。
5. Reset 與 Registration 使用同一個手機 subject advisory lock，避免釋放與註冊競爭。
6. 不刪除 Principal、Profile、Membership、Session、訂單或審計主鍵。
7. Credential 的原 `subject_hash` 必須換成不可關聯的唯一 tombstone；只改 `status='revoked'` 不能釋放資料庫唯一鍵。
8. 回應、Outbox 與操作審計不得包含手機、密碼、原 subject hash 或邀請碼。

## 3. 原子交易

```text
驗證 Root、目標 Scope、Owner 保護、版本、近期密碼再驗證
  → 鎖 Principal / Profile / 全部 Membership / Credential
  → 使用原 subject hash 取得與 Registration 相同的 advisory lock
  → 撤銷 Auth Ticket、Session、Assurance、Challenge、Federated Identity
  → Credential revoked + tombstone，清除秘密
  → Role / Scope Grant 到期，Override 撤銷
  → 全部 Membership = left，Access Version 各增加一次
  → Profile 停用並去識別，Principal 停用並提升 Credential Version
  → 寫入 identity.member.reset Outbox 與不可修改操作審計
```

任何一步失敗，整個交易回滾；不得出現「手機已釋放但 Membership 仍有效」或反向的半完成狀態。

## 4. HTTP 合同

```http
PUT /api/v1/identity/members/{membershipid}/registration
Idempotency-Key: <unique>
If-Match: "<principal_version>"
X-CSRF-Token: <session csrf>
X-Access-Version: <membership access version>
```

```json
{ "reason": "重新邀請測試管理員" }
```

成功回應只含非秘密狀態：

```json
{
  "principal_id": "principal:…",
  "status": "reset",
  "login_identity_released": true,
  "history_retained": true,
  "version": 8
}
```

## 5. Console 交互

入口必須同時滿足：

- Session 有 `identity.registration.reset`。
- Capability 有 `identity.members.reset`。
- CSRF 已建立。
- Read model 回傳 `reset_allowed=true`。

確認 Dialog 必須展示影響範圍，要求原因、理解勾選、輸入「重置」及目前 Owner 密碼。提交時先執行 `identity.password.verify`，再執行 reset；密碼不得放入 React state、Mutation Cache、reset body 或 receipt。成功後刷新成員列表，並可直接打開既有的「生成管理員邀請碼」Dialog。

## 6. Owner 資料庫保護

資料庫 Trigger 阻止以下繞過應用層的操作：

- 將有效 Root Membership 改為非 active 或刪除。
- 到期／刪除有效 Root Role assignment。
- 停用／刪除 Root Principal 或 Profile。
- 撤銷／刪除 Root 的有效 Credential。

Owner 轉讓必須另走獨立、兩階段治理流程；身份重置沒有 bypass 開關。

## 7. 驗收

- Root 可看到入口；缺 permission、capability、CSRF 或 row eligibility 時入口不可見。
- 非 Root、跨 Scope、Self、Owner target、缺少／過期再驗證、缺少／過期版本全部 fail closed。
- 成功後原 Credential 不再佔用手機 subject；同手機可立即使用新邀請碼註冊。
- 舊 storefront/operator Membership 全部為 `left`，Session 全部撤銷。
- 訂單、卡券、財務與審計引用仍可解析到原歷史 ID。
- 同 Idempotency Key 重播不會再次增加版本；不同 payload 使用同 key 必須拒絕。

## 8. 後續強化

正式短信／MFA 通道接通後，將 `identity.registration.reset` 從 high 升為 critical，並在密碼再驗證之上強制近期 AAL3。平台商 Owner 只應取得 tenant 級 offboard，不可取得全平台手機釋放權。
