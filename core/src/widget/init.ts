import {safeReplyToEvent} from '../utils/events'
import {logger} from '../utils/logging'

import {
  getHiddenAt,
  guardedHide,
  guardedToggle,
  setHiddenAt,
} from './hiddenAtSynchronization'
import type {
  GetParentWindowDimensionsResponse,
  HideWidgetMessage,
  ToggleWidgetMessage,
  SetDeviceTypeWidgetMessage,
  GetWidgetVisibilityStatus,
  ShowWidget,
} from './managementMethods'
import {isNufiWidgetManagementMessage} from './managementMethods'
import {DEFAULT_DEVICE, getResponsiveUIHandlers} from './responsiveUIHandlers'
import {extendQueryString} from './utils'

const NUFI_WIDGET_ID = 'nufi-widget'
const NUFI_WIDGET_QUERY_SELECTOR = `iframe#${NUFI_WIDGET_ID}`

export const CORE_SDK_NOT_INITIALIZED = '"initNufiDappSdk" was not called'

const HIDDEN_WIDGET_SIZE = '1px'
const DESKTOP_IFRAME_BOTTOM_POSITION = '10px'

export type IFrameOptions = {
  zIndex?: number
  responsive?: boolean
  colorMode?: 'dark' | 'light'
}

const createIframe = (url: string, options?: IFrameOptions) => {
  logger.debug('"createIframe"', {url, options})

  const iframe = document.createElement('iframe')

  iframe.id = NUFI_WIDGET_ID
  iframe.src = url
  iframe.style.width = HIDDEN_WIDGET_SIZE
  iframe.style.height = HIDDEN_WIDGET_SIZE
  iframe.style.position = 'fixed'
  iframe.style.bottom = DESKTOP_IFRAME_BOTTOM_POSITION
  iframe.style.zIndex = `${options?.zIndex ?? 0}`
  iframe.style.colorScheme = 'none'

  // Without this property there is white border around the iframe
  // eslint-disable-next-line
  // @ts-ignore
  iframe.frameBorder = 0

  document.body.appendChild(iframe)

  return iframe
}

// Note that due to browser restrictions we can not simply lookup this property.
// Note that change to another origin will not be allowed by the browser.
// Note that we only allow `/widget` pathname to be loaded inside iframe.
// Note that we are storing `ConnectorPlatform` in query string in order to
// have an option of tracking usage in the future.
let previousIframeUrl: string | null = null

export let widgetManagementReadyPromise: Promise<void> | null = null
let resolveWidgetManagementReadyPromise: (() => void) | null = null

const setNewWidgetManagementReadyPromise = () => {
  widgetManagementReadyPromise = new Promise((resolve) => {
    resolveWidgetManagementReadyPromise = resolve
  })
}

setNewWidgetManagementReadyPromise()

const getOrCreateIframe = (url: string, iframeOptions?: IFrameOptions) => {
  const existingIframe = document.querySelector(
    NUFI_WIDGET_QUERY_SELECTOR,
  ) as HTMLIFrameElement | null

  let iframeDidRefresh = false

  if (existingIframe && url !== previousIframeUrl) {
    // This results in Widget refresh.
    existingIframe.src = url
    iframeDidRefresh = true
  }

  previousIframeUrl = url

  const result = existingIframe
    ? {iframe: existingIframe, isNewIframeCreated: false, iframeDidRefresh}
    : {
        iframe: createIframe(url, iframeOptions),
        isNewIframeCreated: true,
        iframeDidRefresh: true,
      }

  if (result.iframeDidRefresh) {
    setHiddenAt(null)
    setNewWidgetManagementReadyPromise()
  }
  return result
}

const width = {
  desktop: {
    closed: '200px',
    opened: '400px',
    hidden: HIDDEN_WIDGET_SIZE,
  },
  mobile: {
    closed: '200px',
    opened: '100vw',
    hidden: HIDDEN_WIDGET_SIZE,
  },
}

