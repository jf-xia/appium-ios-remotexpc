---
name: ios-remotexpc-use
description: 'Operate a real iPhone through this repo''s RemoteXPC + XCUITest automation stack. Use for USB device checks, starting the local automation server, sending launch/tap/typeText/swipe/wait/assert action batches, capturing screenshots, and iterating with observe -> act -> verify.'
argument-hint: 'Describe the phone task, for example: launch IOSClickDemo and tap the button; capture a screenshot; run an action batch from request.json'
user-invocable: true
---

# iOS RemoteXPC Use

## When To Use
- Operate a real iPhone connected to this Mac over the repo's existing RemoteXPC and XCUITest path.
- Run one action batch from a single command instead of manually driving `xcodebuild`.
- Capture screenshots before and after each action batch.
- Drive apps that can be handled by the current UI test action model.

## Current Stack
- Transport and services come from this repository, not WebDriverAgent.
- Action execution currently goes through the existing demo automation server in [./scripts/ios_remotexpc_server.sh](./scripts/ios_remotexpc_server.sh), which wraps [scripts/iphone-http-automation-server.mjs](../../../scripts/iphone-http-automation-server.mjs).
- Screenshots use [./scripts/ios_remotexpc_snapshot.sh](./scripts/ios_remotexpc_snapshot.sh), which wraps [scripts/iphone-screenshot-demo.mjs](../../../scripts/iphone-screenshot-demo.mjs).

## Core Rule
Use small action batches and verify state between them.

Preferred loop:
1. Capture a screenshot with [./scripts/ios_remotexpc_snapshot.sh](./scripts/ios_remotexpc_snapshot.sh).
2. Decide one small action batch.
3. Run it with [./scripts/ios_remotexpc_run.sh](./scripts/ios_remotexpc_run.sh).
4. Capture another screenshot and compare.

Do not queue long speculative chains unless the request is already deterministic and self-verifying.

## Quick Start
```bash
# Start or reuse the local automation server
bash .github/skills/ios-remotexpc-use/scripts/ios_remotexpc_server.sh --start

# Run one action batch from a JSON file
bash .github/skills/ios-remotexpc-use/scripts/ios_remotexpc_run.sh \
  --request-file .github/skills/ios-remotexpc-use/assets/demo-request.json

# Capture a screenshot after the action batch
bash .github/skills/ios-remotexpc-use/scripts/ios_remotexpc_snapshot.sh
```

## Supported Actions
The current action schema is implemented by [demo/ios-click-demo/IOSClickDemoUITests/IOSClickDemoUITests.swift](../../../demo/ios-click-demo/IOSClickDemoUITests/IOSClickDemoUITests.swift).

Supported action types:
- `launch`
- `activate`
- `tap`
- `typeText`
- `swipe`
- `waitForExistence`
- `assertText`

Request shapes and examples are in [./references/actions.md](./references/actions.md) and [./assets/demo-request.json](./assets/demo-request.json).

## Procedure
1. Confirm the device is connected by USB.
2. Start the local server with [./scripts/ios_remotexpc_server.sh](./scripts/ios_remotexpc_server.sh).
3. Capture a baseline screenshot with [./scripts/ios_remotexpc_snapshot.sh](./scripts/ios_remotexpc_snapshot.sh).
4. Prepare a small JSON request file.
5. Execute the batch with [./scripts/ios_remotexpc_run.sh](./scripts/ios_remotexpc_run.sh).
6. Capture another screenshot.
7. Repeat with the next small batch.

## Scripts
- Server lifecycle: [./scripts/ios_remotexpc_server.sh](./scripts/ios_remotexpc_server.sh)
- Run one automation batch: [./scripts/ios_remotexpc_run.sh](./scripts/ios_remotexpc_run.sh)
- Capture screenshot: [./scripts/ios_remotexpc_snapshot.sh](./scripts/ios_remotexpc_snapshot.sh)

## References
- Workflow: [./references/workflow.md](./references/workflow.md)
- Action JSON shapes: [./references/actions.md](./references/actions.md)

## Limitations
- This skill targets a real iPhone on this Mac. It does not manage simulators.
- It uses the repo's current XCUITest action model, not a generic element inspector.
- Direct `testmanagerd` tap injection is still experimental and is not the default path for this skill.