import type {CoreNufiMessage} from '../core/types'
import type {Web3AuthProvider} from './web3AuthProviders'

export type SocialLoginInfo = {
  email: string | null
  name: string | null
  profileImage: string | null
  typeOfLogin: Web3AuthProvider
} & Record<string, unknown>

export type SocialLoginInfoChangedMessage = CoreNufiMessage & {
  method: 'socialLoginInfoChanged'
  data: SocialLoginInfo | null
}

export type SocialLoginInfoListeners = {
  socialLoginInfoChanged?: (data: SocialLoginInfo | null) => unknown
}

const listeners: SocialLoginInfoListeners = {}

let socialLoginInfo: SocialLoginInfo | null = null

export const handleSocialLoginEvents = (e: MessageEvent<unknown>) => {
  const event = e.data as SocialLoginInfoChangedMessage
  if (event.method === 'socialLoginInfoChanged') {
    socialLoginInfo = event.data
    listeners[event.method]?.(event.data)
  }
}

export const exposeSocialLoginInfo = (): SocialLoginInfo | null =>
  socialLoginInfo ? {...socialLoginInfo} : null

export const onSocialLoginInfoChanged = (
  cb: (data: SocialLoginInfo | null) => unknown,
): SocialLoginInfo | null => {
  listeners['socialLoginInfoChanged'] = cb
  return exposeSocialLoginInfo()
}
