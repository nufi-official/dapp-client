import {messageDirectionMatches} from '../publicUtils'

import {safeAssertUnreachable} from './assertion'
import {logger} from './logging'
import type {
  InitChannelMessage,
  RequestArgument,
  RequestMessage,
  SuccessResponse,
  ErrorResponse,
  MessageToClient,
  ScriptContext,
  UntypedConnectorKind,
  MessageToClientEvent,
  InitChannelData,
  ConnectorPlatform,
} from './types'
import {getRandomUUID} from './utils'

const cachedGetPort = <T extends MessagePort>(
  getPort: (invalidatePort: () => void) => T,
): (() => T) => {
  let port: null | T = null
  const invalidatePort = () => {
    port = null
  }
  return () => {
    if (port === null) port = getPort(invalidatePort)
    return port
  }
}

type SetupClientChannelParams<ConnectorKind extends UntypedConnectorKind> = {
  appId: string
  connectorPlatform: ConnectorPlatform
  currentContext: ScriptContext
  targetContext: ScriptContext
  eventHandler: (
    kind: ConnectorKind,
    method: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args: any[],
  ) => Promise<void>
  sendPortPostMessage: (message: unknown, transfer: Transferable[]) => void
  onBeforeFirstSend?: () => Promise<void>
  onBeforeRequest?: (args: {
    connectorKind: null | ConnectorKind
    method: string
    args: RequestArgument[]
  }) => unknown
  onConnectorWindowClosed?: (
    msg: MessageToClientEvent<ConnectorKind>,
  ) => ErrorResponse
  initChannelData?: InitChannelData
}

// This sets up a connection from the dapp script to the nufi script.
// Note that the connection is only actually built up on the first request.
// When a method is called, a request is sent, and a promise is returned. This
// promise will be resolved whenever a response to the request arrives.
export const setupClientChannel = <ConnectorKind extends UntypedConnectorKind>({
  appId,
  connectorPlatform,
  currentContext,
  targetContext,
  eventHandler,
  onConnectorWindowClosed,
  sendPortPostMessage,
  onBeforeFirstSend,
  onBeforeRequest,
  initChannelData,
}: SetupClientChannelParams<ConnectorKind>) => {
  logger.debug('"setupClientChannel"')
  const {
    // to be called by the listener waiting for the channel to respond
    setChannelReady,
    channelReady,
  } = (() => {
    let _setChannelReady: (value: unknown) => void

    const channelReady = new Promise((resolve) => {
      _setChannelReady = resolve
    })

    return {
      channelReady,
      setChannelReady: () => {
        logger.debug('"setupClientChannel" setting channel ready')
        _setChannelReady(true)
      },
    }
  })()

  // Note that it is important that the logic of this function stays synchronous,
  // as some dappConnectors (extension) relies on it.
  if (onBeforeFirstSend != null) {
    logger.debug('"setupClientChannel" calling onBeforeFirstSend')
    onBeforeFirstSend().then(() => {
      logger.debug('"onBeforeFirstSend" finished')
      setChannelReady()
    })
  } else {
    setChannelReady()
  }

  const activeRequests = new Map<
    string,
    {resolve: (_: SuccessResponse) => void; reject: (_: ErrorResponse) => void}
  >()

  const getPort = cachedGetPort(() => {
    logger.debug('"setupClientChannel" calling cachedGetPort')
    const channel = new MessageChannel()
    const initChannelMessage: InitChannelMessage = {
      appId,
      connectorPlatform,
      method: 'initChannel',
      data: initChannelData,
    }
    // Note that even if port message is being sent sooner than this call is processed,
    // the listener on the other end will anyway receive the messages.
    sendPortPostMessage(initChannelMessage, [channel.port2])
    channel.port1.onmessage = (
      e: MessageEvent<MessageToClient<ConnectorKind>>,
    ) => {
      // We are only checking message structure here, not the origin,
      // as this code anyways runs in untrusted environment.
      const msg = e.data

      if (!messageDirectionMatches(msg, targetContext, currentContext)) return

      logger.debug('"setupClientChannel" received port message', msg)

      switch (msg.type) {
        case 'response': {
          const {id, result} = msg
          const msgPromiseCallbacks = activeRequests.get(id)
          if (msgPromiseCallbacks) {
            activeRequests.delete(id)
            if (result.kind === 'success')
              msgPromiseCallbacks.resolve(result.value)
            else msgPromiseCallbacks.reject(result.value)
          }
          break
        }
        case 'event':
          // "stray" events related to connections managed from other frames may arrive
          // and we just want to ignore them as they are not related to "our" frame
          if (msg.targetOrigin !== window.location.origin) return

          if (msg.method === 'connectorWindowClosed') {
            const errorResponse = (() => {
              if (onConnectorWindowClosed != null) {
                return onConnectorWindowClosed(msg)
              }
              return 'Connector window was closed' as unknown as ErrorResponse
            })()

            // Connector window closed, reject all requests in progress.
            activeRequests.forEach(({reject}) => reject(errorResponse))
            activeRequests.clear()
          }
          eventHandler(msg.connectorKind, msg.method, msg.args)
          break
        default:
          safeAssertUnreachable(msg)
      }
    }
    return channel.port1
  })
  return async (
    connectorKind: null | ConnectorKind,
    method: string,
    args: RequestArgument[],
  ) => {
    const priorityTimestamp = new Date().toISOString()
    logger.debug('"setupClientChannel" calling API', {
      connectorKind,
      method,
      args,
    })

    // this ensures that messages don't collide even if we inject the
    // connector objects into multiple (i)frames within the same page (i.e. tab)
    const id = getRandomUUID()
    const request: RequestMessage<ConnectorKind> = {
      senderContext: currentContext,
      targetContext,
      id,
      connectorKind,
      method,
      args,
      priorityTimestamp,
    }

    onBeforeRequest?.({connectorKind, method, args})

    await channelReady

    logger.debug('"setupClientChannel" posting port message', request)

    getPort().postMessage(request)
    return new Promise<SuccessResponse>((resolve, reject) =>
      activeRequests.set(id, {resolve, reject}),
    )
  }
}
