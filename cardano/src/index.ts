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
        isCip95Enabled: true,
      },
    },
  }
}

export const initNufiDappCardanoSdk = (
  sdk: PublicCoreSdk,
  type: Extract<ConnectorPlatform, 'sso' | 'snap'>,
  options?: BlockchainSdkOptions,
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

  const loginInfo: LoginInfo = {
    loginType,
    ...(type === 'sso' && options?.provider
      ? {provider: options.provider}
      : {}),
  }

  const queryString = new URLSearchParams({
    blockchain: 'cardano',
    ...loginInfo,
  }).toString()

  const {
    sendPortPostMessage,
    sendSimplePostMessage,
    showWidget,
    isWidgetHidden,
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
          // Note that we are not checking whether the connector window is open,
          // as we want the request to be redirected to widget in all cases.
          // That is so that the we can return `true` after user refreshes the page.
          getIsEnabled: (client) => async () => await client.proxy.isEnabled(),
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
        if (isWidgetHidden() && method === 'openConnectorWindow') {
          sdk.__logger.debug(
            '"initNufiDappCardanoSdk: onBeforeRequest" showWidget',
          )
          showWidget()
        }
      },
      initChannelData,
    })
  }
}
