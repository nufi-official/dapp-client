import {handleSocialLoginEvents} from './socialLoginInfo'

let previousEventListener: ((e: MessageEvent<unknown>) => void) | null = null

export const registerWidgetApiEvents = (widgetOrigin: string) => {
  if (previousEventListener != null) {
    window.removeEventListener('message', previousEventListener)
    previousEventListener = null
  }

  const fn = (e: MessageEvent<unknown>) => {
    if (e.origin !== widgetOrigin) return
    handleSocialLoginEvents(e)
  }

  previousEventListener = fn
  window.addEventListener('message', fn)
}
