import {logger} from './logging'
import {sendRequestProxy} from './sendRequestProxy'
import {setupClientChannel} from './setupClientChannel'
import type {
  UntypedConnectorKind,
  InjectedConnector,
  EventHandler,
  MessagingClient,
  ServiceEvent,
  WalletOverrides,
  ScriptContext,
  InjectedConnectorFactory,
  DappConnectorsConfig,
  ErrorResponse,
  MessageToClientEvent,
  InjectedConnectorWithOverrides,
  SimpleInjectedConnector,
  RequestArgument,
  InitChannelData,
} from './types'
import {hardenUnreliableRequest} from './utils'

export type CreateConnectorsParams<
  Config extends DappConnectorsConfig,
  ConnectorKind extends UntypedConnectorKind,
> = {
  connectorsToInject: Record<
    UntypedConnectorKind,
    InjectedConnectorFactory<Config>
  >
  config: Config
  currentContext: ScriptContext
  targetContext: ScriptContext
  sendPortPostMessage: (message: unknown, transfer: Transferable[]) => void
  overridableWallets: ReadonlyArray<string>
  onConnectorWindowClosed?: (
    msg: MessageToClientEvent<ConnectorKind>,
  ) => ErrorResponse
  onBeforeFirstSend?: () => Promise<void>
  onBeforeRequest?: (args: {
    connectorKind: null | ConnectorKind
    method: string
    args: RequestArgument[]
  }) => unknown
  initChannelData?: InitChannelData
}

function createConnectors<
  Config extends DappConnectorsConfig,
  ConnectorKind extends UntypedConnectorKind,
>({
  connectorsToInject,
  config,
  currentContext,
  targetContext,
  sendPortPostMessage,
  onBeforeFirstSend,
  onBeforeRequest,
  overridableWallets,
  initChannelData,
}: CreateConnectorsParams<Config, ConnectorKind>): [
  InjectedConnector[],
  (() => Promise<WalletOverrides>) | null,
] {
  logger.debug('"createConnectors"')
  const connectors: InjectedConnector[] = []

  const eventHandlers = new Map<ConnectorKind, EventHandler>()
  const multiplexedHandler = setupClientChannel<ConnectorKind>({
    connectorPlatform: config.connectorPlatform,
    appId: config.appId,
    onBeforeRequest,
    onBeforeFirstSend,
    currentContext,
    targetContext,
    eventHandler: async (connectorKind, method, args) => {
      const eventHandler = eventHandlers.get(connectorKind)
      if (eventHandler) {
        await eventHandler(method as ServiceEvent, args)
      }
    },
    sendPortPostMessage,
    initChannelData,
  })

  const getWalletOverridesRequest = async () =>
    (await multiplexedHandler(
      null,
      'getWalletOverrides',
      [],
    )) as unknown as WalletOverrides

  // The "getWalletOverrides" call invoked as the very first call to the service worker is not 100% reliable,
  // so we need to harden it. As far as we tried, the service worker seems to not always wake up
  // fast enough for the request to go through on the first try (not sure if that's a bug in Chrome).
  // Happened especially when opening a dapp right after opening the browser.
  // https://stackoverflow.com/questions/69816133/mv3-serviceworker-wont-wake-up-when-sent-a-message-from-the-contentscript
  const getWalletOverrides =
    overridableWallets.length > 0
      ? () =>
          hardenUnreliableRequest(
            getWalletOverridesRequest,
            Object.fromEntries(
              overridableWallets.map((w) => [w, false]),
            ) as WalletOverrides,
          )
      : null

  for (const connectorKind of Object.keys(
    config.connectors,
  ) as ConnectorKind[]) {
    try {
      const sendRequest = multiplexedHandler.bind(undefined, connectorKind)
      const proxy = sendRequestProxy(sendRequest)

      let connectorWindowOpen = false
      const client: MessagingClient = {
        sendRequest,
        proxy,
        openConnectorWindow: async (meta) => {
          logger.debug('"createConnectors": openConnectorWindow called')
          await proxy.openConnectorWindow(meta)
          connectorWindowOpen = true
          logger.debug('"createConnectors": openConnectorWindow finished')
        },
        closeConnectorWindow: async () => {
          logger.debug('"createConnectors": closeConnectorWindow called')
          await proxy.closeConnectorWindow()
          connectorWindowOpen = false
          logger.debug('"createConnectors": closeConnectorWindow finished')
        },
        // Original method used by connectors that have to be closed after Dapp refresh.
        // Consider migrating other connectors to `isConnectorWindowOpenAsync`.
        isConnectorWindowOpen: () => {
          logger.debug(
            `"createConnectors": isConnectorWindowOpen ${connectorWindowOpen}`,
          )
          return connectorWindowOpen
        },
        isConnectorWindowOpenAsync: async () => {
          try {
            logger.debug(
              `"createConnectors": isConnectorWindowOpenAsync called`,
            )
            const res = await proxy.isConnectorWindowOpen()
            logger.debug(
              `"createConnectors": isConnectorWindowOpenAsync result ${res}`,
            )
            return res
          } catch (err) {
            // If connector window is not open we are not allowed to proxy
            // events to it so this will fail. In such case all we can do
            // is to consider the window closed.
            logger.debug('"createConnectors": isConnectorWindowOpenAsync error')
            return false
          }
        },
      }

      const connector = connectorsToInject[connectorKind](client, config)
      if (connector) {
        const eventHandler: EventHandler = async (method, args) => {
          if (method === 'connectorWindowClosed') {
            connectorWindowOpen = false
          }
          await connector.eventHandler(method, args)
        }
        eventHandlers.set(connectorKind, eventHandler)

        connectors.push(connector)
      }
    } catch (e) {
      // We will continue with the other connectors even if one of them fails.
      // eslint-disable-next-line no-console
      console.error(e)
    }
  }
  return [connectors, getWalletOverrides]
}

