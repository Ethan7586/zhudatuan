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

`local:prepare` writes a private local CA, `.env.local` files, and `secrets.local.json`. These files are ignored by Git and secret values are never printed. Trust is process-scoped through `NODE_EXTRA_CA_CERTS`; the certificate is not installed into the operating-system trust store.

PostgreSQL and Redis bind only to `127.0.0.1`. The Secret Store, KMS, and object store are HTTPS-only and also bind only to `127.0.0.1`.
