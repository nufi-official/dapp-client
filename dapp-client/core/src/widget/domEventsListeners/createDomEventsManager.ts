import {isNufiWidgetManagementMessage} from '../../core/utils'
import type {WidgetManagementMessage} from '../types'
import {createOnClickOutsideWidgetHandlers as _createOnClickOutsideWidgetHandlers} from './createOnClickOutsideWidgetHandlers'

type NufiWidgetManagementMessageEvent = MessageEvent<WidgetManagementMessage>

type RegisterDomEventsParams = {
  clickOutsideElementSelector: string
  handleClickAway: () => void
}

export const createDomEventsManager = () => {
  let clickOutsideWidgetHandlers: ReturnType<
    typeof _createOnClickOutsideWidgetHandlers
  > | null

  const createOnClickOutsideWidgetHandlers = ({
    clickOutsideElementSelector,
    handleClickAway,
  }: RegisterDomEventsParams) => {
    clickOutsideWidgetHandlers = _createOnClickOutsideWidgetHandlers({
      elementQuerySelector: clickOutsideElementSelector,
      handleClickAway,
    })
  }

  const registerNufiWidgetManagementListener = (
    onNufiWidgetManagementMessage: (
      e: NufiWidgetManagementMessageEvent,
    ) => void,
  ) => {
    // We are only checking message structure here, not the origin,
    // as this code anyways runs in untrusted environment.
    window.addEventListener('message', (e) => {
      if (!isNufiWidgetManagementMessage(e)) return
      onNufiWidgetManagementMessage(e as NufiWidgetManagementMessageEvent)
    })
  }

  const getClickOutsideWidgetHandlers = () => {
    if (clickOutsideWidgetHandlers == null) {
      throw Error('On Click Outside Widget Handlers were not created.')
    }
    return clickOutsideWidgetHandlers
  }

  return {
    registerNufiWidgetManagementListener,
    createOnClickOutsideWidgetHandlers,
    getClickOutsideWidgetHandlers,
  }
}
