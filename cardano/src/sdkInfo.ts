import type {SdkInfoItem} from '@nufi/dapp-client-core'
import {getSdkInfoReporter} from '@nufi/dapp-client-core'

export const getCardanoSdkInfo = (): SdkInfoItem => {
  let version = ''
  try {
    version = require('../package.json').version
  } catch (err) {
    //
  }
  return {sdkType: 'cardano', version}
}

export const sdkInfoReporter = getSdkInfoReporter()
