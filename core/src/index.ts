import type {InjectConnectors} from './dappCore/injectConnectors'
import {injectConnectors} from './dappCore/injectConnectors'
import type {EnsureChannelIsReady} from './sdkCore/ensureChannelReady'
import {ensureChannelIsReady} from './sdkCore/ensureChannelReady'
import {isMetamaskInstalled} from './sdkCore/metamask'
import {getCoreSdkInfo} from './sdkCore/sdkInfo'
import {logger, setLogLevel} from './utils/logging'
import {CORE_SDK_NOT_INITIALIZED} from './widget'
import type {
  GetWidgetVisibilityStatus,
  IFrameOptions,
  ShowWidget,
  SignOutWidgetMessage,
  SocialLoginInfo,
} from './widget'
import {registerWidgetApiEvents} from './widget/events'
import type {EnsureWidgetEmbeddedInIframe} from './widget/init'
import {
  ensureWidgetEmbeddedInIframe,
  widgetManagementReadyPromise,
} from './widget/init'
import {
  exposeSocialLoginInfo,
  onSocialLoginInfoChanged,
} from './widget/socialLoginInfo'

export * from './utils/events'
export * from './dappCore'
export * from './sdkCore'
export * from './widget'

let initResult: {
  hideWidget: () => void
  showWidget: ShowWidget
  sendSimplePostMessage: (message: unknown) => void
  getWidgetVisibilityStatus: GetWidgetVisibilityStatus
} | null = null

const init = (
  origin = 'https://wallet.nu.fi',
  iframeOptions?: IFrameOptions,
): typeof initResult => {
  const {
    hideWidget,
    showWidget,
    sendSimplePostMessage,
    getWidgetVisibilityStatus,
  } = ensureWidgetEmbeddedInIframe({
    type: 'prefetch',
    baseUrl: `${origin}/widget/`,
    iframeOptions,
  })

  registerWidgetApiEvents(origin)

  return {
    hideWidget,
    showWidget,
    sendSimplePostMessage,
    getWidgetVisibilityStatus,
  }
}

type Api = {
  hideWidget: () => void
  showWidget: ShowWidget
  getWidgetVisibilityStatus: GetWidgetVisibilityStatus
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
  const {
    hideWidget,
    showWidget,
    sendSimplePostMessage,
    getWidgetVisibilityStatus,
  } = initResult

  return {
    getSocialLoginInfo: exposeSocialLoginInfo,
    hideWidget,
    showWidget,
    getWidgetVisibilityStatus,
    onSocialLoginInfoChanged,
    signOut: () => sendSimplePostMessage(signOutMessage),
    isMetamaskInstalled,
  }
}

type WidgetApi = Pick<
  Api,
  'showWidget' | 'hideWidget' | 'getWidgetVisibilityStatus' | 'signOut'
>

const getWidgetApi = async (): Promise<WidgetApi> => {
  if (initResult == null) {
    throw new Error(CORE_SDK_NOT_INITIALIZED)
  }

  await widgetManagementReadyPromise

  const {
    hideWidget,
    showWidget,
    getWidgetVisibilityStatus,
    sendSimplePostMessage,
  } = initResult

  return {
    hideWidget,
    showWidget,
    getWidgetVisibilityStatus,
    signOut: () => sendSimplePostMessage(signOutMessage),
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

export type PublicCoreSdk = {
  __getContext: () => CoreDappSdkContext
  __setLogLevel: typeof setLogLevel
  __logger: typeof logger
  __getSdkInfo: typeof getCoreSdkInfo
  /**
   * @deprecated
   * The following methods ('showWidget' | 'hideWidget' | 'getWidgetVisibilityStatus' | 'signOut')
   * are ignored if called when the widget is not yet initialized. We therefore suggest
   * using `getWidgetApi` and importing other methods from default export instead.
   */
  getApi: () => Api
  getWidgetApi: () => Promise<WidgetApi>
  init: (origin?: string, iframeOptions?: IFrameOptions) => void
  getSocialLoginInfo: Api['getSocialLoginInfo']
  onSocialLoginInfoChanged: Api['onSocialLoginInfoChanged']
  isMetamaskInstalled: Api['isMetamaskInstalled']
}

const publicNufiCoreSdk: PublicCoreSdk = {
  __getContext: getContext,
  __setLogLevel: setLogLevel,
  __logger: logger,
  __getSdkInfo: getCoreSdkInfo,
  getApi,
  getWidgetApi,
  init: (origin?: string, iframeOptions?: IFrameOptions) => {
    initResult = init(origin, iframeOptions)
  },
  onSocialLoginInfoChanged,
  getSocialLoginInfo: exposeSocialLoginInfo,
  isMetamaskInstalled,
}

export default publicNufiCoreSdk
