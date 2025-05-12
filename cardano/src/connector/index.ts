import {
  setIfDoesNotExist,
  set,
  objKeyByConnectorPlatform,
} from '@nufi/dapp-client-core'
import type {
  ConnectorObject,
  InjectedConnectorFactory,
  ConnectorPlatform,
  MessagingClient,
} from '@nufi/dapp-client-core'

import {emulatedWalletIcons} from './emulatedWalletIcons'

export * from './utils'

const connectorKind = 'cardano'

/* The static configuration is determined at compile time, and must not change
 * afterwards.  */
export type CardanoDappConnectorConfig = {
  appId: string
  connectorPlatform: ConnectorPlatform
  name: string
  icons: {
    default: string
  }
  connectors: {
    cardano: Record<PropertyKey, never>
  }
}

export const API_VERSION = '1.1.0'

export const createInjectedConnectorFactory =
  (options?: {
    beforeEnable?: (client: MessagingClient) => Promise<void>
  }): InjectedConnectorFactory<CardanoDappConnectorConfig> =>
  (client, config) => {
    const createProxyMethods = (methods: string[]) =>
      Object.fromEntries(
        methods.map((method) => [method, client.proxy[method]]),
      )

    // CIP-0030
    const cip30ApiObject = {
      ...createProxyMethods([
        'getExtensions',
        'getNetworkId',
        'getUtxos',
        'getBalance',
        'getUsedAddresses',
        'getUnusedAddresses',
        'getChangeAddress',
        'getRewardAddresses',
        'signTx',
        'signData',
        'submitTx',
        'getCollateral',
      ]),
      experimental: {
        getCollateral: client.proxy.getCollateral,
      },
    }
    // CIP-0095
    const cip95ApiObject = {
      ...createProxyMethods([
        'signData',
        'getPubDRepKey',
        'getRegisteredPubStakeKeys',
        'getUnregisteredPubStakeKeys',
      ]),
    }

    const connectorObject = {
      enable: async () => {
        await options?.beforeEnable?.(client)

        await client.proxy.enable() // This will throw on failure
        return {
          ...cip30ApiObject,
          cip95: cip95ApiObject,
        }
      },
      isEnabled: async () => await client.proxy.isEnabled(),
      apiVersion: API_VERSION,
      name: config.name,
      icon: config.icons.default,
      supportedExtensions: [{cip: 95}],
    } as unknown as ConnectorObject

    return {
      connectorKind,
      type: 'withOverrides',
      inject: (window) => {
        // We are not using `setIfDoesNotExist` here as in case of Widget
        // we are expecting reassignments (due to messaging port recreation).
        set(
          window,
          [connectorKind, objKeyByConnectorPlatform[config.connectorPlatform]],
          connectorObject,
        )
      },
      injectOverrides: (window, walletOverrides) => {
        if (walletOverrides?.eternl) {
          const eternlConnector = {
            ...connectorObject,
            name: 'eternl',
            icon: emulatedWalletIcons.eternl,
            experimental: {
              // without this, e.g. jpg.store fails to recognize eternl wallet
              appVersion: {major: 1, minor: 9, patch: 5},
              enableLogs: () => {
                /* empty */
              },
            },
          }
          setIfDoesNotExist(window, [connectorKind, 'eternl'], eternlConnector)
        }
      },
      async eventHandler(method) {
        if (method === 'connectorWindowClosed') {
          // Unfortunately, CIP-30 does not make it possible to signal a
          // disconnect to the dapp. We will just have to ignore this.
        }
      },
    }
  }
