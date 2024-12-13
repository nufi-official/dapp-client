import {extendQueryString} from '../widget/utils'

describe('extendQueryString', () => {
  test('should extend query string with additional params', () => {
    const initialQueryString =
      '?blockchain=cardano&loginType=web3Auth&provider=google'
    const additionalParams = {colorMode: 'dark'}
    const extendedQueryString = extendQueryString(
      initialQueryString,
      additionalParams,
    )

    expect(`?${extendedQueryString}`).toBe(
      `${initialQueryString}&colorMode=${additionalParams.colorMode}`,
    )
  })

  test('should handle empty query string', () => {
    const initialQueryString = '?'
    const additionalParams = {colorMode: 'dark'}
    const extendedQueryString = extendQueryString(
      initialQueryString,
      additionalParams,
    )

    expect(`?${extendedQueryString}`).toBe(
      `?colorMode=${additionalParams.colorMode}`,
    )
  })

  test('should handle empty additional params', () => {
    const initialQueryString =
      '?blockchain=cardano&loginType=web3Auth&provider=google'
    const additionalParams = {}
    const extendedQueryString = extendQueryString(
      initialQueryString,
      additionalParams,
    )

    expect(`?${extendedQueryString}`).toBe(initialQueryString)
  })
})
