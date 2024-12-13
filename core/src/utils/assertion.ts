// https://stackoverflow.com/questions/39419170/how-do-i-check-that-a-switch-block-is-exhaustive-in-typescript
export const safeAssertUnreachable = (x: never): never => {
  throw new Error(`Unreachable switch case:${x}`)
}
