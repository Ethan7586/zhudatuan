#!/usr/bin/env bash
set -euo pipefail

seed_runner() {
  if [ ! -x /runner-state/run.sh ]; then
    cp -a /opt/actions-runner/. /runner-state/
  fi
}

seed_runner
cd /runner-state

case "${1:-run}" in
  configure)
    : "${RUNNER_URL:?RUNNER_URL is required}"
    : "${RUNNER_TOKEN:?RUNNER_TOKEN is required}"
    : "${RUNNER_NAME:?RUNNER_NAME is required}"
    : "${RUNNER_LABELS:?RUNNER_LABELS is required}"
    ./config.sh \
      --unattended \
      --replace \
      --url "$RUNNER_URL" \
      --token "$RUNNER_TOKEN" \
      --name "$RUNNER_NAME" \
      --labels "$RUNNER_LABELS" \
      --work _work
    ;;
  run)
    if [ ! -f .runner ]; then
      echo "Runner is not registered; run setup.sh first" >&2
      exit 64
    fi
    exec ./run.sh
    ;;
  *)
    echo "Expected configure or run" >&2
    exit 64
    ;;
esac
