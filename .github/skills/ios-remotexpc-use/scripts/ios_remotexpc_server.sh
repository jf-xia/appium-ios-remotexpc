#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$SKILL_ROOT/../../.." && pwd)"

PORT="${IPHONE_HTTP_AUTOMATION_PORT:-4726}"
HOST="127.0.0.1"
PID_FILE="/tmp/ios-remotexpc-http-server-${PORT}.pid"
LOG_FILE="/tmp/ios-remotexpc-http-server-${PORT}.log"
ACTION="start"

usage() {
  cat <<EOF
Usage: bash .github/skills/ios-remotexpc-use/scripts/ios_remotexpc_server.sh [--start|--stop|--status] [--port PORT] [--log-file PATH]
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --start)
      ACTION="start"
      shift
      ;;
    --stop)
      ACTION="stop"
      shift
      ;;
    --status)
      ACTION="status"
      shift
      ;;
    --port)
      PORT="$2"
      PID_FILE="/tmp/ios-remotexpc-http-server-${PORT}.pid"
      LOG_FILE="/tmp/ios-remotexpc-http-server-${PORT}.log"
      shift 2
      ;;
    --log-file)
      LOG_FILE="$2"
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

healthcheck() {
  curl -fsS "http://${HOST}:${PORT}/health" >/dev/null 2>&1
}

start_server() {
  if healthcheck; then
    echo "Automation server already running at http://${HOST}:${PORT}"
    exit 0
  fi

  cd "$REPO_ROOT"
  npm run build >/dev/null

  nohup env IPHONE_HTTP_AUTOMATION_PORT="$PORT" node scripts/iphone-http-automation-server.mjs >"$LOG_FILE" 2>&1 &
  local pid=$!
  echo "$pid" >"$PID_FILE"

  for _ in $(seq 1 30); do
    if healthcheck; then
      echo "Automation server started at http://${HOST}:${PORT}"
      echo "PID: $pid"
      echo "Log: $LOG_FILE"
      exit 0
    fi
    sleep 1
  done

  echo "Automation server failed to become healthy. Log: $LOG_FILE" >&2
  exit 1
}

stop_server() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE")"
    kill "$pid" >/dev/null 2>&1 || true
    rm -f "$PID_FILE"
  fi

  echo "Stopped automation server on port $PORT"
}

status_server() {
  if healthcheck; then
    echo "Automation server is healthy at http://${HOST}:${PORT}"
    exit 0
  fi

  echo "Automation server is not running on port $PORT" >&2
  exit 1
}

case "$ACTION" in
  start)
    start_server
    ;;
  stop)
    stop_server
    ;;
  status)
    status_server
    ;;
esac