# Unified authentication UI

This app owns the approved three-stage sign-in experience at
`accounts.zhudatuan.com`, with optional same-origin mounting at
`zhudatuan.com/login/`.

<<<<<<< HEAD
<<<<<<< HEAD
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
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
It is a UI prototype at this stage. Production authentication, membership,
ticket exchange, rate limiting, and audit logging belong to
`services/commerce-api` and `packages/authz`; browser code must not contain
secrets or issue real sessions.
<<<<<<< HEAD
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
The browser never issues sessions or cross-domain tickets. An independent
accounts page uses an allowlisted top-level POST to the storefront or console
host so that host can create its own HttpOnly cookie. A storefront-embedded
login remains same-origin. Credentials stay in the POST body and never enter a
URL. QR login, enterprise SSO, multi-membership selection and admin step-up
remain visibly unavailable until their authoritative services exist.
>>>>>>> e29ce3d6 (fix: lock owner-approved zhudatuan UI baseline)

Run it from the repository root:

```powershell
npm run dev:auth
```

<<<<<<< HEAD
<<<<<<< HEAD
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
=======
It uses port `3002` locally.
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
It uses port `3002` locally. `/api` is proxied to the storefront compatibility
BFF configured by `AUTH_COMPAT_API_ORIGIN` (default `http://127.0.0.1:3000`),
never to the canonical Commerce API on port `3001`.
>>>>>>> e29ce3d6 (fix: lock owner-approved zhudatuan UI baseline)
