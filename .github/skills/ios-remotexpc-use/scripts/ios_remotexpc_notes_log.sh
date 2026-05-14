#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_SCRIPT="$SCRIPT_DIR/ios_remotexpc_run.sh"

TEXT=$'操作记录\n1. 启动备忘录\n2. 新建备忘录\n3. 写入本次自动化记录'
UDID=""
TEAM_ID=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --text)
      TEXT="$2"
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
    -h|--help)
      echo "Usage: bash .../ios_remotexpc_notes_log.sh [--text TEXT] [--udid UDID] [--team-id TEAM_ID]"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

bash "$RUN_SCRIPT" --request-json "$(node - <<'EOF' "$TEXT"
const [text] = process.argv.slice(2);
const request = {
  bundleId: 'com.apple.mobilenotes',
  actions: [
    { type: 'launch' },
    { type: 'tap', x: 360, y: 810 },
    {
      type: 'typeText',
      target: { kind: 'textView', index: 0 },
      text,
      timeout: 10,
    },
  ],
};
process.stdout.write(JSON.stringify(request));
EOF
)" ${UDID:+--udid "$UDID"} ${TEAM_ID:+--team-id "$TEAM_ID"}