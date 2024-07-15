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
import {ensureCatalystVotingPurpose, supportedVotingPurposes} from './utils'

export * from './utils'

const connectorKind = 'cardano'

type CardanoSpecificDappConnectorConfig = {
  cardano: {
    isCip62Enabled: boolean
    isCip95Enabled: boolean
  }
}

/* The static configuration is determined at compile time, and must not change
 * afterwards.  */
export type CardanoDappConnectorConfig = {
  appId: string
  connectorPlatform: ConnectorPlatform
  name: string
  icons: {
    default: string
  }
  connectors: CardanoSpecificDappConnectorConfig
}

export const API_VERSION = '1.1.0'

export const createInjectedConnectorFactory =
  (options: {
    getIsEnabled: (client: MessagingClient) => () => Promise<boolean>
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

    // CIP-0062
    const cip62ApiObject = {
      ...cip30ApiObject,
      ...createProxyMethods([
        'signVotes',
        'getVotingCredentials',
        'submitDelegation',
      ]),
      getVotingPurposes: async () => supportedVotingPurposes,
    }

    // CIP-0095
    const cip95ApiObject = {
      ...createProxyMethods([
        'getPubDRepKey',
        'getRegisteredPubStakeKeys',
        'getUnregisteredPubStakeKeys',
      ]),
    }

    const isCip62Enabled = config.connectors.cardano.isCip62Enabled
    const isCip95Enabled = config.connectors.cardano.isCip95Enabled

    const connectorObject = {
      enable: async () => {
        if (!client.isConnectorWindowOpen()) {
          await client.openConnectorWindow()
        }
        await client.proxy.enable() // This will throw on failure
        return {
          ...cip30ApiObject,
          ...(isCip95Enabled ? {cip95: cip95ApiObject} : {}),
        }
      },
      isEnabled: options.getIsEnabled(client),
      ...(isCip62Enabled
        ? {
            catalyst: {
              apiVersion: '0.1.0',
              enable: async (purposes: number[]) => {
                ensureCatalystVotingPurpose(purposes)
                if (!client.isConnectorWindowOpen())
                  await client.openConnectorWindow()
                await client.proxy.enable() // This will throw on failure
                return cip62ApiObject
              },
            },
          }
        : {}),
      apiVersion: API_VERSION,
      name: config.name,
      icon: config.icons.default,
      supportedExtensions: [
        ...(isCip62Enabled ? [{cip: 62}] : []),
        ...(isCip95Enabled ? [{cip: 95}] : []),
      ],
    } as unknown as ConnectorObject

    return {
      connectorKind,
      type: 'withOverrides',
      inject: (window, walletOverrides) => {
        // We are not using `setIfDoesNotExist` here as in case of Widget
        // we are expecting reassignments (due to messaging port recreation).
        set(
          window,
          [connectorKind, objKeyByConnectorPlatform[config.connectorPlatform]],
          connectorObject,
        )
        if (walletOverrides?.flint) {
          setIfDoesNotExist(window, [connectorKind, 'flint'], {
            ...connectorObject,
            name: 'Flint Wallet',
            icon: emulatedWalletIcons.flint,
          })
        }
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
