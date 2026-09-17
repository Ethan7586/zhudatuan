#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -eq 1 ]]; then
  project_root="$(pwd)"
  donor_root="$1"
else
  project_root="${1:-$(pwd)}"
  donor_root="${2:-}"
fi
[[ -n "$donor_root" && -d "$donor_root/node_modules" ]] || {
  printf 'usage: %s <isolated-project-root> <trusted-donor-project-root>\n' "$0" >&2
  exit 64
}
destination="$project_root/node_modules"
if [[ -L "$destination" ]]; then
  unlink "$destination"
elif [[ -e "$destination" ]]; then
  resolved_destination="$(cd "$destination" && pwd -P)"
  [[ "$resolved_destination" == "$project_root/node_modules" ]] || {
    printf 'dependency preparation refused: %s resolves outside the isolated project\n' "$destination" >&2
    exit 1
  }
fi
[[ -d "$destination" ]] || cp -a -l "$donor_root/node_modules" "$destination"
while IFS= read -r nested; do
  relative="${nested#"$donor_root"/}"
  target="$project_root/$relative"
  [[ -e "$target" ]] && continue
  mkdir -p "$(dirname "$target")"
  cp -a -l "$nested" "$target"
done < <(find "$donor_root/01_core_hexin" "$donor_root/04_tools" -type d -name node_modules -prune -print)
printf 'Isolated dependencies prepared with hard-link reuse; donor files were not modified.\n'
