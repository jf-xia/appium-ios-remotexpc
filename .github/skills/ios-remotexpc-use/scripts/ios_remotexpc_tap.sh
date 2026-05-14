#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_SCRIPT="$SCRIPT_DIR/ios_remotexpc_run.sh"

BUNDLE_ID=""
UDID=""
TEAM_ID=""
ID=""
LABEL=""
KIND=""
INDEX=""
X=""
Y=""
TIMEOUT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bundle-id) BUNDLE_ID="$2"; shift 2 ;;
    --udid) UDID="$2"; shift 2 ;;
    --team-id) TEAM_ID="$2"; shift 2 ;;
    --id) ID="$2"; shift 2 ;;
    --label) LABEL="$2"; shift 2 ;;
    --kind) KIND="$2"; shift 2 ;;
    --index) INDEX="$2"; shift 2 ;;
    --x) X="$2"; shift 2 ;;
    --y) Y="$2"; shift 2 ;;
    --timeout) TIMEOUT="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: bash .../ios_remotexpc_tap.sh [--bundle-id BUNDLE_ID] [--id ID|--label LABEL|--kind KIND [--index N]|--x X --y Y] [--timeout SECONDS]"
      exit 0
      ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

bash "$RUN_SCRIPT" --request-json "$(node - <<'EOF' "$BUNDLE_ID" "$ID" "$LABEL" "$KIND" "$INDEX" "$X" "$Y" "$TIMEOUT"
const [bundleId, id, label, kind, index, x, y, timeout] = process.argv.slice(2);
const request = { actions: [{ type: 'tap' }] };
if (bundleId) request.bundleId = bundleId;
const action = request.actions[0];
if (x && y) {
  action.x = Number(x);
  action.y = Number(y);
} else {
  action.target = {};
  if (id) action.target.id = id;
  if (label) action.target.label = label;
  if (kind) action.target.kind = kind;
  if (index !== '') action.target.index = Number(index);
}
if (timeout) action.timeout = Number(timeout);
process.stdout.write(JSON.stringify(request));
EOF
)" ${UDID:+--udid "$UDID"} ${TEAM_ID:+--team-id "$TEAM_ID"}