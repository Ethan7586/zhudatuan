# Runner 1.6 execution

The installed `zdt-delivery` command is a control-side dispatcher. It fetches the latest `origin/zdt-next`, starts `delivery-1-6.yml`, follows the GitHub run, and prints the final `RUNNER_1_6_RESULT`.

Normal commands:

```text
zdt-delivery release <full-source-sha>
zdt-delivery status <full-source-sha-or-r16-release-id>
zdt-delivery retry <r16-release-id>
zdt-delivery rollback <target> <physical-node>
```

Aliyun Build runners are selected first when one is online and idle. Missing, offline, busy, or unreadable Aliyun state selects GitHub Hosted immediately. A failure before the shared core starts also uses GitHub Hosted. Both locations invoke `.github/actions/runner-1-6/action.yml` and `scripts/runner-1-6.sh`; there is no second release implementation.

The control-side machine never installs release dependencies, builds, packages, uploads, deploys, or rolls back. Historical recovery remains separate under `RECOVERY.md`.
