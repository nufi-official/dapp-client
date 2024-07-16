import type {MessagePort} from 'worker_threads'
import {MessageChannel as _MessageChannel} from 'worker_threads'

import type {
  ConnectorObject,
  ErrorResponse,
  MessageToClient,
  Response,
  SuccessResponse,
} from '../core/types'

import type {CreateConnectorObject} from './mocks'
import {getMockedInjectConnectors} from './mocks'

const connectorKind = 'connectorTesting' as const
const connectorPlatform = 'sso' as const

declare global {
  interface Window {
    [connectorKind]: {
      nufiSSO: any
    }
  }
}

const createConnectorObject: CreateConnectorObject = (client) => {
  const injectedMethods = {
    isEnabled: async () => {
      return await client.proxy.isEnabled()
    },
  }
  return injectedMethods as unknown as ConnectorObject
}

const setupRemotePortLister = (
  transfer: Transferable[],
  response?: Partial<{
    isEnabled: Response<SuccessResponse, ErrorResponse>
  }>,
) => {
  const port2 = transfer[0] as unknown as MessagePort
  port2.on('message', (e) => {
    if (e.method === 'isEnabled') {
      const reply: MessageToClient<typeof connectorKind> = {
        senderContext: 'widget',
        targetContext: 'sdk',
        type: 'response',
        id: e.id,
        result: response?.isEnabled ?? {
          kind: 'success',
          value: true as unknown as SuccessResponse,
        },
      }
      port2.postMessage(reply)
    }
  })
}

const handleSendPortMessage = (
  msg: any,
  transfer: Transferable[],
  response?: Partial<{
    isEnabled: Response<SuccessResponse, ErrorResponse>
  }>,
) => {
  if (msg.method !== 'initChannel') return
  setupRemotePortLister(transfer, response)
}

describe('initChannelMessage function', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    global.MessageChannel = _MessageChannel
  })

  test('Expect connectorPlatform to be defined in window object', async () => {
    await getMockedInjectConnectors({
      createConnectorObject,
      connectorPlatform,
      connectorKind,
      sendPortPostMessage: () => {},
    })
    expect(window[connectorKind]).toBeDefined()
  })

  test('Expect injected method to return proper output', async () => {
    await getMockedInjectConnectors({
      createConnectorObject,
      connectorPlatform,
      connectorKind,
      sendPortPostMessage: handleSendPortMessage,
    })
    const enabled = await window.connectorTesting.nufiSSO.isEnabled()
    expect(enabled).toEqual(true)
  })

  test('Expect `initChannelData` being send properly', async () => {
    const initChannelData = {
      type: 'widget',
      data: {
        connectorKind,
        connectorPlatform,
      },
    } as const

    await getMockedInjectConnectors({
      createConnectorObject,
      connectorPlatform,
      connectorKind,
      initChannelData,
      sendPortPostMessage: (_message, transfer: Transferable[]) => {
        const msg = _message as any
        if (msg.method !== 'initChannel') return

        // Check that this was called with the `initChannelData` that we supplied.
        expect(msg.data).toEqual(initChannelData)
        setupRemotePortLister(transfer)
      },
    })
    const enabled = await window.connectorTesting.nufiSSO.isEnabled()
    expect(enabled).toEqual(true)
  })

  test('Expect to throw on error', async () => {
    await getMockedInjectConnectors({
      createConnectorObject,
      connectorPlatform,
      connectorKind,
      sendPortPostMessage: (msg, transfer: Transferable[]) => {
        handleSendPortMessage(msg, transfer, {
          isEnabled: {
            kind: 'error',
            value: 'COULD_NOT_INIT' as unknown as ErrorResponse,
          },
        })
      },
    })

    expect(window.connectorTesting.nufiSSO.isEnabled()).rejects.toBe(
      'COULD_NOT_INIT',
    )
  })

  test('Expect `onBeforeRequest` to have effect', async () => {
    const onBeforeRequest = jest.fn()

    await getMockedInjectConnectors({
      createConnectorObject,
      connectorPlatform,
      connectorKind,
      onBeforeRequest,
      sendPortPostMessage: (msg, transfer: Transferable[]) => {
        expect(onBeforeRequest).toHaveBeenCalled()
        handleSendPortMessage(msg, transfer)
      },
    })
    const enabled = await window.connectorTesting.nufiSSO.isEnabled()
    expect(enabled).toEqual(true)
  })

  test('Expect `onBeforeFirstSend` to have effect', async () => {
    let listenerReady = false

    const onBeforeFirstSend = async () => {
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 2000))
      listenerReady = true
    }

    await getMockedInjectConnectors({
      createConnectorObject,
      connectorPlatform,
      connectorKind,
      onBeforeFirstSend,
      sendPortPostMessage: (msg, transfer: Transferable[]) => {
        expect(listenerReady).toBe(true)
        handleSendPortMessage(msg, transfer)
      },
    })
    const enabled = await window.connectorTesting.nufiSSO.isEnabled()
    expect(enabled).toEqual(true)
  })
})
