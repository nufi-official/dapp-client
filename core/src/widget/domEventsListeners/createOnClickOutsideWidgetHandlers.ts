type CreateClickAwayHandlersParams = {
  elementQuerySelector: string
  handleClickAway: () => void
}

const createClickAwayHandlers = ({
  elementQuerySelector,
  handleClickAway,
}: CreateClickAwayHandlersParams) => {
  const _handleClickAway = (event: MouseEvent): void => {
    const element = document.querySelector(elementQuerySelector)
    if (element && !element.contains(event.target as Node | null)) {
      handleClickAway()
    }
  }

  return {
    addListener: () =>
      document.addEventListener('click', _handleClickAway, true),
    removeListener: () =>
      document.removeEventListener('click', _handleClickAway, true),
  }
}

export const createOnClickOutsideWidgetHandlers = (
  params: CreateClickAwayHandlersParams,
) => {
  // prevent adding multiple event listeners
  let isClickOutsideWidgetSet = false
  const clickAwayHandlers = createClickAwayHandlers(params)

  const addClickOutsideWidgetListener = () => {
    if (!isClickOutsideWidgetSet) {
      clickAwayHandlers.addListener()
      isClickOutsideWidgetSet = true
    }
  }

  const removeClickOutsideWidgetListener = () => {
    if (isClickOutsideWidgetSet) {
      clickAwayHandlers.removeListener()
      isClickOutsideWidgetSet = false
    }
  }

  return {addClickOutsideWidgetListener, removeClickOutsideWidgetListener}
}
