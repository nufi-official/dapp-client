import type {ConnectorPlatform} from './types'

export const objKeyByConnectorPlatform: Record<ConnectorPlatform, string> = {
  extension: 'nufi',
  snap: 'nufiSnap',
  sso: 'nufiSSO',
}
