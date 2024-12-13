import type {SendRequest} from './types'

export const sendRequestProxy = (
  sendRequest: SendRequest,
  obj = {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): {[_ in string]: (...args: any[]) => Promise<any>} =>
  // This simply proxies all `api.foo(...args)` calls into `sendRequest('foo', args)`
  new Proxy(obj, {
    get(target, prop, receiver) {
      const method = prop.toString()
      // `target` most of the time will just be an empty object with the
      // default prototype `Object.prototype`. This check is here so that we
      // don't proxy stuff like `toString` for instance, because that can cause
      // weird behavior in some situations. (For example if you try to print
      // the proxy to the console.)
      if (!Reflect.has(target, prop)) {
        return (...args: any[]) => sendRequest(method, args)
      }

      // Make the empty object handle everything else, so that we can access
      // stuff like the default object prototype properties. This is not
      // necessarily needed in theory, but should be a safe default.
      return Reflect.get(target, prop, receiver)
    },
  })
