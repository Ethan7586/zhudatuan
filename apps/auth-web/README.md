# Unified authentication UI

This app owns the shared sign-in experience for `hbbtzn.com` and
`smart.hbbtzn.com`: authentication, membership selection, management step-up,
and the cross-domain callback screen.

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
Console password login uses the canonical Commerce identity API with an
in-memory PKCE transaction and an immediately exchanged one-time ticket. The
API creates and rotates its own host-only HttpOnly session cookie; neither the
password nor the ticket enters a URL, browser history, web storage, or the
Console JavaScript runtime. Multi-membership selection is authoritative for
the Console path. Employee self-registration now uses the canonical invitation,
registration challenge, versioned terms and member-creation operations; it
always creates a Storefront membership and never grants Console access.
Consumer login and password recovery remain on the isolated compatibility BFF
during their migration. QR login, enterprise SSO and admin step-up remain
visibly unavailable until their authoritative services exist.
<<<<<<< HEAD
=======
It is a UI prototype at this stage. Production authentication, membership,
ticket exchange, rate limiting, and audit logging belong to
`services/commerce-api` and `packages/authz`; browser code must not contain
secrets or issue real sessions.
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)

Run it from the repository root:

```powershell
npm run dev:auth
```

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
It uses port `3002` locally. `VITE_API_BASE_URL` points Console login to the
canonical Commerce API (default `http://127.0.0.1:3001`). `/api` is still
proxied to the storefront compatibility BFF configured by
`AUTH_COMPAT_API_ORIGIN` (default `http://127.0.0.1:3000`) for the remaining
consumer identity operations.
<<<<<<< HEAD
=======
It uses port `3002` locally.
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
