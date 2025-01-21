import type {
  ConnectorPlatform,
  LoginType,
  BlockchainSdkOptions,
  LoginInfo,
  PublicCoreSdk,
  InitChannelData,
} from '@nufi/dapp-client-core'
import {isSupportedWeb3AuthProvider} from '@nufi/dapp-client-core'

import type {CardanoDappConnectorConfig} from './connector'
import {createInjectedConnectorFactory} from './connector'
import {nufiIcon, nufiMetamaskIcon} from './icons'
import {getCardanoSdkInfo, sdkInfoReporter} from './sdkInfo'

export * from './connector'

type GetDappConfigParams = {
  loginType: LoginType
}

const loginTypeProps = {
  metamask: {
    icon: nufiMetamaskIcon,
    connectorPlatform: 'snap',
    name: 'Cardano Wallet',
  },
  web3Auth: {
    icon: nufiIcon,
    connectorPlatform: 'sso',
    name: 'NuFiConnect',
  },
} as const

const getDappConnectorsConfig = ({
  loginType,
}: GetDappConfigParams): CardanoDappConnectorConfig => {
  const {icon, connectorPlatform, name} = loginTypeProps[loginType]

  return {
    appId: 'nufi',
    connectorPlatform,
    icons: {
      default: icon,
    },
    name,
    connectors: {
      cardano: {
        isCip62Enabled: false,
      },
    },
  }
}

export type CardanoFeaturedToken = {
  assetNameHex: string
  policyIdHex: string
}

export const initNufiDappCardanoSdk = (
  sdk: PublicCoreSdk,
  type: Extract<ConnectorPlatform, 'sso' | 'snap'>,
  options?: BlockchainSdkOptions<CardanoFeaturedToken>,
) => {
  sdk.__logger.debug('"initNufiDappCardanoSdk')
  const {ensureWidgetEmbeddedInIframe, ensureChannelIsReady, injectConnectors} =
    sdk.__getContext()

  const loginType = (
    {
      sso: 'web3Auth',
      snap: 'metamask',
    } as const
  )[type]

  if (
    options?.provider != null &&
    !isSupportedWeb3AuthProvider(options?.provider)
  ) {
    throw new Error('Unsupported web3Auth provider.')
  }

  const encodedFeaturedTokens = (() => {
    if (!options?.featuredTokens) return ''

    const featuredTokens = options.featuredTokens
    const tokens = featuredTokens.map((t) => t.policyIdHex + t.assetNameHex)
    return encodeURIComponent(JSON.stringify(tokens))
  })()

  const loginInfo: LoginInfo = {
    loginType,
    ...(type === 'sso' && options?.provider
      ? {provider: options.provider}
      : {}),
    ...(encodedFeaturedTokens ? {featuredTokens: encodedFeaturedTokens} : {}),
  }

  const queryString = new URLSearchParams({
    blockchain: 'cardano',
    ...loginInfo,
  }).toString()

  const {
    sendPortPostMessage,
    sendSimplePostMessage,
    showWidget,
    getWidgetVisibilityStatus,
    iframeDidRefresh,
  } = ensureWidgetEmbeddedInIframe({
    type: 'updateQueryString',
    query: `?${queryString}`,
  })

  const config = getDappConnectorsConfig({
    loginType,
  })

  if (iframeDidRefresh) {
    const initChannelData: InitChannelData = {
      type: 'widget',
      data: {
        connectorKind: 'cardano',
        connectorPlatform: config.connectorPlatform,
      },
    }

    injectConnectors({
      connectorsToInject: {
        cardano: createInjectedConnectorFactory({
          beforeEnable: async (client) => {
            if (!client.isConnected()) {
              // As in the current state we can not assign the same `priorityTimestamp` to
              // both `connect` and `enable`, we are not awaiting
              // `connect` which does not have to be awaited in case of the widget
              client.connect()
            }
          },
        }),
      },
      config,
      currentContext: 'sdk',
      targetContext: 'widget',
      sendPortPostMessage,
      onBeforeFirstSend: async () => {
        sdk.__logger.debug(
          '"initNufiDappCardanoSdk: onBeforeRequest" onBeforeFirstSend',
        )
        await ensureChannelIsReady(
          config.appId,
          config.connectorPlatform,
          'cardano',
          sendSimplePostMessage,
        )

        sdkInfoReporter.tryReportingOnce(sendSimplePostMessage, [
          sdk.__getSdkInfo(),
          getCardanoSdkInfo(),
        ])
      },
      // As dapp developers have to be aware of integrating NuFi, wallet
      // overrides do not make much sense
      overridableWallets: [],
      onBeforeRequest: ({connectorKind, method}) => {
        sdk.__logger.debug('"initNufiDappCardanoSdk: onBeforeRequest"', {
          connectorKind,
          method,
        })
        if (connectorKind !== 'cardano') return
        if (getWidgetVisibilityStatus() === 'hidden' && method === 'connect') {
          sdk.__logger.debug(
            '"initNufiDappCardanoSdk: onBeforeRequest" showWidget',
          )
          showWidget('closed')
        }
      },
      initChannelData,
    })
  }
}
