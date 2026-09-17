# Runner 1.7 execution

The repository includes the single supported team entry, `02_platform_pingtai/infrastructure/github-actions-runner/zdt-delivery`. Run it from any clone or worktree; no per-user installation is needed. It fetches the latest `origin/zdt-next`, checks out only the two control-dispatch scripts, starts the single workflow, follows the GitHub run, and prints the final receipt plus command-to-completion elapsed time. The workflow filename `delivery-1-6.yml` and machine receipt prefix `RUNNER_1_6_RESULT` remain stable for existing callers; they are not a second 1.6 core. An installed copy also works when run from a checkout, or with `ZDT_GIT_ANCHOR` pointing to one. Direct dispatch from GitHub's Actions page bypasses the command's queued-Aliyun timeout handling and is not an equivalent supported entry.

Normal commands:

```text
./02_platform_pingtai/infrastructure/github-actions-runner/zdt-delivery release <full-source-sha>
./02_platform_pingtai/infrastructure/github-actions-runner/zdt-delivery deploy <full-source-sha>
./02_platform_pingtai/infrastructure/github-actions-runner/zdt-delivery deploy <target> <full-source-sha> <physical-node>
./02_platform_pingtai/infrastructure/github-actions-runner/zdt-delivery status [full-source-sha-or-r16-release-id]
./02_platform_pingtai/infrastructure/github-actions-runner/zdt-delivery retry <r16-release-id>
./02_platform_pingtai/infrastructure/github-actions-runner/zdt-delivery rollback <target> <physical-node>
```

`deploy` and `release` are interchangeable names for the same release path. `deploy` with an explicit target uses the historical target-first argument order; the wrapper forwards it to `release` with Source SHA first. Neither command has priority over the other.

`status` without a SHA reads the live current/previous and health of configured physical targets; providing a Source SHA additionally shows whether that version is current, previous, or elsewhere. Status and rollback do not depend on unrelated build settings, other targets' release checks or a release receipt; target/node identity and paths remain checked.

When Ethan asks an agent to deploy work from the current task, an already committed and pushed full Source SHA goes straight to this entry. Do not create another branch, install local dependencies, run a local production build, or repeat the Runner's full checks just to release that commit. If the task still has uncommitted changes, check only what those changes need, commit and push them, then invoke the same entry with the resulting full Source SHA. A local build may still be useful to diagnose a specific development issue, but it is not a normal release prerequisite. The user does not need to supply a SHA or perform a separate sealing step. Unrelated uncommitted changes are not included. The entry itself remains a dispatcher, not a local build or deployment tool.

For one physical node, use `zdt-delivery release <full-source-sha> <target> <physical-node>` or `zdt-delivery deploy <target> <full-source-sha> <physical-node>`. If that target's immutable artifact is absent or incomplete, the same Runner builds and publishes only that target's artifact, then deploys only the named node. A cache hit skips the build. The control-side machine never builds or prepares the artifact.

Normal release synchronizes the matching Agent and remote policy as one versioned pair before deploying targets, then executes that exact pair even if another release updates the default Agent entry. Unrelated process restarts, Caddy changes, a fixed free-space reserve, lifecycle-unit queries, audit writes and extra rollback-point files do not determine a target release outcome. The target's immutable artifact, current/previous pointers, service restart and health still do; a failed health check restores the previous service when available.

Aliyun Build runners are selected first when one is online and idle. Missing, offline, busy, or unreadable Aliyun state selects GitHub Hosted immediately. The repository command cancels an Aliyun job that has not started any step after 20 seconds, or has started setup but not reached the shared core after 60 seconds. It retries on Hosted only after cancellation is confirmed and the core is confirmed unstarted; it never switches after the core started. Both locations invoke `.github/actions/runner-1-6/action.yml` and `scripts/runner-1-6.sh`; there is no second release implementation. GitHub Hosted uses the public OSS endpoint for Runner uploads and reads, the configured endpoint for target downloads, and the same SSH target/host-key configuration. Real Hosted connectivity still requires a production run to prove.

The control-side machine never installs release dependencies, builds, packages, uploads, deploys, or rolls back. Historical recovery remains separate under `RECOVERY.md`.

Each real release or retry refreshes the matching remote Agent and policy inside the shared Runner core immediately before target deployment; there is no separate team command. Exact installed-file hash equality no longer blocks deployment, while the receipt still reports the actual remote hashes. `status` does not refresh remote files and remains read-only. An older remote Agent's zero-check `ready` report is displayed as `not-checked`, not healthy.

On a cache miss, the shared core installs its minimal isolated control dependencies and only the selected source build workspaces concurrently; a target with no build workspace falls back to the full source install. Cache absence or damage triggers a normal rebuild, not an approval or repair step. Tests and typechecks run concurrently before building. Control checkouts are sparse. An exact `@shop/commerce` target, including `database-migration`, also checks out only the Source directories used by its build and tests; other targets retain the full Source checkout. Both Runner locations use the same action and core.

`DELIVERY_END_TO_END_MS` measures from the team command to the healthy target receipt on a nonempty release with configured health checks; the current objective is at most 120 seconds under normal conditions. A longer run calls for diagnosis, not a release gate. Static targets without health checks report `not-checked` and `DEPLOYED`/`CURRENT`, never `HEALTHY`; `DELIVERY_TARGET_CURRENT_MS` measures command-to-current-pointer receipt for these targets, not health. `DELIVERY_COMMAND_RETURN_MS` separately measures command-to-workflow-completion, including GitHub finalization and the user's wait. `DELIVERY_PRE_CORE_TIMINGS` reports final-run queue, routing, and top-level control checkout; `DELIVERY_SOURCE_CHECKOUT_MS` reports the nested Source checkout. The release receipt reports dependencies, tests, typecheck, build, package, upload, and target cutover. These intervals may overlap and should not be summed. A Hosted fallback's cancelled first run is included in the command total but not final-run stage breakdown. The release result contains the target node's `current`, `previous`, and health returned after deployment. For an immediate completion answer, use that target result; a later question about current production state uses a fresh read-only `status`. The post-change cold production total still needs a real run.

For user-perceived latency, report three separate intervals when their timestamps are available: request-to-command (agent preparation, including any code fix and commit), command-to-target receipt (the Runner metric above), and receipt-to-user response. Mark an unmeasured interval unknown. The Runner metric alone is not the time from the user's request, and overlapping stage durations must not be added together.

## GitHub sing-box line

`install-github-transport.sh` turns the sing-box installation on the Aliyun Runner host into a GitHub-only line. The Runner processes use a loopback HTTP proxy. sing-box sends `github.com`, `githubusercontent.com`, `githubassets.com`, and `ghcr.io` through the configured Shadowsocks endpoint; OSS, Aliyun metadata, production SSH, and every other destination remain direct.

Run it on the Aliyun Runner host with the existing line credentials in environment variables:

```text
ZDT_GITHUB_LINE_SERVER=<server>
ZDT_GITHUB_LINE_SERVER_PORT=<port>
ZDT_GITHUB_LINE_METHOD=<method>
ZDT_GITHUB_LINE_PASSWORD=<password>
sudo -E ./install-github-transport.sh
```

The optional `ZDT_GITHUB_LINE_LISTEN_PORT` defaults to `7890`. The script configures every Runner service it finds, including both build slots. An idle Runner is restarted immediately; a Runner currently executing a job keeps running and receives the line on its next normal restart. The installer does not create delivery state, locks, leases, claims, gates, or another release authority.
