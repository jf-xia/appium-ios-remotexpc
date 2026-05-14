import type { TestmanagerdService } from '../../../lib/types.js';
import { MessageAux } from '../dvt/dtx-message.js';
import {
  extractNSKeyedArchiverObjects,
  hasNSErrorIndicators,
} from '../dvt/utils.js';
import { TESTMANAGERD_CHANNEL, XCODE_VERSION } from './xctest-common.js';

const MIN_ERROR_DESCRIPTION_LENGTH = 20;

const DIRECT_EVENT_SELECTOR = '_XCT_performDeviceEvent:completion:';
const DIRECT_EVENT_CHANNEL =
  'dtxproxy:XCTestManager_DaemonConnectionInterface:XCTestManager_IDEInterface';
const INITIATE_CONTROL_SESSION_SELECTOR =
  '_IDE_initiateControlSessionWithProtocolVersion:';
const AUTHORIZE_TEST_SESSION_SELECTOR =
  '_IDE_authorizeTestSessionWithProcessID:';

const TOUCH_PATH_TYPE = 1;
const POINTER_EVENT_TOUCH_DOWN = 1;
const POINTER_EVENT_LIFT_UP = 3;

export interface DirectTapEventOptions {
  x: number;
  y: number;
  liftUpOffset?: number;
  name?: string;
  targetProcessId?: number;
}

export function createDirectTapEventRecord(
  options: DirectTapEventOptions,
): Record<string, any> {
  const {
    x,
    y,
    liftUpOffset = 0.05,
    name = 'direct-testmanagerd-tap',
    targetProcessId = 0,
  } = options;

  return {
    __type: 'XCSynthesizedEventRecord',
    fields: {
      'originalOffset.dx': 0,
      parentWindowSize: { Width: 0, Height: 0 },
      orientation: 0,
      targetProcessID: targetProcessId,
      displayID: 0,
      systemAutomationProperties: null,
      'originalOffset.dy': 0,
      name,
      eventPaths: {
        __type: 'NSMutableArray',
        items: [
          {
            __type: 'XCPointerEventPath',
            fields: {
              'targetFrame.width': 0,
              'targetFrame.x': 0,
              pathType: TOUCH_PATH_TYPE,
              'targetFrame.y': 0,
              deviceID: 0,
              pointerEvents: {
                __type: 'NSMutableArray',
                items: [
                  createPointerEvent({
                    eventType: POINTER_EVENT_TOUCH_DOWN,
                    x,
                    y,
                    offset: 0,
                  }),
                  createPointerEvent({
                    eventType: POINTER_EVENT_LIFT_UP,
                    x,
                    y,
                    offset: liftUpOffset,
                  }),
                ],
              },
              speedFactor: 0,
              eventStream: null,
              'targetFrame.height': 0,
              index: 1,
            },
          },
        ],
      },
    },
  };
}

export async function createAuthorizedControlSession(
  connection: TestmanagerdService,
  processId: number,
  protocolVersion: number = XCODE_VERSION,
): Promise<number> {
  const channel = await connection.makeChannel(TESTMANAGERD_CHANNEL);
  const channelCode = channel.getCode();

  const initArgs = new MessageAux().appendObj(protocolVersion);
  await connection.sendMessage(channelCode, INITIATE_CONTROL_SESSION_SELECTOR, {
    args: initArgs,
  });
  const [initResult] = await connection.recvPlist(channelCode);
  throwIfNSErrorReply(initResult, 'Failed to initiate control session');

  const authArgs = new MessageAux().appendObj(processId);
  await connection.sendMessage(channelCode, AUTHORIZE_TEST_SESSION_SELECTOR, {
    args: authArgs,
  });
  const [authResult] = await connection.recvPlist(channelCode);
  throwIfNSErrorReply(authResult, 'Failed to authorize control session');

  return channelCode;
}

export async function performDirectTap(
  connection: TestmanagerdService,
  _channelCode: number,
  options: DirectTapEventOptions,
): Promise<void> {
  const directEventChannel = await connection.makeChannel(DIRECT_EVENT_CHANNEL);
  const directEventChannelCode = directEventChannel.getCode();

  const args = new MessageAux();
  args.appendObj(createDirectTapEventRecord(options));
  args.appendObj(null);

  await connection.sendMessage(directEventChannelCode, DIRECT_EVENT_SELECTOR, {
    args,
    expectsReply: true,
  });

  const [result] = await connection.recvPlist(directEventChannelCode);
  throwIfNSErrorReply(result, 'Failed to perform direct tap');
}

function createPointerEvent(options: {
  eventType: number;
  x: number;
  y: number;
  offset: number;
}): Record<string, any> {
  const { eventType, x, y, offset } = options;

  return {
    __type: 'XCPointerEvent',
    fields: {
      pressure: 0,
      eventType,
      clickCount: 0,
      duration: 0,
      verticalLineScroll: 0,
      keyCode: 0,
      gesturePhase: 0,
      'deltaVector.dy': 0,
      'destination.y': 0,
      buttonType: 0,
      keyModifierFlags: 0,
      gestureStage: 0,
      typingSpeed: 0,
      'destination.x': 0,
      deviceID: 0,
      offset,
      'deltaVector.dx': 0,
      'coordinate.y': y,
      mergeModifierFlagsWithCurrentFlags: false,
      'coordinate.x': x,
      keyPhase: 0,
      shouldRedact: false,
      string: null,
      key: null,
    },
  };
}

function throwIfNSErrorReply(result: unknown, context: string): void {
  if (result == null || typeof result !== 'object') {
    return;
  }

  const objects = extractNSKeyedArchiverObjects(result);
  if (objects) {
    const hasErr = objects.some((value) => hasNSErrorIndicators(value));
    if (hasErr) {
      const message =
        objects.find(
          (value: any) =>
            typeof value === 'string' &&
            value.length > MIN_ERROR_DESCRIPTION_LENGTH,
        ) ?? 'NSError from testmanagerd';
      throw new Error(`${context}: ${message}`);
    }
  }

  if (hasNSErrorIndicators(result)) {
    throw new Error(`${context}: ${JSON.stringify(result)}`);
  }
}
