import {logger} from '../core/logging'
import {safeReplyToEvent} from '../publicUtils'

import {createDomEventsManager} from './domEventsListeners'
import type {
  GetParentWindowDimensionsResponse,
  CollapseWidgetMessage,
} from './types'

const NUFI_WIDGET_ID = 'nufi-widget'
const NUFI_WIDGET_QUERY_SELECTOR = `iframe#${NUFI_WIDGET_ID}`

export const CORE_SDK_NOT_INITIALIZED = '"initNufiDappSdk" was not called'

const HIDDEN_WIDGET_SIZE = '1px'

export type IFrameOptions = {
  zIndex?: number
}

const createIframe = (url: string, options?: IFrameOptions) => {
  logger.debug('"createIframe"', {url, options})

  const iframe = document.createElement('iframe')

  iframe.id = NUFI_WIDGET_ID
  iframe.src = url
  iframe.style.width = HIDDEN_WIDGET_SIZE
  iframe.style.height = HIDDEN_WIDGET_SIZE
  iframe.style.position = 'fixed'
  iframe.style.bottom = '10px'
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

  return existingIframe
    ? {iframe: existingIframe, isNewIframeCreated: false, iframeDidRefresh}
    : {
        iframe: createIframe(url, iframeOptions),
        isNewIframeCreated: true,
        iframeDidRefresh: true,
      }
}

const domEventsManager = createDomEventsManager()

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
      return `${_url.origin}${_url.pathname}${params.query}`
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

  const sendPortPostMessage = (message: unknown, transfer: Transferable[]) => {
    iframeWindow.postMessage(message, new URL(url).origin, transfer)
  }

  const sendSimplePostMessage = (message: unknown) => {
    iframeWindow.postMessage(message, new URL(url).origin)
  }

  const resizeIframe = (type: 'opened' | 'closed' | 'hidden') => {
    logger.debug('"resizeIframe"', type)
    const width = {
      closed: '200px',
      opened: '400px',
      hidden: HIDDEN_WIDGET_SIZE,
    }

    const height = {
      closed: '80px',
      opened: '700px',
      hidden: HIDDEN_WIDGET_SIZE,
    }

    iframe.style.width = width[type]
    iframe.style.height = height[type]
  }

  const sendCollapseWidgetMessage = () => {
    const priorityTimestamp = new Date().toISOString()
    logger.debug('"sendCollapseWidgetMessage"')
    const message: CollapseWidgetMessage = {
      appId: 'nufi',
      method: 'collapseWidget',
      priorityTimestamp,
    }
    sendSimplePostMessage(message)
  }

  const hideWidget = () => {
    logger.debug('"hideWidget"')
    sendCollapseWidgetMessage()

    // Note that this is dirty workaround that we need, as we currently
    // do not have mechanism for waiting on `sendCollapseWidgetMessage`
    // to be processed.
    setTimeout(() => {
      resizeIframe('hidden')
    }, 200)
  }

  if (isNewIframeCreated) {
    domEventsManager.registerNufiWidgetManagementListener((_e) => {
      logger.debug('"registerNufiWidgetManagementListener"', {
        method: _e.data.method,
      })
      switch (_e.data.method) {
        case 'hideWidget': {
          hideWidget()
          break
        }
        case 'closeWidget': {
          resizeIframe('closed')
          break
        }
        case 'openWidget': {
          resizeIframe('opened')
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
        default: {
          return
        }
      }
    })
  }

  const showWidget = () => {
    logger.debug('"showWidget"')
    resizeIframe('closed')
  }

  const isWidgetHidden = () => {
    const res = iframe.style.width === HIDDEN_WIDGET_SIZE
    logger.debug('"isWidgetHidden"', res)
    return res
  }

  return {
    iframeDidRefresh,
    sendPortPostMessage,
    sendSimplePostMessage,
    showWidget,
    hideWidget,
    isWidgetHidden,
  }
}

export type EnsureWidgetEmbeddedInIframe = typeof ensureWidgetEmbeddedInIframe
