# Unified authentication UI

This app owns the shared sign-in experience for `hbbtzn.com` and
`smart.hbbtzn.com`: authentication, membership selection, management step-up,
and the cross-domain callback screen.

It is a UI prototype at this stage. Production authentication, membership,
ticket exchange, rate limiting, and audit logging belong to
`services/commerce-api` and `packages/authz`; browser code must not contain
secrets or issue real sessions.

Run it from the repository root:

```powershell
npm run dev:auth
```

It uses port `3002` locally.
