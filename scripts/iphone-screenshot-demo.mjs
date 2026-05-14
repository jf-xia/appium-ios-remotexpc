#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { Command } from 'commander';

import {
  Services,
  TunnelAvailabilityError,
  createUsbmux,
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

  let dvtConnection;
  try {
    dvtConnection = await Services.startDVTService(udid);
    const screenshot = await dvtConnection.screenshot.getScreenshot();
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, screenshot);
    console.log(`Connected to ${udid}`);
    console.log(`Saved screenshot to ${outputPath}`);
  } catch (error) {
    if (error instanceof TunnelAvailabilityError) {
      console.error(error.message);
      console.error('Start a tunnel first: sudo npm run tunnel-creation');
      process.exitCode = 1;
      return;
    }
    throw error;
  } finally {
    if (dvtConnection) {
      await dvtConnection.dvtService.close().catch(() => {});
      await dvtConnection.remoteXPC.close().catch(() => {});
    }
  }
}

await main();