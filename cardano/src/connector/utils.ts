export enum ApiErrorCode {
  // CIP-0030
  InvalidRequest = -1,
  InternalError = -2,
  Refused = -3,
}
export class ApiError {
  code: ApiErrorCode
  info: string

  public constructor(code: ApiErrorCode, info: string) {
    this.code = code
    this.info = info
  }
}
