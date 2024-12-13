export const safeReplyToEvent = (
  e: MessageEvent<unknown>,
  message: unknown,
) => {
  e.source?.postMessage(message, {targetOrigin: e.origin})
}
