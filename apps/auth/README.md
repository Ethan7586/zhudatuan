# Unified authentication UI

This app owns the approved three-stage sign-in experience at
`accounts.zhudatuan.com`, with optional same-origin mounting at
`zhudatuan.com/login/`.

Console password login uses the canonical Commerce identity API with an
ephemeral PKCE transaction and an immediately exchanged one-time ticket. The
API creates and rotates its own host-only HttpOnly session cookie; neither the
password nor the ticket enters a URL, browser history, web storage, or the
Console JavaScript runtime. Multi-membership selection is authoritative for
both targets. Employee enrollment uses the canonical invitation,
registration challenge, versioned terms and enrollment operations; it
always creates a Storefront membership and never grants Console access.
Password, OTP, invitation, WeChat, WeCom and OIDC authentication all enter the
same generated Commerce contract, security policy and SessionIssuer. Provider
buttons are rendered only from the authoritative enabled-provider response.

Run it from the repository root:

```powershell
npm run dev:auth
```

It uses port `3002` locally. The generated runtime configuration points every
identity operation at the canonical Commerce API. There is no compatibility
BFF, fallback route or parallel identity data source.
