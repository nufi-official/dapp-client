// Example: `setIfDoesNotExist(into, ['a', 's', 'd'], what)` is the same as
// `into.a.s.d = what`, except that all intermediate objects are created if
// they don't already exists, and `d` also must not already exists.

import {logger} from './core/logging'
import type {
  MessageHeader,
  ConnectorPlatform,
  PingChannelMessage,
  ScriptContext,
  UntypedConnectorKind,
} from './core/types'
import {isNufiMessage} from './publicUtils'

export {isNufiMessage, isNufiWidgetManagementMessage} from './core/utils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const setIfDoesNotExist = <U>(into: any, path: string[], what: U) => {
  for (const [i, segment] of path.entries()) {
    if (!Object.hasOwn(into, segment)) {
      into[segment] = i < path.length - 1 ? {} : what
    }
    into = into[segment]
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const set = <U>(into: any, path: string[], what: U) => {
  for (const [i, segment] of path.entries()) {
    if (i === path.length - 1) {
      into[segment] = what
    } else if (!Object.hasOwn(into, segment)) {
      into[segment] = {}
    }
    into = into[segment]
  }
}

export const messageDirectionMatches = (
  msg: MessageHeader,
  senderContext: ScriptContext,
  targetContext: ScriptContext,
) => msg.targetContext === targetContext && msg.senderContext === senderContext

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

export const objKeyByConnectorPlatform: Record<ConnectorPlatform, string> = {
  extension: 'nufi',
  snap: 'nufiSnap',
  sso: 'nufiSSO',
}

export const safeReplyToEvent = (
  e: MessageEvent<unknown>,
  message: unknown,
) => {
  e.source?.postMessage(message, {targetOrigin: e.origin})
}

export {getRandomUUID} from './core/utils'
