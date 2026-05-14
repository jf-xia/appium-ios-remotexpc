---
description: "Use when working on iOS or iPhone automation in this repo: app install, IPA staging, screenshots, process control, XCTest/testmanagerd, syslog, notifications, device interaction limits, or log analysis."
applyTo: ["src/services/ios/**", "src/lib/apple-tv/**", "test/integration/**", "scripts/*.mjs"]
---
# iOS Automation Instructions

- Prefer the public exports in [src/index.ts](../../src/index.ts) and the helper factories in [src/services.ts](../../src/services.ts) before composing low-level service objects yourself.
- When the task is about iPhone/iOS automation, treat the integration tests under [test/integration](../../test/integration) as executable examples first, then adjust the owning implementation.

## Workflow Boundaries

- App installation means uploading or staging a prebuilt `.ipa` and installing it on-device. This library does not build or sign apps.
- The canonical install path is AFC upload to `/PublicStaging/...` plus Installation Proxy install/uninstall/upgrade.
- Best references:
  - [test/integration/afc-installation-workflow-test.ts](../../test/integration/afc-installation-workflow-test.ts)
  - [test/integration/installation-proxy-test.ts](../../test/integration/installation-proxy-test.ts)
  - [src/services/ios/installation-proxy/index.ts](../../src/services/ios/installation-proxy/index.ts)

## Screenshots And Runtime Control

- Device screenshots come from DVT instruments via `startDVTService(udid)` and `screenshot.getScreenshot()`.
- App launch, kill, PID lookup, and process output come from DVT `processControl`.
- Best references:
  - [src/services/ios/dvt/instruments/screenshot.ts](../../src/services/ios/dvt/instruments/screenshot.ts)
  - [src/services/ios/dvt/instruments/process-control.ts](../../src/services/ios/dvt/instruments/process-control.ts)
  - [test/integration/dvt_instruments/screenshot-test.ts](../../test/integration/dvt_instruments/screenshot-test.ts)
  - [test/integration/process-control-test.ts](../../test/integration/process-control-test.ts)

## UI Interaction Limits

- Do not invent a direct native tap, click, swipe, or text-entry API if you do not find one.
- This repo currently exposes screenshots, process control, WebInspector, and XCTest orchestration, but not a standalone native screen-coordinate input primitive.
- For real UI interaction on native apps, route through the XCTest path: `runXCTest(...)`, `XCUITestService`, `startXCTestServices(...)`, testmanagerd, and ProcessControl.
- Best references:
  - [src/services/ios/testmanagerd/xcuitest.ts](../../src/services/ios/testmanagerd/xcuitest.ts)
  - [src/services/ios/testmanagerd/xctest-common.ts](../../src/services/ios/testmanagerd/xctest-common.ts)
  - [test/integration/testmanagerd-test.ts](../../test/integration/testmanagerd-test.ts)

## Logs And Analysis

- For device logging, prefer `startSyslogBinaryService` or `startSyslogTextService` instead of ad-hoc tunnel reads.
- For app state and runtime signals, use DVT notifications and process output events when possible.
- For XCTest failures, use testmanagerd callback events and summaries instead of custom parsing.
- Best references:
  - [src/services/ios/syslog-service/index.ts](../../src/services/ios/syslog-service/index.ts)
  - [src/services/ios/syslog-service/syslog-entry-parser.ts](../../src/services/ios/syslog-service/syslog-entry-parser.ts)
  - [src/services/ios/dvt/instruments/notifications.ts](../../src/services/ios/dvt/instruments/notifications.ts)
  - [test/integration/tunnel-test.ts](../../test/integration/tunnel-test.ts)

## Repo-Specific Pitfalls

- For XCTest-related work, prefer `startXCTestServices(...)` over opening several independent RemoteXPC discovery flows; this repo already documents `ECONNRESET` risks when multiple RemoteXPC connections compete through the tunnel.
- Build the repo before using the ESM scripts under [scripts](../../scripts): `npm run build`.
- Do not claim runtime validation unless you actually ran against real hardware with the required env vars such as `UDID`, `TEST_IPA_PATH`, `TEST_BUNDLE_ID`, `TEST_RUNNER_BUNDLE_ID`, `APP_UNDER_TEST_BUNDLE_ID`, and `XCTEST_BUNDLE_ID`.

## Focused Validation

- Install and staging: `npm run test:installation-proxy`, `npm run test:installation-workflow`
- Screenshot and DVT: `npm run test:dvt:screenshot`, `npm run test:dvt`
- Process control: `npm run test:dvt:process-control`
- XCTest and testmanagerd: `npm run test:testmanagerd`
- Syslog and tunnels: `npm run test:tunnel`
- WebInspector: `npm run test:webinspector`

For broader repository defaults, see [AGENTS.md](../../AGENTS.md).