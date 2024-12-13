import type {Web3AuthProvider} from './providers'

export type Web3AuthLoginType = 'web3Auth'

export type Web3AuthLoginInfo = {
  loginType: Web3AuthLoginType
  provider?: Web3AuthProvider
}
