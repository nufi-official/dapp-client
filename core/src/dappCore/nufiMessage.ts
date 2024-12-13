import type {
  ConnectorPlatform,
  MessageHeader,
  NufiMessage,
  ScriptContext,
} from './types'

export const messageDirectionMatches = (
  msg: MessageHeader,
  senderContext: ScriptContext,
  targetContext: ScriptContext,
) => msg.targetContext === targetContext && msg.senderContext === senderContext

export const isNufiMessage = (
  e: MessageEvent<unknown>,
  expectedConnectorPlatform: ConnectorPlatform,
): e is MessageEvent<NufiMessage> => {
  const _e = e as MessageEvent<NufiMessage>
  return Boolean(
    _e?.data?.appId === 'nufi' &&
      _e?.data?.connectorPlatform === expectedConnectorPlatform,
  )
}
