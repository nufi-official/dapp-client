export type SdkInfoItem = {sdkType: string; version: string}

export type SdkInfoMessage = {
  appId: 'nufi'
  method: 'reportSdkInfo'
  items: SdkInfoItem[]
}

export const getSdkInfoReporter = () => {
  let didReportAttempt = false
  return {
    tryReportingOnce: (
      sendSimplePostMessage: (message: unknown) => void,
      items: SdkInfoItem[],
    ) => {
      if (!didReportAttempt) {
        const message: SdkInfoMessage = {
          appId: 'nufi',
          method: 'reportSdkInfo',
          items,
        }
        sendSimplePostMessage(message)
        didReportAttempt = true
      }
    },
  }
}

export const getCoreSdkInfo = (): SdkInfoItem => {
  let version = ''
  try {
    version = require('../package.json').version
  } catch (err) {
    //
  }
  return {sdkType: 'core', version}
}
