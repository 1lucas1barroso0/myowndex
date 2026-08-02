#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
output_dir="$project_root/dist-gateway"

if [[ "$output_dir" != "$project_root/dist-gateway" ]]; then
  echo "Invalid gateway output directory" >&2
  exit 1
fi

rm -rf -- "$output_dir"
mkdir -p "$output_dir"
printf '%s\n' 'MyOwnDex gateway: the complete application is served by the Sites runtime.' > "$output_dir/gateway.txt"
