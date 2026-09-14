#!/usr/bin/env bash
set -euo pipefail

repo="${1:-Ethan7586/zhudatuan}"
runner_url="https://github.com/${repo}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
image="zdt-actions-runner:2.337.0"

command -v docker >/dev/null
command -v gh >/dev/null
gh auth status >/dev/null

docker build \
  --platform linux/amd64 \
  --tag "$image" \
  "$script_dir"

configure_runner() {
  service="$1"
  volume="$2"
  name="$3"
  label="$4"

  docker volume create "$volume" >/dev/null
  if docker run --rm \
    --platform linux/amd64 \
    --entrypoint /bin/bash \
    -v "${volume}:/runner-state" \
    "$image" \
    -c 'test -f /runner-state/.runner'; then
    :
  else
    token="$(gh api --method POST "repos/${repo}/actions/runners/registration-token" --jq .token)"
    docker run --rm \
      --platform linux/amd64 \
      -e RUNNER_URL="$runner_url" \
      -e RUNNER_TOKEN="$token" \
      -e RUNNER_NAME="$name" \
      -e RUNNER_LABELS="$label" \
      -v "${volume}:/runner-state" \
      "$image" configure
  fi

  docker run --rm \
    --platform linux/amd64 \
    --entrypoint chown \
    -v "${volume}:/runner-state" \
    "$image" \
    -R 1001:1001 /runner-state
}

configure_runner build zdt-actions-build ethan-mac-zdt-build zdt-build
configure_runner release zdt-actions-release ethan-mac-zdt-release zdt-release

docker compose -f "$script_dir/compose.yaml" up -d
