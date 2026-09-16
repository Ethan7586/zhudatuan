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
