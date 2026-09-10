#!/usr/bin/env bash
# 秒级切流：把 zdt-next 的一个 commit 切成生产 current。
# 用法：
#   scripts/deploy-now.sh              # 切最新 zdt-next
#   scripts/deploy-now.sh <commit>     # 切指定 commit（必须已合并进 zdt-next 且 CI 绿）
#
# 它只是触发 GitHub 的 Deploy 工作流并盯着它跑完。
# 不在本地 build / test / package / deploy。

set -euo pipefail
export PATH=/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin

SHA="${1:-}"
if [ -z "$SHA" ]; then
  git fetch origin zdt-next --quiet
  SHA="$(git rev-parse origin/zdt-next)"
fi

echo "触发 Deploy 工作流，目标 commit: $SHA"
gh workflow run deploy.yml -f head_sha="$SHA"

# 等它出现在运行列表里
sleep 4
RUN_ID="$(gh run list --workflow deploy.yml --limit 1 --json databaseId -q '.[0].databaseId')"
echo "运行编号: $RUN_ID"
gh run watch "$RUN_ID" --exit-status
