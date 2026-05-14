#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { Command } from 'commander';
import { promisify } from 'node:util';

import { DVTSecureSocketProxyService } from '../build/src/services/ios/dvt/index.js';
import SyslogService from '../build/src/services/ios/syslog-service/index.js';
import {
  DvtTestmanagedProxyService,
  ProcessControl,
  TunnelManager,
  XCUITestService,
  XCTestEventType,
  createLockdownServiceByUDID,
  startCoreDeviceProxy,
} from 'appium-ios-remotexpc';

const SYSLOG_TEXT_SERVICE_NAME = 'com.apple.syslog_relay.shim.remote';
const execFileAsync = promisify(execFile);

const DEFAULT_LAUNCH_ENV = {
  CA_ASSERT_MAIN_THREAD_TRANSACTIONS: '0',
  CA_DEBUG_TRANSACTIONS: '0',
  DYLD_INSERT_LIBRARIES: '/Developer/usr/lib/libMainThreadChecker.dylib',
  DYLD_FRAMEWORK_PATH: '/System/Developer/Library/Frameworks',
  DYLD_LIBRARY_PATH: '/System/Developer/usr/lib',
  MTC_CRASH_ON_REPORT: '1',
  NSUnbufferedIO: 'YES',
  OS_ACTIVITY_DT_MODE: 'YES',
  SQLITE_ENABLE_THREAD_ASSERTIONS: '1',
  XCTestConfigurationFilePath: '',
  XCTestManagerVariant: 'DDI',
};

