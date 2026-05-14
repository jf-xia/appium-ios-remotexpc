#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_SCRIPT="$SCRIPT_DIR/ios_remotexpc_run.sh"

BUNDLE_ID=""
UDID=""
TEAM_ID=""
DIRECTION="up"
ID=""
LABEL=""
KIND=""
INDEX=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bundle-id) BUNDLE_ID="$2"; shift 2 ;;
    --udid) UDID="$2"; shift 2 ;;
    --team-id) TEAM_ID="$2"; shift 2 ;;
    --direction) DIRECTION="$2"; shift 2 ;;
    --id) ID="$2"; shift 2 ;;
    --label) LABEL="$2"; shift 2 ;;
    --kind) KIND="$2"; shift 2 ;;
    --index) INDEX="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: bash .../ios_remotexpc_swipe.sh [--bundle-id BUNDLE_ID] [--direction up|down|left|right] [--id ID|--label LABEL|--kind KIND [--index N]]"
      exit 0
      ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

bash "$RUN_SCRIPT" --request-json "$(node - <<'EOF' "$BUNDLE_ID" "$DIRECTION" "$ID" "$LABEL" "$KIND" "$INDEX"
const [bundleId, direction, id, label, kind, index] = process.argv.slice(2);
const action = { type: 'swipe', direction };
if (id || label || kind || index !== '') {
  action.target = {};
  if (id) action.target.id = id;
  if (label) action.target.label = label;
  if (kind) action.target.kind = kind;
  if (index !== '') action.target.index = Number(index);
}
const request = { actions: [action] };
if (bundleId) request.bundleId = bundleId;
process.stdout.write(JSON.stringify(request));
EOF
)" ${UDID:+--udid "$UDID"} ${TEAM_ID:+--team-id "$TEAM_ID"}