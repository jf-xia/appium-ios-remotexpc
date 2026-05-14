# AGENTS.md

This repository is a Node.js/TypeScript library for talking to real iOS-family devices through lockdown, tunnels, RemoteXPC, DVT instruments, and testmanagerd. Prefer the public exports in [src/index.ts](src/index.ts) and the helper factories in [src/services.ts](src/services.ts) before assembling low-level services by hand.

## Basics

- Use Node versions compatible with [package.json](package.json): Node `^20.19.0 || ^22.12.0 || >=24.0.0`, npm `>=10`.
- Build before using the ESM scripts under [scripts](scripts): `npm run build`.
- Default validation commands:
  - `npm run build`
  - `npm run lint`
  - `npm run test:unit`
- Many integration tests require a real iPhone/iPad plus macOS networking/tunneling setup. Do not claim they were validated unless you actually ran them with hardware.
- Tunnel creation scripts require `sudo`; see [README.md](README.md).

## Where To Start

- Public API surface: [src/index.ts](src/index.ts)
- High-level service starters: [src/services.ts](src/services.ts)
- Architecture and prerequisites: [README.md](README.md)
- Apple TV pairing only: [docs/apple-tv-pairing-guide.md](docs/apple-tv-pairing-guide.md)

For implementation tasks, start from the highest-level helper that already owns the behavior:

- `Services.startAfcService(udid)` for file transfer to the device
- `Services.startInstallationProxyService(udid)` for installed-app queries, install, uninstall, upgrade
- `Services.startDVTService(udid)` for screenshots, process control, notifications, network monitor, device info
- `Services.startTestmanagerdService(udid)` for raw testmanagerd access
- `Services.startXCTestServices(udid)` for coordinated XCTest flows
- `runXCTest(...)` and `XCUITestService` for XCTest runner orchestration
- `Services.startSyslogBinaryService(udid)` and `Services.startSyslogTextService(udid)` for log collection
- `Services.startWebInspectorService(udid)` only for WebInspector/Safari-style automation, not native UI tap/input

## iOS Automation Focus

If the task is about iPhone/iOS automation, use these repo-specific boundaries.

### App install and package staging

- This repo installs a prebuilt `.ipa`; it does not build or codesign iOS apps for you.
- The canonical install workflow is AFC upload to `/PublicStaging/...` plus Installation Proxy install/uninstall.
- Best examples:
  - [test/integration/afc-installation-workflow-test.ts](test/integration/afc-installation-workflow-test.ts)
  - [test/integration/installation-proxy-test.ts](test/integration/installation-proxy-test.ts)
  - [src/services/ios/installation-proxy/index.ts](src/services/ios/installation-proxy/index.ts)
- If a task says "package" or "打包", verify whether the user means "build/sign an IPA" or "stage/upload/install an existing IPA". This library directly supports the second meaning.

### Screenshots

- Screenshot capture is exposed through DVT instruments, not through SpringBoard or WebInspector.
- Use `Services.startDVTService(udid)` and then `dvt.screenshot.getScreenshot()`.
- Best references:
  - [src/services/ios/dvt/instruments/screenshot.ts](src/services/ios/dvt/instruments/screenshot.ts)
  - [test/integration/dvt_instruments/screenshot-test.ts](test/integration/dvt_instruments/screenshot-test.ts)

### App launch, process control, and automation session setup

- Native app launch/kill/PID lookup is handled by DVT `processControl`.
- Best references:
  - [src/services/ios/dvt/instruments/process-control.ts](src/services/ios/dvt/instruments/process-control.ts)
  - [test/integration/process-control-test.ts](test/integration/process-control-test.ts)
- For XCTest-based automation, prefer `runXCTest(...)` or `startXCTestServices(...)` over manually composing multiple RemoteXPC connections.
- Important repo-specific constraint: [src/services.ts](src/services.ts) documents that `startXCTestServices` reuses one discovery pass to avoid `ECONNRESET` caused by simultaneous RemoteXPC usage through the tunnel.

### Tap, click, typing, and other UI interaction

- There is no standalone native "tap at x/y" or "type text" primitive implemented in this repo.
- UI interaction is expected to happen through the XCTest runner path (`runXCTest`, `XCUITestService`, testmanagerd + ProcessControl), where the launched runner performs UI automation.
- Relevant references:
  - [src/services/ios/testmanagerd/xcuitest.ts](src/services/ios/testmanagerd/xcuitest.ts)
  - [src/services/ios/testmanagerd/xctest-common.ts](src/services/ios/testmanagerd/xctest-common.ts)
  - [test/integration/testmanagerd-test.ts](test/integration/testmanagerd-test.ts)
- If a request asks for direct screen clicking/input APIs, state the current limitation explicitly instead of inventing one.

### Logs, notifications, and debugging signals

- Device logs:
  - Binary os_trace path: `startSyslogBinaryService`
  - Text relay path: `startSyslogTextService`
- Best references:
  - [src/services/ios/syslog-service/index.ts](src/services/ios/syslog-service/index.ts)
  - [src/services/ios/syslog-service/syslog-entry-parser.ts](src/services/ios/syslog-service/syslog-entry-parser.ts)
  - [test/integration/tunnel-test.ts](test/integration/tunnel-test.ts)
- App/runtime state notifications come from DVT notifications:
  - [src/services/ios/dvt/instruments/notifications.ts](src/services/ios/dvt/instruments/notifications.ts)
- Process stdout/stderr-like output can be monitored from DVT process control output events:
  - [src/services/ios/dvt/instruments/process-control.ts](src/services/ios/dvt/instruments/process-control.ts)
- XCTest result and failure analysis should follow emitted testmanagerd callback events, not ad-hoc parsing:
  - [src/services/ios/testmanagerd/xcuitest.ts](src/services/ios/testmanagerd/xcuitest.ts)

## Validation By Slice

Use the narrowest command that matches the touched area.

- Installation/staging: `npm run test:installation-proxy`, `npm run test:installation-workflow`
- Screenshot/DVT: `npm run test:dvt:screenshot`, `npm run test:dvt`
- Process control: `npm run test:dvt:process-control`
- XCTest/testmanagerd: `npm run test:testmanagerd`
- Syslog/tunnel behavior: `npm run test:tunnel`
- WebInspector/Safari: `npm run test:webinspector`

Many of these require environment variables such as `UDID`, `TEST_IPA_PATH`, `TEST_BUNDLE_ID`, `TEST_RUNNER_BUNDLE_ID`, `APP_UNDER_TEST_BUNDLE_ID`, and `XCTEST_BUNDLE_ID`. Reuse the test files as the source of truth for required inputs.

## Editing Guidance

- Prefer minimal TypeScript changes that preserve current public exports and service names.
- Keep service wiring consistent with existing patterns in [src/services.ts](src/services.ts).
- Use integration tests as executable documentation; for automation workflows, tests under [test/integration](test/integration) are often the clearest examples.
- Link back to existing docs instead of duplicating them in new docs or instruction files.