import type {CoreNufiMessage} from '../dappCore/types'

import type {Device} from './responsiveUIHandlers'

export type HideWidgetMessage = CoreNufiMessage & {
  method: 'hideWidget'
  // Originally added in SDK "0.2.1" as part of already removed "collapseWidget" message.
  // `undefined` in older SDK versions.
  priorityTimestamp: string
}

export type ToggleWidgetMessage = CoreNufiMessage & {
  method: 'openWidget' | 'closeWidget'
  // Originally added in SDK "0.6.0", `undefined` in older SDK versions.
  priorityTimestamp: string
}

export type SetDeviceTypeWidgetMessage = CoreNufiMessage & {
  method: 'setDeviceType'
  device: Device
  // Originally added in SDK "0.6.0", `undefined` in older SDK versions.
  priorityTimestamp: string
}

export type WidgetReadyMessage = CoreNufiMessage & {
  method: 'widgetReady'
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
  | RefreshPageMessage
  | GetParentWindowDimensionsRequest
  | GetParentWindowDimensionsResponse
  | SignOutWidgetMessage
  | SetDeviceTypeWidgetMessage
  | WidgetReadyMessage

const widgetManagementMethods: WidgetManagementMessage['method'][] = [
  'closeWidget',
  'openWidget',
  'hideWidget',
  'refreshPage',
  'getParentWindowDimensionsRequest',
  'getParentWindowDimensionsResponse',
  'signOut',
  'setDeviceType',
  'widgetReady',
]

const deprecatedWidgetManagementMethods = [
  // Removed in "0.4.0"
  'collapseWidget',
]

export const isNufiWidgetManagementMessage = (
  e: MessageEvent<unknown>,
): e is MessageEvent<WidgetManagementMessage> => {
  if (e.data == null) return false
  const _e = e as MessageEvent<WidgetManagementMessage>
  const method = _e.data.method
  return (
    _e?.data?.appId === 'nufi' &&
    (widgetManagementMethods.includes(method) ||
      deprecatedWidgetManagementMethods.includes(method))
  )
}

export type WidgetVisibilityStatus = 'open' | 'closed' | 'hidden'

export type ShowWidget = (type: 'opened' | 'closed') => void

export type GetWidgetVisibilityStatus = () => WidgetVisibilityStatus
