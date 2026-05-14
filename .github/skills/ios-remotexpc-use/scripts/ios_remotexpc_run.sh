#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$SKILL_ROOT/../../.." && pwd)"
SERVER_SCRIPT="$SCRIPT_DIR/ios_remotexpc_server.sh"

PORT="${IPHONE_HTTP_AUTOMATION_PORT:-4726}"
HOST="127.0.0.1"
REQUEST_FILE=""
REQUEST_JSON=""
UDID=""
TEAM_ID=""

usage() {
  cat <<EOF
Usage: bash .github/skills/ios-remotexpc-use/scripts/ios_remotexpc_run.sh [--request-file PATH | --request-json JSON] [--udid UDID] [--team-id TEAM] [--port PORT]
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --request-file)
      REQUEST_FILE="$2"
      shift 2
      ;;
    --request-json)
      REQUEST_JSON="$2"
      shift 2
      ;;
    --udid)
      UDID="$2"
      shift 2
      ;;
    --team-id)
      TEAM_ID="$2"
      shift 2
      ;;
    --port)
      PORT="$2"
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

if [[ -z "$REQUEST_FILE" && -z "$REQUEST_JSON" ]]; then
  echo "One of --request-file or --request-json is required" >&2
  exit 1
fi

if [[ -n "$REQUEST_FILE" && -n "$REQUEST_JSON" ]]; then
  echo "Use only one of --request-file or --request-json" >&2
  exit 1
fi

bash "$SERVER_SCRIPT" --start --port "$PORT" >/dev/null

if [[ -n "$REQUEST_FILE" ]]; then
  REQUEST_JSON="$(cat "$REQUEST_FILE")"
fi

PAYLOAD="$(cd "$REPO_ROOT" && node - "$REQUEST_JSON" "$UDID" "$TEAM_ID" <<'EOF'
const [requestJson, udid, teamId] = process.argv.slice(2);
const payload = JSON.parse(requestJson);
if (udid) {
  payload.udid = udid;
}
if (teamId) {
  payload.teamId = teamId;
}
process.stdout.write(JSON.stringify(payload));
EOF
)"

curl -fsS \
  -H 'content-type: application/json' \
  -X POST \
  --data "$PAYLOAD" \
  "http://${HOST}:${PORT}/automation/run"
echo