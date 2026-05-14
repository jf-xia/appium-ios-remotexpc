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
EXPECTED=""
TIMEOUT="5"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bundle-id) BUNDLE_ID="$2"; shift 2 ;;
    --udid) UDID="$2"; shift 2 ;;
    --team-id) TEAM_ID="$2"; shift 2 ;;
    --id) ID="$2"; shift 2 ;;
    --label) LABEL="$2"; shift 2 ;;
    --kind) KIND="$2"; shift 2 ;;
    --index) INDEX="$2"; shift 2 ;;
    --expected) EXPECTED="$2"; shift 2 ;;
    --timeout) TIMEOUT="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: bash .../ios_remotexpc_assert_text.sh [--bundle-id BUNDLE_ID] [--id ID|--label LABEL|--kind KIND [--index N]] --expected TEXT [--timeout SECONDS]"
      exit 0
      ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$EXPECTED" ]]; then
  echo "--expected is required" >&2
  exit 1
fi

bash "$RUN_SCRIPT" --request-json "$(node - <<'EOF' "$BUNDLE_ID" "$ID" "$LABEL" "$KIND" "$INDEX" "$EXPECTED" "$TIMEOUT"
const [bundleId, id, label, kind, index, expected, timeout] = process.argv.slice(2);
const request = {
  actions: [{ type: 'assertText', expected, timeout: Number(timeout), target: {} }],
};
if (bundleId) request.bundleId = bundleId;
const target = request.actions[0].target;
if (id) target.id = id;
if (label) target.label = label;
if (kind) target.kind = kind;
if (index !== '') target.index = Number(index);
process.stdout.write(JSON.stringify(request));
EOF
)" ${UDID:+--udid "$UDID"} ${TEAM_ID:+--team-id "$TEAM_ID"}