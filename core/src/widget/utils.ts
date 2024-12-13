export const extendQueryString = (
  queryString: `?${string}`,
  additionalParams: Record<string, string>,
) => {
  const queryStringSearchParams = new URLSearchParams(queryString)
  const additionalSearchParams = new URLSearchParams(additionalParams)

  return new URLSearchParams([
    ...queryStringSearchParams,
    ...additionalSearchParams,
  ]).toString()
}
