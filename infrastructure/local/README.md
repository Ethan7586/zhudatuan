# Local runtime

This directory implements the production runtime contracts locally. It does not add file or in-memory branches to production clients.

```sh
npm run local:prepare
npm run local:up
npm run local:services
npm run local:migrate
npm run local:seed
npm run dev:api
npm run local:verify
```

<<<<<<< HEAD
`local:prepare` writes a private local CA, `.env.local` files, and `secrets.local.json`. These files are ignored by Git and secret values are never printed. It creates separate 256-bit base64url bearer tokens for the Secret Store and KMS, preserves valid existing tokens on repeated runs, and keeps those tokens in the private server/client env files rather than the Secret Store catalog that workloads can read. Trust is process-scoped through `NODE_EXTRA_CA_CERTS`; the certificate is not installed into the operating-system trust store.

PostgreSQL and Redis bind only to `127.0.0.1`. The Secret Store, KMS, and object store are HTTPS-only and also bind only to `127.0.0.1`. Secret Store and KMS expose unauthenticated readiness only at `/health/ready`; every other request is bearer-authenticated before route, method, or request-body validation.
=======
`local:prepare` writes a private local CA, `.env.local` files, and `secrets.local.json`. These files are ignored by Git and secret values are never printed. Trust is process-scoped through `NODE_EXTRA_CA_CERTS`; the certificate is not installed into the operating-system trust store.

PostgreSQL and Redis bind only to `127.0.0.1`. The Secret Store, KMS, and object store are HTTPS-only and also bind only to `127.0.0.1`.
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
