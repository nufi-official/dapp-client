import type {MetamaskLoginInfo, MetamaskLoginType} from './metamask/types'
import type {Web3AuthProvider} from './web3Auth/providers'
import type {Web3AuthLoginInfo, Web3AuthLoginType} from './web3Auth/types'

export type SdkOptions<TFeaturedToken = Record<string, unknown>> = {
  provider?: Web3AuthProvider
  origin?: string
  featuredTokens?: TFeaturedToken[]
}

export type BlockchainSdkOptions<TFeaturedToken = Record<string, unknown>> =
  Omit<SdkOptions<TFeaturedToken>, 'origin'>

export type LoginInfo = MetamaskLoginInfo | Web3AuthLoginInfo

export type LoginType = MetamaskLoginType | Web3AuthLoginType
