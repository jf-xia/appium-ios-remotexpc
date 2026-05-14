#!/usr/bin/env node

import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const workspacePath = path.join(repoRoot, 'demo', 'ios-click-demo', 'IOSClickDemo.xcworkspace');
const testPlanPath = path.join(repoRoot, 'demo', 'ios-click-demo', 'IOSClickDemo', 'IOSClickDemo.xctestplan');
const scheme = 'IOSClickDemo';
const defaultUdid = '00008140-001465202E10801C';
const defaultTeamId = '27WY6645VZ';
const defaultPort = Number.parseInt(process.env.IPHONE_HTTP_AUTOMATION_PORT ?? '4726', 10);
const onlyTestingTarget = 'IOSClickDemoUITests/IOSClickDemoUITests/testHttpDrivenAutomation';

let activeRun = false;

function jsonResponse(res, statusCode, body) {
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body, null, 2));
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function makeDemoRequest() {
  return {
    bundleId: null,
    actions: [
      { type: 'launch' },
      { type: 'tap', target: { id: 'tap-demo.button' }, timeout: 10 },
      { type: 'assertText', target: { id: 'tap-demo.status' }, expected: 'Tapped 1 time', timeout: 5 },
      { type: 'typeText', target: { id: 'text-demo.field' }, text: 'hello from http', timeout: 5 },
      { type: 'assertText', target: { id: 'text-demo.output' }, expected: 'hello from http', timeout: 5 },
      { type: 'swipe', target: { id: 'demo.scrollView' }, direction: 'up' },
      { type: 'swipe', target: { id: 'demo.scrollView' }, direction: 'up' },
      { type: 'swipe', target: { id: 'demo.scrollView' }, direction: 'up' },
      { type: 'waitForExistence', target: { id: 'swipe-demo.target' }, timeout: 5 },
    ],
  };
}

async function withAutomationRequestInTestPlan(base64Payload, fn) {
  const original = await readFile(testPlanPath, 'utf8');
  const plan = JSON.parse(original);

  for (const configuration of plan.configurations ?? []) {
    configuration.options ??= {};
    const existing = configuration.options.environmentVariableEntries ?? [];
    configuration.options.environmentVariableEntries = [
      ...existing.filter((entry) => entry.key !== 'AUTOMATION_REQUEST_BASE64'),
      {
        key: 'AUTOMATION_REQUEST_BASE64',
        value: base64Payload,
        isEnabled: true,
      },
    ];
  }

  await writeFile(testPlanPath, `${JSON.stringify(plan, null, 2)}\n`);
  try {
    return await fn();
  } finally {
    await writeFile(testPlanPath, original);
  }
}

function runDeviceAutomation({ udid, teamId }) {
  return new Promise((resolve) => {
    const args = [
      'xcodebuild',
      '-workspace', workspacePath,
      '-scheme', scheme,
      '-destination', `id=${udid}`,
      '-allowProvisioningUpdates',
      `DEVELOPMENT_TEAM=${teamId}`,
      `-only-testing:${onlyTestingTarget}`,
      'test',
    ];

    const child = spawn('xcrun', args, {
      cwd: repoRoot,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      resolve({ success: code === 0, code, stdout, stderr });
    });
  });
}

async function handleAutomationRequest(res, requestBody) {
  if (activeRun) {
    jsonResponse(res, 409, {
      success: false,
      error: 'Automation server is busy running another request.',
    });
    return;
  }

  activeRun = true;
  const udid = requestBody.udid ?? defaultUdid;
  const teamId = requestBody.teamId ?? defaultTeamId;
  const automationRequest = {
    bundleId: requestBody.bundleId ?? null,
    actions: requestBody.actions ?? [],
  };
  const payload = Buffer.from(JSON.stringify(automationRequest)).toString('base64');

  try {
    const result = await withAutomationRequestInTestPlan(payload, async () =>
      await runDeviceAutomation({ udid, teamId }),
    );

    jsonResponse(res, result.success ? 200 : 500, {
      success: result.success,
      udid,
      teamId,
      request: automationRequest,
      exitCode: result.code,
      stdout: result.stdout,
      stderr: result.stderr,
    });
  } catch (error) {
    jsonResponse(res, 500, {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    activeRun = false;
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    jsonResponse(res, 200, {
      success: true,
      status: 'ok',
      defaultUdid,
      defaultTeamId,
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/demo/run') {
    await handleAutomationRequest(res, makeDemoRequest());
    return;
  }

  if (req.method === 'POST' && url.pathname === '/automation/run') {
    try {
      const rawBody = await collectBody(req);
      const body = rawBody.trim() ? JSON.parse(rawBody) : {};
      await handleAutomationRequest(res, body);
    } catch (error) {
      jsonResponse(res, 400, {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  jsonResponse(res, 404, {
    success: false,
    error: 'Not found',
    routes: ['GET /health', 'GET /demo/run', 'POST /automation/run'],
  });
});

server.listen(defaultPort, '127.0.0.1', () => {
  console.log(`iPhone HTTP automation server listening on http://127.0.0.1:${defaultPort}`);
  console.log(`Default UDID: ${defaultUdid}`);
  console.log('Routes: GET /health, GET /demo/run, POST /automation/run');
});