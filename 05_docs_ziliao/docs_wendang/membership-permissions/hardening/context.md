# Evidence Context: membership hierarchy hardening

Target repository: local `smart-wing-membership-permissions` worktree.

Target revision before this change: `2b39175` (`feature/membership-permissions-mvp-20260812`).

Evidence collection digest: `sha256:e62666f787d7b51cd5c14ad8753d811c4c12c87875e16b66b63d64bc39e0bc50`.

| Evidence | Source                                                                                 | What was inspected                                                                        |
| -------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| E001     | `packages/api-contract/src/index.ts`                                                   | Flat membership and resource scope fields; no ancestor path.                              |
| E002     | `packages/authz/src/index.ts`                                                          | Hard tenant equality and exact scope-kind/resource-ID matching.                           |
| E003     | `database/supabase/migrations/20260809093000_membership_authorization_foundation.sql`  | Five original scope kinds, validation triggers, membership `authz_version`.               |
| E004     | `database/supabase/migrations/20260812160000_membership_permission_command_center.sql` | Reserved scope kinds, flat delegation checks and incomplete role-permission invalidation. |
| E005     | `services/commerce-api/src/api/membershipContext.ts`                                   | Resource scope is constructed from server-loaded database rows.                           |

Validation performed against the resulting worktree:

- PostgreSQL 17 empty-database execution of all migrations.
- Organization mapping, closure path and role-permission invalidation assertions.
- Authorization and resource-scope unit tests.
- Commerce API test suite and TypeScript checks.
- Full storefront, admin, auth and API build.
