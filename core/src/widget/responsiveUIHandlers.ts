// In a responsive UI, we need to adjust the body's overflow property
// to manage scrolling behavior. To ensure we can revert to the
// previous styling (important for any DApp), we first store the current
// overflow value in a variable.
let previousBodyOverflowProperty: null | string = null

export type Device = 'desktop' | 'mobile'

export const DEFAULT_DEVICE: Device = 'desktop'

export const getResponsiveUIHandlers = () => {
  const getIsMobileMediaQuery = () => matchMedia('(max-width:600px)')

  const getComputedBodyOverflowProperty = () =>
    getComputedStyle(document.body).overflow

  const getDeviceType = (): Device =>
    getIsMobileMediaQuery().matches ? 'mobile' : 'desktop'

  const addDeviceChangeListener = (onChange: (device: Device) => void) =>
    getIsMobileMediaQuery().addEventListener('change', ({matches}) => {
      onChange(matches ? 'mobile' : 'desktop')
    })

  const toggleBodyOverflow = ({hidden}: {hidden: boolean}) => {
    // only overwrite when when necessary
    if (hidden) {
      previousBodyOverflowProperty = getComputedBodyOverflowProperty()
      document.body.style.overflow = 'hidden'
    } else if (previousBodyOverflowProperty) {
      document.body.style.overflow = previousBodyOverflowProperty
      previousBodyOverflowProperty = null
    }
  }

  return {
    getDeviceType,
    addDeviceChangeListener,
    toggleBodyOverflow,
  }
}
