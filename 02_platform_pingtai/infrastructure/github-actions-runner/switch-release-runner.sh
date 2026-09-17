#!/usr/bin/env bash
# Switch the single release slot between the primary and cold standby Runner.
set -euo pipefail

readonly PRIMARY_SERVICE='actions.runner.Ethan7586-zhudatuan.aliyun-staging-zdt-release.service'
readonly STANDBY_SERVICE='actions.runner.Ethan7586-zhudatuan.aliyun-staging-zdt-release-standby.service'

usage() {
  echo 'Usage: switch-release-runner.sh <status|primary|standby>' >&2
  exit 64
}

[ "$(id -u)" -eq 0 ] || usage
[ "$#" -eq 1 ] || usage

state() {
  if systemctl is-active --quiet "$1"; then
    printf 'active'
  else
    printf 'stopped'
  fi
}

switch_to() {
  source_service="$1"
  target_service="$2"
  if pgrep -f '/opt/actions-runner-release(-standby)?/bin/Runner.Worker' >/dev/null; then
    echo 'A release job is active; refusing Runner switch.' >&2
    exit 75
  fi
  systemctl stop "$source_service"
  if ! systemctl start "$target_service"; then
    systemctl start "$source_service" >/dev/null 2>&1 || true
    echo "Runner switch failed; restored ${source_service}." >&2
    exit 1
  fi
}

case "$1" in
  status)
    printf 'primary=%s standby=%s\n' "$(state "$PRIMARY_SERVICE")" "$(state "$STANDBY_SERVICE")"
    ;;
  primary)
    switch_to "$STANDBY_SERVICE" "$PRIMARY_SERVICE"
    ;;
  standby)
    switch_to "$PRIMARY_SERVICE" "$STANDBY_SERVICE"
    ;;
  *) usage ;;
esac

if [ "$1" != 'status' ]; then
  primary_state="$(state "$PRIMARY_SERVICE")"
  standby_state="$(state "$STANDBY_SERVICE")"
  if { [ "$primary_state" = 'active' ] && [ "$standby_state" = 'active' ]; } || \
     { [ "$primary_state" = 'stopped' ] && [ "$standby_state" = 'stopped' ]; }; then
    echo "Invalid release Runner state: primary=${primary_state} standby=${standby_state}." >&2
    exit 1
  fi
  printf 'Release Runner switched: primary=%s standby=%s\n' "$primary_state" "$standby_state"
fi
