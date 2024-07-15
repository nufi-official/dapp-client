export enum ApiErrorCode {
  // CIP-0030
  InvalidRequest = -1,
  InternalError = -2,
  Refused = -3,

  // CIP-0062
  UnsupportedVotingPurpose = -100,
  InvalidArgumentError = -101,
  UnknownChoiceError = -102,
  InvalidBlockDateError = -103,
  InvalidVotePlanError = -104,
  InvalidVoteOptionError = -105,
}

type ApiErrorAdditionalFields = {
  rejectedVotes?: number[]
  votingPurpose?: number[]
}

export class ApiError {
  code: ApiErrorCode
  info: string

  // CIP-0062
  rejectedVotes?: number[]
  votingPurpose?: number[]

  public constructor(
    code: ApiErrorCode,
    info: string,
    additionalFields?: ApiErrorAdditionalFields,
  ) {
    this.code = code
    this.info = info
    if (additionalFields?.rejectedVotes) {
      this.rejectedVotes = additionalFields?.rejectedVotes
    }
    if (additionalFields?.votingPurpose) {
      this.votingPurpose = additionalFields?.votingPurpose
    }
  }
}

enum VotingPurpose {
  CATALYST = 0,
  OTHER = 1,
}

export const supportedVotingPurposes = [VotingPurpose.CATALYST]

export function ensureCatalystVotingPurpose(purposes: unknown) {
  if (!Array.isArray(purposes) || purposes.length === 0) {
    throw new ApiError(
      ApiErrorCode.InvalidArgumentError,
      `Invalid Voting Purpose ${JSON.stringify(purposes)}`,
    )
  }
  const unsupportedPurposes = purposes.filter(
    (p) => !supportedVotingPurposes.includes(p),
  )

  if (unsupportedPurposes.length > 0) {
    throw new ApiError(
      ApiErrorCode.UnsupportedVotingPurpose,
      `Unsupported Voting Purpose ${unsupportedPurposes.join(' & ')}`,
      {
        votingPurpose: unsupportedPurposes,
      },
    )
  }
}