const NOOP_PACKET_SOURCE = {
  addPacketConsumer() {},
  removePacketConsumer() {},
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSyslogLine(syslogService, needle, timeoutMs) {
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for syslog line containing: ${needle}`));
    }, timeoutMs);

    const onMessage = (line) => {
      if (typeof line === 'string' && line.includes(needle)) {
        cleanup();
        resolve(line);
      }
    };

    const cleanup = () => {
      clearTimeout(timer);
      syslogService.off('message', onMessage);
    };

    syslogService.on('message', onMessage);
  });
}

async function createTunnelBackedServices(udid) {
  const { lockdownService, device } = await createLockdownServiceByUDID(udid);
  const { socket } = await startCoreDeviceProxy(
    lockdownService,
    device.DeviceID,
    device.Properties.SerialNumber,
    {
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2',
    },
  );

  const tunnel = await TunnelManager.getTunnel(socket);
  const remoteXPC = await TunnelManager.createRemoteXPCConnection(
    tunnel.Address,
    tunnel.RsdPort,
  );

  return {
    tunnel,
    remoteXPC,
    dvtDescriptor: remoteXPC.findService(
      DVTSecureSocketProxyService.RSD_SERVICE_NAME,
    ),
    testmanagerdDescriptor: remoteXPC.findService(
      DvtTestmanagedProxyService.RSD_SERVICE_NAME,
    ),
    syslogDescriptor: remoteXPC.findService(SYSLOG_TEXT_SERVICE_NAME),
  };
}

async function getInstalledAppPaths(udid, bundleIds) {
  const { stdout } = await execFileAsync('xcrun', [
    'devicectl',
    '-q',
    'device',
    'info',
    'apps',
    '--device',
    udid,
    '--json-output',
    '-',
  ]);

  const jsonStart = stdout.indexOf('{');
  if (jsonStart < 0) {
    throw new Error('Failed to parse devicectl app listing output');
  }

  const payload = JSON.parse(stdout.slice(jsonStart));
  const apps = payload?.result?.apps ?? [];
  const result = {};

  for (const bundleId of bundleIds) {
    const app = apps.find((item) => item.bundleIdentifier === bundleId);
    if (!app?.url) {
      throw new Error(`App not found on device: ${bundleId}`);
    }
    result[bundleId] = new URL(app.url).pathname;
  }

  return result;
}

async function main() {
  const program = new Command();
  program
    .name('iphone-testmanagerd-direct-tap-demo')
    .description('Demonstrate a direct testmanagerd tap injection without running an XCTest UI flow.')
    .option('--udid <udid>', 'device UDID', process.env.UDID || '00008140-001465202E10801C')
    .option('--bundle-id <bundleId>', 'target bundle id', 'com.jianfeng.iosclickdemo')
    .option('--runner-bundle-id <bundleId>', 'xctrunner app bundle id', 'com.jianfeng.iosclickdemo.uitests.xctrunner')
    .option('--xctest-bundle-id <bundleId>', 'xctest bundle id', 'com.jianfeng.iosclickdemo.uitests')
    .option('--xctest-bundle-name <name>', 'xctest bundle name on device', 'IOSClickDemo')
    .option('--xctest-module-name <name>', 'xctest module / test class prefix', 'IOSClickDemoUITests')
    .option('--x <x>', 'tap x coordinate in points', (value) => Number.parseFloat(value), 200)
    .option('--y <y>', 'tap y coordinate in points', (value) => Number.parseFloat(value), 250)
    .option('--timeout <ms>', 'syslog wait timeout in milliseconds', (value) => Number.parseInt(value, 10), 15000)
    .parse(process.argv);

  const options = program.opts();
  const logNeedle = '[DirectRemoteXPCDemo] direct tap zone tapped';

  let remoteXPC;
  let syslogService;
  let execTestmanagerd;
  let controlTestmanagerd;
  let dvtService;
  let xcuitest;
  let launchedRunnerPid = 0;

  try {
    const tunnelBacked = await createTunnelBackedServices(options.udid);
    remoteXPC = tunnelBacked.remoteXPC;

    syslogService = new SyslogService([
      tunnelBacked.tunnel.Address,
      tunnelBacked.tunnel.RsdPort,
    ]);
    await syslogService.start(
      tunnelBacked.syslogDescriptor,
      NOOP_PACKET_SOURCE,
      { pid: -1, textMode: true },
    );

    execTestmanagerd = new DvtTestmanagedProxyService([
      tunnelBacked.tunnel.Address,
      parseInt(tunnelBacked.testmanagerdDescriptor.port, 10),
    ]);
    await execTestmanagerd.connect();

    controlTestmanagerd = new DvtTestmanagedProxyService([
      tunnelBacked.tunnel.Address,
      parseInt(tunnelBacked.testmanagerdDescriptor.port, 10),
    ]);
    await controlTestmanagerd.connect();

    dvtService = new DVTSecureSocketProxyService([
      tunnelBacked.tunnel.Address,
      parseInt(tunnelBacked.dvtDescriptor.port, 10),
    ]);
    await dvtService.connect();

    const processControl = new ProcessControl(dvtService);
    const appPaths = await getInstalledAppPaths(options.udid, [
      options.bundleId,
      options.runnerBundleId,
    ]);
    const runnerPath = appPaths[options.runnerBundleId];
    const targetPath = appPaths[options.bundleId];
    const testBundlePath = `${runnerPath}/PlugIns/${options.xctestBundleName}.xctest`;

    xcuitest = new XCUITestService({
      controlConnection: controlTestmanagerd,
      execConnection: execTestmanagerd,
      options: {
        udid: options.udid,
        xctestBundleId: options.xctestBundleId,
        targetBundleId: options.bundleId,
        targetAppPath: targetPath,
        productModuleName: options.xctestModuleName,
        initializeForUITesting: true,
        testsToRun: [
          `${options.xctestModuleName}/testHoldForDirectRemoteXpcSession`,
        ],
      },
    });

    xcuitest.on('xctest', (event) => {
      switch (event.type) {
        case XCTestEventType.TestCaseStarted:
          console.log(`[xctest] test started: ${event.identifier}`);
          break;
        case XCTestEventType.TestCaseFinished:
          console.log(
            `[xctest] test finished: ${event.identifier} (${event.status})`,
          );
          break;
        case XCTestEventType.TestPlanFinished:
          console.log('[xctest] test plan finished');
          break;
        default:
          break;
      }
    });

    await xcuitest.initExecSession();

    launchedRunnerPid = await processControl.launch({
      bundleId: options.runnerBundleId,
      environment: {
        ...DEFAULT_LAUNCH_ENV,
        XCTestBundlePath: testBundlePath,
        XCTestSessionIdentifier: xcuitest.sessionIdentifier.toUpperCase(),
        DIRECT_REMOTE_XPC_HOLD_SECONDS: String(
          Math.max(30, Math.ceil(options.timeout / 1000) + 10),
        ),
      },
      killExisting: true,
    });

    xcuitest.startExecCallbackListener(testBundlePath);
    await xcuitest.initControlSessionAndAuthorize(Math.abs(launchedRunnerPid));
    await xcuitest.startExecutingTestPlan();

    await delay(4000);

    const targetPid = await processControl.getPidForBundleIdentifier(
      options.bundleId,
    );
    console.log(`Target app PID before direct tap: ${targetPid}`);

    const logPromise = waitForSyslogLine(
      syslogService,
      logNeedle,
      options.timeout,
    );

    await xcuitest.dispatchDirectTap({
      x: options.x,
      y: options.y,
      targetProcessId: targetPid > 0 ? targetPid : 0,
    });

    const matchedLine = await logPromise;

    console.log(`Direct tap injected on ${options.udid}`);
    console.log(`Bundle: ${options.bundleId}`);
    console.log(`Coordinate: (${options.x}, ${options.y})`);
    console.log(`Observed syslog: ${matchedLine}`);
  } finally {
    await syslogService?.stop().catch(() => {});
    await xcuitest?.stop().catch(() => {});
    if (dvtService && launchedRunnerPid) {
      const processControl = new ProcessControl(dvtService);
      await processControl.kill(Math.abs(launchedRunnerPid)).catch(() => {});
    }
    await dvtService?.close().catch(() => {});
    await remoteXPC?.close().catch(() => {});
    await TunnelManager.closeAllTunnels().catch(() => {});
  }
}

await main();