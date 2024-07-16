type LogLevel = 'none' | 'debug'

let _logLevel: LogLevel = 'none'

export const setLogLevel = (level: LogLevel) => {
  _logLevel = level
}

export const logger = {
  debug: (...data: unknown[]) => {
    if (_logLevel === 'debug') {
      // eslint-disable-next-line no-console
      console.log('NuFi-debug:SDK', {calledAt: new Date().toString()}, ...data)
    }
  },
}