/**
 * Initialize already created connectors in a race-condition safe order.
 *
 * Note that declaring this function "async" causes race-conditions
 * with content script and page script, as the content script is no
 * longer guaranteed to end before the page script is executed.
 * This is mainly issue in the EVM ecosystem.
 *
 * Therefore we:
 * 1. Sort connectors, so that the ones with simple "inject" without any
 * asynchronous dependencies comes first.
 * 2. Inject connectors with synchronous "inject" without calling "await", so
 * that these functions are guaranteed to run before page load (even though the
 * function is "async", but no "await" was called until this point).
 * 3. Inject the remaining connectors after doing async logic (e.g. fetching wallet overrides).
 */
const initializeConnectors = async (
  _connectors: InjectedConnector[],
  getWalletOverrides: (() => Promise<WalletOverrides>) | null,
) => {
  const simpleConnectorsToInit = _connectors.filter(
    (c) => c.type === 'simple',
  ) as SimpleInjectedConnector[]

  for (const connector of simpleConnectorsToInit) {
    try {
      logger.debug(
        `"createConnectors": ${connector.connectorKind} initialization start`,
      )
      connector.inject(window)
      logger.debug(
        `"createConnectors": ${connector.connectorKind} initialization finished`,
      )
    } catch (e) {
      // We will continue with the other connectors even if one of them fails.
      // eslint-disable-next-line no-console
      console.error(e)
    }
  }

  const connectorsWithOverridesToInit = _connectors.filter(
    (c) => c.type === 'withOverrides',
  ) as InjectedConnectorWithOverrides[]
  const walletOverrides = getWalletOverrides ? await getWalletOverrides() : null

  for (const connector of connectorsWithOverridesToInit) {
    try {
      connector.inject(window, walletOverrides)
    } catch (e) {
      // We will continue with the other connectors even if one of them fails.
      // eslint-disable-next-line no-console
      console.error(e)
    }
  }
}

export async function injectConnectors<
  Config extends DappConnectorsConfig,
  ConnectorKind extends UntypedConnectorKind,
>(params: CreateConnectorsParams<Config, ConnectorKind>) {
  const [connectorsToInitialize, getWalletOverrides] = createConnectors(params)

  // Be mindful with `await` in this file! See `initializeConnectors` explanation of how
  // it is safe to use it when initializing connectors.
  await initializeConnectors(connectorsToInitialize, getWalletOverrides)
}

export type InjectConnectors = typeof injectConnectors