const height = {
  desktop: {
    closed: '80px',
    opened: '700px',
    hidden: HIDDEN_WIDGET_SIZE,
  },
  mobile: {
    closed: '80px',
    opened: '100vh',
    hidden: HIDDEN_WIDGET_SIZE,
  },
}

const position = {
  desktop: {
    bottom: DESKTOP_IFRAME_BOTTOM_POSITION,
  },
  mobile: {
    bottom: '0px',
  },
}

let colorMode: Exclude<IFrameOptions['colorMode'], undefined> = 'dark'

export function ensureWidgetEmbeddedInIframe(
  params:
    | {
        type: 'prefetch'
        baseUrl: string
        iframeOptions?: IFrameOptions
      }
    | {
        type: 'updateQueryString'
        query: `?${string}`
      },
) {
  if (params.type === 'prefetch' && params.iframeOptions?.colorMode) {
    // store the preferred color mode from iframeOptions so it can be passed as query string
    colorMode = params.iframeOptions.colorMode
  }

  const url = (() => {
    if (previousIframeUrl == null) {
      if (params.type === 'prefetch') {
        return params.baseUrl
      }
      throw new Error(CORE_SDK_NOT_INITIALIZED)
    } else {
      if (params.type === 'prefetch') {
        // Avoid using the prefetch url once set to full url as this would reset the search string.
        // This can happen if dapp prefetches the iframe after already being initialized
        // with target search string.
        return previousIframeUrl
      }
      const _url = new URL(previousIframeUrl)
      const queryString = extendQueryString(params.query, {colorMode})
      return `${_url.origin}${_url.pathname}?${queryString}`
    }
  })()

  const iframeOptions = (() => {
    if (params.type === 'prefetch') {
      return params.iframeOptions
    }
    return undefined
  })()

  const {iframe, isNewIframeCreated, iframeDidRefresh} = getOrCreateIframe(
    url,
    iframeOptions,
  )
  // Get a reference to the iframe's window.
  // eslint-disable-next-line
  const iframeWindow = iframe.contentWindow!

  const responsiveUIHandlers = iframeOptions?.responsive
    ? getResponsiveUIHandlers()
    : undefined

  const sendPortPostMessage = (message: unknown, transfer: Transferable[]) => {
    iframeWindow.postMessage(message, new URL(url).origin, transfer)
  }

  const sendSimplePostMessage = (message: unknown) => {
    iframeWindow.postMessage(message, new URL(url).origin)
  }

  const resizeIframe = (type: 'opened' | 'closed' | 'hidden') => {
    logger.debug('"resizeIframe"', type)

    const device = responsiveUIHandlers?.getDeviceType() || DEFAULT_DEVICE

    responsiveUIHandlers?.toggleBodyOverflow({
      hidden: device === 'mobile' && type === 'opened',
    })

    iframe.style.width = width[device][type]
    iframe.style.height = height[device][type]
    iframe.style.bottom = position[device].bottom
  }

  const showWidget: ShowWidget = (type) => {
    const priorityTimestamp = new Date().toISOString()
    logger.debug('showWidget', type, priorityTimestamp)
    setHiddenAt(null)

    if (type === 'closed') {
      const message: ToggleWidgetMessage = {
        appId: 'nufi',
        method: 'closeWidget',
        priorityTimestamp,
      }
      sendSimplePostMessage(message)
      // Note that this is dirty workaround that we need, as we currently
      // do not have mechanism to detect that message was processed.
      setTimeout(() => {
        guardedToggle(() => resizeIframe('closed'), priorityTimestamp)
      }, 200)
    } else {
      const message: ToggleWidgetMessage = {
        appId: 'nufi',
        method: 'openWidget',
        priorityTimestamp,
      }
      guardedToggle(() => resizeIframe('opened'), priorityTimestamp) // first expand iframe to avoid scroll bar
      sendSimplePostMessage(message)
    }
  }

  const hideWidget = () => {
    const priorityTimestamp = new Date().toISOString()
    logger.debug('"hideWidget"', priorityTimestamp)
    setHiddenAt(priorityTimestamp)

    const message: HideWidgetMessage = {
      appId: 'nufi',
      method: 'hideWidget',
      priorityTimestamp,
    }
    sendSimplePostMessage(message)

    // Note that this is dirty workaround that we need, as we currently
    // do not have mechanism for waiting on `sendHideWidgetMessage`
    // to be processed.
    setTimeout(() => {
      if (getHiddenAt() != null) {
        resizeIframe('hidden')
      }
    }, 200)
  }

  const sendDeviceTypeMessage = (
    device: SetDeviceTypeWidgetMessage['device'],
  ) => {
    const message: SetDeviceTypeWidgetMessage = {
      appId: 'nufi',
      method: 'setDeviceType',
      device,
      priorityTimestamp: new Date().toISOString(),
    }

    sendSimplePostMessage(message)
  }

  if (isNewIframeCreated) {
    window.addEventListener('message', (_e) => {
      if (!isNufiWidgetManagementMessage(_e)) return
      logger.debug('"registerNufiWidgetManagementListener"', {
        method: _e.data.method,
        data: _e.data,
        currentHiddenAt: getHiddenAt(),
      })
      switch (_e.data.method) {
        case 'hideWidget': {
          guardedHide(hideWidget, _e.data.priorityTimestamp)
          break
        }
        case 'closeWidget': {
          guardedToggle(() => resizeIframe('closed'), _e.data.priorityTimestamp)
          break
        }
        case 'openWidget': {
          guardedToggle(() => resizeIframe('opened'), _e.data.priorityTimestamp)
          break
        }
        case 'refreshPage': {
          location.reload()
          break
        }
        case 'getParentWindowDimensionsRequest': {
          const iframe = document.querySelector(
            NUFI_WIDGET_QUERY_SELECTOR,
          ) as HTMLIFrameElement | null
          if (!iframe) {
            return
          }
          const iframeRect = iframe.getBoundingClientRect()

          const response: GetParentWindowDimensionsResponse = {
            appId: 'nufi',
            method: 'getParentWindowDimensionsResponse',
            dimensions: {
              width: window.innerWidth,
              height: window.innerHeight,
              top: window.screenTop,
              left: window.screenLeft,
            },
            iframeRect: {
              top: iframeRect.top,
              right: iframeRect.right,
              bottom: iframeRect.bottom,
              left: iframeRect.left,
              width: iframeRect.width,
              height: iframeRect.height,
              x: iframeRect.x,
              y: iframeRect.y,
            },
          }
          safeReplyToEvent(_e, response)
          break
        }
        case 'widgetReady': {
          resolveWidgetManagementReadyPromise?.()
          sendDeviceTypeMessage(
            responsiveUIHandlers?.getDeviceType() || DEFAULT_DEVICE,
          )
          break
        }
        default: {
          return
        }
      }
    })

    // listen on breakpoint changes when resizing window
    responsiveUIHandlers?.addDeviceChangeListener((device) => {
      sendDeviceTypeMessage(device)
    })
  }

  const getWidgetVisibilityStatus: GetWidgetVisibilityStatus = () => {
    logger.debug('"getWidgetVisibilityStatus"', iframe.style.width)
    if (iframe.style.width === HIDDEN_WIDGET_SIZE) {
      logger.debug('"getWidgetVisibilityStatus"', 'hidden')
      return 'hidden'
    }
    const device = responsiveUIHandlers?.getDeviceType() || DEFAULT_DEVICE
    if (iframe.style.width === width[device].opened) {
      logger.debug('"getWidgetVisibilityStatus"', 'opened')
      return 'open'
    }
    logger.debug('"getWidgetVisibilityStatus"', 'closed')
    return 'closed'
  }

  return {
    iframeDidRefresh,
    sendPortPostMessage,
    sendSimplePostMessage,
    showWidget,
    hideWidget,
    getWidgetVisibilityStatus,
  }
}

export type EnsureWidgetEmbeddedInIframe = typeof ensureWidgetEmbeddedInIframe
