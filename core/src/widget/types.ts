import type {CoreNufiMessage} from '../core/types'

import type {Web3AuthProvider} from './web3AuthProviders'

export type HideWidgetMessage = CoreNufiMessage & {
  method: 'hideWidget'
}

export type ToggleWidgetMessage = CoreNufiMessage & {
  method: 'closeWidget' | 'openWidget'
}

export type CollapseWidgetMessage = CoreNufiMessage & {
  method: 'collapseWidget'
  // Added in SDK "0.2.1",
  priorityTimestamp: string
}

export type SignOutWidgetMessage = CoreNufiMessage & {
  method: 'signOut'
}

export type RefreshPageMessage = CoreNufiMessage & {
  method: 'refreshPage'
}

export type GetParentWindowDimensionsRequest = CoreNufiMessage & {
  method: 'getParentWindowDimensionsRequest'
}

export type GetParentWindowDimensionsResponse = CoreNufiMessage & {
  method: 'getParentWindowDimensionsResponse'
  dimensions: {width: number; height: number; left: number; top: number}
  iframeRect?: Omit<DOMRect, 'toJSON'>
}

export type WidgetManagementMessage =
  | HideWidgetMessage
  | ToggleWidgetMessage
  | CollapseWidgetMessage
  | RefreshPageMessage
  | GetParentWindowDimensionsRequest
  | GetParentWindowDimensionsResponse
  | SignOutWidgetMessage

export type SdkOptions = {provider?: Web3AuthProvider; origin?: string}

export type BlockchainSdkOptions = Omit<SdkOptions, 'origin'>

export type Web3AuthLoginInfo = {
  loginType: 'web3Auth'
  provider?: Web3AuthProvider
}

export type MetamaskLoginInfo = {
  loginType: 'metamask'
}

export type LoginInfo = MetamaskLoginInfo | Web3AuthLoginInfo

export type LoginType = 'metamask' | 'web3Auth'
