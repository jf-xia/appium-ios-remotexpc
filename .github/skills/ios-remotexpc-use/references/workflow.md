# Workflow

## Observe -> Act -> Verify

Use this skill in short loops.

1. Capture a screenshot.
2. Decide one small action batch.
3. Execute the batch.
4. Capture another screenshot.
5. Compare and continue.

## Recommended Command Sequence

Start the server once:

```bash
bash .github/skills/ios-remotexpc-use/scripts/ios_remotexpc_server.sh --start
```

Take a baseline screenshot:

```bash
bash .github/skills/ios-remotexpc-use/scripts/ios_remotexpc_snapshot.sh
```

Run one batch:

```bash
bash .github/skills/ios-remotexpc-use/scripts/ios_remotexpc_run.sh \
  --request-file .github/skills/ios-remotexpc-use/assets/demo-request.json
```

Take another screenshot:

```bash
bash .github/skills/ios-remotexpc-use/scripts/ios_remotexpc_snapshot.sh
```

## Notes
- The server wraps `xcodebuild` test execution and is serialized; do not start overlapping runs.
- Prefer accessibility ids or stable labels over coordinate taps.
- Use coordinates only when there is no better selector.