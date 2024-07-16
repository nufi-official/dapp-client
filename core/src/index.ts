import detectEthereumProvider from '@metamask/detect-provider'

import type {InjectConnectors} from './core/injectConnectors'
import {injectConnectors} from './core/injectConnectors'
import {logger, setLogLevel} from './core/logging'
import type {EnsureChannelIsReady} from './publicUtils'
import {ensureChannelIsReady} from './publicUtils'
import {getCoreSdkInfo} from './sdkInfo'
import type {EnsureWidgetEmbeddedInIframe, IFrameOptions} from './widget'
import {CORE_SDK_NOT_INITIALIZED, ensureWidgetEmbeddedInIframe} from './widget'
import {registerWidgetApiEvents} from './widget/apiEvents'
import type {SocialLoginInfo} from './widget/socialLoginInfo'
import {
  exposeSocialLoginInfo,
  onSocialLoginInfoChanged,
} from './widget/socialLoginInfo'
import type {SignOutWidgetMessage} from './widget/types'

export {SdkInfoItem, SdkInfoMessage, getSdkInfoReporter} from './sdkInfo'
export {injectConnectors} from './core/injectConnectors'
export {
  ensureWidgetEmbeddedInIframe,
  EnsureWidgetEmbeddedInIframe,
  CORE_SDK_NOT_INITIALIZED,
} from './widget'
export * from './core/types'
export * from './publicUtils'
export * from './widget/types'
export * from './widget/web3AuthProviders'
export type {
  SocialLoginInfoChangedMessage,
  SocialLoginInfo,
} from './widget/socialLoginInfo'

let initResult: {
  hideWidget: () => void
  sendSimplePostMessage: (message: unknown) => void
} | null = null

const init = (
  origin = 'https://wallet.nu.fi',
  iframeOptions?: IFrameOptions,
): typeof initResult => {
  const {hideWidget, sendSimplePostMessage} = ensureWidgetEmbeddedInIframe({
    type: 'prefetch',
    baseUrl: `${origin}/widget`,
    iframeOptions,
  })

  registerWidgetApiEvents(origin)

  return {
    hideWidget,
    sendSimplePostMessage,
  }
}

type Api = {
  hideWidget: () => void
  onSocialLoginInfoChanged: (
    cb: (data: SocialLoginInfo | null) => unknown,
  ) => SocialLoginInfo | null
  getSocialLoginInfo: typeof exposeSocialLoginInfo
  signOut: () => void
  isMetamaskInstalled: () => Promise<boolean>
}

const signOutMessage: SignOutWidgetMessage = {
  appId: 'nufi',
  method: 'signOut',
}

const getApi = (): Api => {
  if (initResult == null) {
    throw new Error(CORE_SDK_NOT_INITIALIZED)
  }
  const {hideWidget, sendSimplePostMessage} = initResult

  return {
    getSocialLoginInfo: exposeSocialLoginInfo,
    hideWidget,
    onSocialLoginInfoChanged,
    signOut: () => sendSimplePostMessage(signOutMessage),
    isMetamaskInstalled,
  }
}

// Functions/Classes that depend on local state must be passed as a context
// as there might be mismatch of core SDK lib versions between dapp and blockchain specific
// versions of SDK.
type CoreDappSdkContext = {
  ensureWidgetEmbeddedInIframe: EnsureWidgetEmbeddedInIframe
  ensureChannelIsReady: EnsureChannelIsReady
  injectConnectors: InjectConnectors
}

const getContext = (): CoreDappSdkContext => {
  if (initResult == null) {
    throw new Error(CORE_SDK_NOT_INITIALIZED)
  }
  return {
    ensureWidgetEmbeddedInIframe,
    ensureChannelIsReady,
    injectConnectors,
  }
}

const isMetamaskInstalled = async () => {
  try {
    const provider = await detectEthereumProvider({mustBeMetaMask: true})
    if (!provider) return false

    // Note that:
    // -> We are not reusing @nufi/metamask-snap to avoid public packages being
    // interconnected with our non-public packages.
    // -> Even if our snap is installed, this returns empty result, because the dapp
    // calls it from its domain, and the snap installation is bound to NuFi domain.
    // See https://docs.metamask.io/wallet/reference/wallet_getsnaps
    // -> We expect this calls to not be implemented by the majority of wallets emulating
    // metamask, and this call to throw, though we can not guarantee that.
    await (
      provider as unknown as {
        request: (params: {
          method: 'wallet_getSnaps'
        }) => Promise<Record<string, unknown>>
      }
    ).request({
      method: 'wallet_getSnaps',
    })
    return true
  } catch (err) {
    return false
  }
}

export type PublicCoreSdk = {
  __getContext: () => CoreDappSdkContext
  __setLogLevel: typeof setLogLevel
  __logger: typeof logger
  __getSdkInfo: typeof getCoreSdkInfo
  getApi: () => Api
  init: (origin?: string) => void
}

const publicNufiCoreSdk = {
  __getContext: getContext,
  __setLogLevel: setLogLevel,
  __logger: logger,
  __getSdkInfo: getCoreSdkInfo,
  getApi,
  init: (origin?: string, iframeOptions?: IFrameOptions) => {
    initResult = init(origin, iframeOptions)
  },
}

export default publicNufiCoreSdk