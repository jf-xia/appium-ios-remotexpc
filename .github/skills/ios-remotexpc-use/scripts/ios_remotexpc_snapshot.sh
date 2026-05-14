#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$SKILL_ROOT/../../.." && pwd)"

UDID="${UDID:-00008140-001465202E10801C}"
OUTPUT=""

usage() {
  cat <<EOF
Usage: bash .github/skills/ios-remotexpc-use/scripts/ios_remotexpc_snapshot.sh [--udid UDID] [--output PATH]
EOF
}

timestamp() {
  date '+%Y%m%d-%H%M%S'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --udid)
      UDID="$2"
      shift 2
      ;;
    --output)
      OUTPUT="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$OUTPUT" ]]; then
  OUTPUT="$REPO_ROOT/artifacts/ios-remotexpc-screenshot-$(timestamp).png"
fi

cd "$REPO_ROOT"
npm run demo:iphone:screenshot -- --udid "$UDID" --output "$OUTPUT"
echo "Screenshot: $OUTPUT"