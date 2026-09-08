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

`local:prepare` writes a private local CA, `.env.local` files, and `secrets.local.json`. These files are ignored by Git and secret values are never printed. It creates separate 256-bit base64url bearer tokens for the Secret Store and KMS, preserves valid existing tokens on repeated runs, and keeps those tokens in the private server/client env files rather than the Secret Store catalog that workloads can read. Trust is process-scoped through `NODE_EXTRA_CA_CERTS`; the certificate is not installed into the operating-system trust store.

Run `npm run local:rotate` after suspected disclosure or when a local credential reaches its rotation boundary. The command atomically replaces every generated database password, signing key, encryption key, provider credential and bearer token, then rewrites all ignored workload environment files without printing values. Restart the local containers and processes immediately afterwards; previously issued local sessions and encrypted fixture data are intentionally invalidated.

PostgreSQL and Redis bind only to `127.0.0.1`. The Secret Store, KMS, and object store are HTTPS-only and also bind only to `127.0.0.1`. Secret Store and KMS expose unauthenticated readiness only at `/health/ready`; every other request is bearer-authenticated before route, method, or request-body validation.

The local database is named `zhudatuan_registration`, matching the guarded migration boundary exactly.

`local:up` provisions the least-privilege PostgreSQL workload roles through an idempotent bootstrap sent over the container standard input. It intentionally avoids host-file mounts so a local container runtime cannot reinterpret an absent initialization source as a directory.

The default Compose profile starts only PostgreSQL and Redis. `docker compose --profile objects ... up` starts the same object protocol in an isolated container, while `--profile provider` starts the deterministic 11-provider failure fixture on loopback port 9080. The provider fixture requires an idempotency key and is development-only; production bundles and runtime manifests never include it.
