let hiddenAt: string | null = null

export const getHiddenAt = () => hiddenAt

const isAfterHiddenAt = (priorityTimestamp: string) => {
  return (
    hiddenAt == null ||
    new Date(priorityTimestamp).getTime() - new Date(hiddenAt).getTime() >= 0
  )
}

export const setHiddenAt = (_hiddenAt: string | null) => {
  hiddenAt = _hiddenAt
}

/**
 * Calls `onToggle` only when the widget was not hidden after the attached `priorityTimestamp`.
 */
export const guardedToggle = (
  onToggle: () => unknown,
  priorityTimestamp: string,
) => {
  if (isAfterHiddenAt(priorityTimestamp)) {
    hiddenAt = null
    onToggle()
  }
}

/**
 * Calls `onHide` only when the widget was not unhidden after the attached `priorityTimestamp`.
 */
export const guardedHide = (
  onHide: () => unknown,
  priorityTimestamp: string,
) => {
  if (isAfterHiddenAt(priorityTimestamp)) {
    hiddenAt = priorityTimestamp
    onHide()
  }
}
