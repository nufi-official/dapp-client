import {isNufiMessage} from '../dappCore/nufiMessage'
import type {
  ConnectorPlatform,
  PingChannelMessage,
  UntypedConnectorKind,
} from '../dappCore/types'
import {logger} from '../utils/logging'

// Note that storing all previous "interval and handlers" and knowing which
// to invalidate/remove would be complex. Therefore we always keep only the
// last one.
// Note that this means that if user called `ensureChannelIsReady` multiple times,
// only the last call would eventually resolve.
// This should not be an issue as we are preventing re-injection of `injectConnectors`
// when the session is not meant to change.
let channelReadyGlobals: {
  interval: NodeJS.Timeout
  handler: (e: MessageEvent<unknown>) => unknown
} | null = null

export const ensureChannelIsReady = (
  appId: string,
  connectorPlatform: ConnectorPlatform,
  connectorKind: UntypedConnectorKind,
  sendPostMessage: (message: unknown) => void,
) => {
  const channelPingMessage: PingChannelMessage = {
    connectorPlatform,
    appId,
    method: 'channelPing',
    data: {
      connectorKind,
      connectorPlatform,
    },
  }

  return new Promise((resolve) => {
    const channelReadyHandler = (e: MessageEvent<unknown>) => {
      // We are only checking message structure here, not the origin,
      // as this code anyways runs in untrusted environment.
      if (!isNufiMessage(e, connectorPlatform)) return
      const _e = e as MessageEvent<PingChannelMessage>
      if (_e.data.method === 'channelPing') {
        logger.debug('"ensureChannelIsReady": received ping response')

        // Note that it is safe to clear interval and listener as each time when
        // calling `ensureChannelIsReady`, old interval and lister are cleared.
        // Therefore these must be the values associated with the same `ensureChannelIsReady` call.
        if (channelReadyGlobals != null) {
          clearInterval(channelReadyGlobals.interval)
          window.removeEventListener('message', channelReadyGlobals.handler)
          channelReadyGlobals = null
        }
        resolve(true)
      }
    }

    // When calling `ensureChannelIsReady` multiple times in a row, we want to ensure that
    // interval and listener from previous calls are cleared.
    // We can be certain that the handler is not called in the meantime as this function is sync.
    if (channelReadyGlobals != null) {
      clearInterval(channelReadyGlobals.interval)
      window.removeEventListener('message', channelReadyGlobals.handler)
    }

    channelReadyGlobals = {
      // Ping until we can safely establish port connection. Note that it must be registered into
      // global immediately after creation to avoid "stale" timeouts.
      interval: setInterval(() => {
        logger.debug('"ensureChannelIsReady": sending ping request')
        sendPostMessage(channelPingMessage)
      }, 500),
      handler: channelReadyHandler,
    }
    // Only register once we stored the callback in global variable.
    window.addEventListener('message', channelReadyGlobals.handler)
  })
}

export type EnsureChannelIsReady = typeof ensureChannelIsReady
