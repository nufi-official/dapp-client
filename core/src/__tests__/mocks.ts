import type {CreateConnectorsParams} from '../core/injectConnectors'
import {injectConnectors} from '../core/injectConnectors'
import type {
  ConnectorObject,
  InjectedConnectorFactory,
  ConnectorPlatform,
  InitChannelData,
  DappConnectorsConfig,
  MessagingClient,
} from '../core/types'
import {objKeyByConnectorPlatform, set} from '../publicUtils'

export type CreateConnectorObject = (client: MessagingClient) => ConnectorObject

const getMockedConnectorToInject =
  (
    connectorKind: string,
    createConnectorObject: CreateConnectorObject,
  ): InjectedConnectorFactory<DappConnectorsConfig> =>
  (client, config) => {
    const connectorObject = createConnectorObject(client)

    return {
      connectorKind,
      type: 'simple',
      inject: (window) => {
        set(
          window,
          [connectorKind, objKeyByConnectorPlatform[config.connectorPlatform]],
          connectorObject,
        )
      },
      async eventHandler() {},
    }
  }

type OnBeforeRequest = CreateConnectorsParams<
  DappConnectorsConfig,
  string
>['onBeforeRequest']

type OnBeforeFirstSend = CreateConnectorsParams<
  DappConnectorsConfig,
  string
>['onBeforeFirstSend']

export const getMockedInjectConnectors = async ({
  connectorKind,
  createConnectorObject,
  sendPortPostMessage,
  initChannelData,
  connectorPlatform,
  onBeforeRequest,
  onBeforeFirstSend,
}: {
  connectorPlatform: ConnectorPlatform
  connectorKind: string
  createConnectorObject: CreateConnectorObject
  sendPortPostMessage: (message: unknown, transfer: Transferable[]) => void
  initChannelData?: InitChannelData
  onBeforeRequest?: OnBeforeRequest
  onBeforeFirstSend?: OnBeforeFirstSend
}) => {
  return injectConnectors({
    connectorsToInject: {
      [connectorKind]: getMockedConnectorToInject(
        connectorKind,
        createConnectorObject,
      ),
    },
    currentContext: 'sdk',
    targetContext: 'widget',
    overridableWallets: [],
    config: {
      appId: 'nufi',
      connectorPlatform,
      name: 'Nufi',
      icons: {
        default: '',
      },
      connectors: {
        [connectorKind]: null,
      },
    },
    sendPortPostMessage,
    onBeforeFirstSend,
    initChannelData,
    onBeforeRequest,
  })
}
