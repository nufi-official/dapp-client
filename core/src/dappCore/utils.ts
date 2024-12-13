export const hardenUnreliableRequest = <T>(
  req: () => Promise<T>,
  fallbackResponse: T,
): Promise<T> =>
  Promise.any([
    req(),
    new Promise<T>((resolve) =>
      setTimeout(async () => resolve(await req()), 10),
    ),
    new Promise<T>((resolve) =>
      setTimeout(async () => resolve(await req()), 100),
    ),
    new Promise<T>((resolve) =>
      setTimeout(async () => resolve(await req()), 500),
    ),
    new Promise<T>((resolve) =>
      setTimeout(() => resolve(fallbackResponse), 1000),
    ),
  ])

export const getRandomUUID = () => {
  try {
    return self.crypto.randomUUID()
  } catch (e) {
    // If crypto.randomUUID() is not available (e.g. on HTTP pages),
    // fallback to the (less safe) logic below
  }

  // https://stackoverflow.com/questions/105034/how-do-i-create-a-guid-uuid/2117523#2117523
  let d = new Date().getTime()
  let d2 =
    (typeof performance !== 'undefined' &&
      performance.now &&
      performance.now() * 1000) ||
    0 // Time in microseconds since page-load or 0 if unsupported
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    let r = Math.random() * 16 // random number between 0 and 16
    /* eslint-disable no-bitwise */
    if (d > 0) {
      // Use timestamp until depleted
      r = (d + r) % 16 | 0
      d = Math.floor(d / 16)
    } else {
      // Use microseconds since page-load if supported
      r = (d2 + r) % 16 | 0
      d2 = Math.floor(d2 / 16)
    }
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
    /* eslint-enable no-bitwise */
  })
}

// Example: `setIfDoesNotExist(into, ['a', 's', 'd'], what)` is the same as
// `into.a.s.d = what`, except that all intermediate objects are created if
// they don't already exists, and `d` also must not already exists.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const setIfDoesNotExist = <U>(into: any, path: string[], what: U) => {
  for (const [i, segment] of path.entries()) {
    if (!Object.hasOwn(into, segment)) {
      into[segment] = i < path.length - 1 ? {} : what
    }
    into = into[segment]
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const set = <U>(into: any, path: string[], what: U) => {
  for (const [i, segment] of path.entries()) {
    if (i === path.length - 1) {
      into[segment] = what
    } else if (!Object.hasOwn(into, segment)) {
      into[segment] = {}
    }
    into = into[segment]
  }
}
