#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { Command } from 'commander';

import { DVTSecureSocketProxyService } from '../build/src/services/ios/dvt/index.js';
import { Screenshot } from '../build/src/services/ios/dvt/instruments/screenshot.js';
import {
  TunnelManager,
  createUsbmux,
  createLockdownServiceByUDID,
  startCoreDeviceProxy,
} from 'appium-ios-remotexpc';

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function listConnectedDevices() {
  const usbmux = await createUsbmux();
  try {
    return await usbmux.listDevices();
  } finally {
    await usbmux.close().catch(() => {});
  }
}

async function resolveUdid(explicitUdid) {
  if (explicitUdid) {
    return explicitUdid;
  }

  const devices = await listConnectedDevices();
  if (devices.length === 0) {
    throw new Error(
      'No paired iPhone/iPad found via usbmuxd. Connect the device by USB, tap Trust on the device, then try again.',
    );
  }

  if (devices.length > 1) {
    const deviceList = devices
      .map(
        (device) =>
          `- ${device.Properties.SerialNumber} (${device.Properties.ConnectionType})`,
      )
      .join('\n');
    throw new Error(
      `Multiple devices found. Re-run with --udid.\n${deviceList}`,
    );
  }

  return devices[0].Properties.SerialNumber;
}

async function main() {
  const program = new Command();
  program
    .name('iphone-screenshot-demo')
    .description('Capture a screenshot from a connected iPhone/iPad using the existing tunnel + DVT flow.')
    .option('--udid <udid>', 'device UDID; if omitted and only one device is connected, it will be used automatically')
    .option(
      '--output <path>',
      'output PNG path',
      path.join(process.cwd(), 'artifacts', `iphone-screenshot-${timestamp()}.png`),
    )
    .parse(process.argv);

  const options = program.opts();
  const udid = await resolveUdid(options.udid ?? process.env.UDID ?? '');
  const outputPath = path.resolve(options.output);

  let remoteXPC;
  let dvtService;
  try {
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
    remoteXPC = await TunnelManager.createRemoteXPCConnection(
      tunnel.Address,
      tunnel.RsdPort,
    );

    const dvtServiceDescriptor = remoteXPC.findService(
      DVTSecureSocketProxyService.RSD_SERVICE_NAME,
    );
    dvtService = new DVTSecureSocketProxyService([
      tunnel.Address,
      parseInt(dvtServiceDescriptor.port, 10),
    ]);
    await dvtService.connect();

    const screenshotService = new Screenshot(dvtService);
    const screenshot = await screenshotService.getScreenshot();
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, screenshot);
    console.log(`Connected to ${udid}`);
    console.log(`Saved screenshot to ${outputPath}`);
  } catch (error) {
    throw error;
  } finally {
    await dvtService?.close().catch(() => {});
    await remoteXPC?.close().catch(() => {});
    await TunnelManager.closeAllTunnels().catch(() => {});
  }
}

await main();