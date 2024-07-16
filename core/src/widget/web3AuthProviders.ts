export const WEB3_AUTH_LOGIN_PROVIDERS = [
  'google',
  'facebook',
  'discord',
] as const

export type Web3AuthProvider = (typeof WEB3_AUTH_LOGIN_PROVIDERS)[number]

export const isSupportedWeb3AuthProvider = (provider: string) =>
  WEB3_AUTH_LOGIN_PROVIDERS.includes(provider as Web3AuthProvider)
