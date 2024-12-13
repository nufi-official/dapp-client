import type {
  EIP6963AnnounceProviderEvent,
  EIP6963ProviderDetail,
  MetaMaskInpageProvider,
} from '@metamask/providers'

export type {MetaMaskInpageProvider} from '@metamask/providers'

export async function isMetamaskInstalled(): Promise<boolean> {
  try {
    return (await getMetaMaskProviderWithEip6963()) != null
  } catch (err) {
    return false
  }
}

// https://eips.ethereum.org/EIPS/eip-6963
// Note that the provider returned may not yet be connected
export async function getMetaMaskProviderWithEip6963(): Promise<MetaMaskInpageProvider | null> {
  const metaMaskProviderPromise = new Promise<MetaMaskInpageProvider>(
    (resolve) => {
      const onProviderAnnounced = (event: Event) => {
        const providerDetail: EIP6963ProviderDetail = (
          event as EIP6963AnnounceProviderEvent
        ).detail

        if (providerDetail.info.rdns === 'io.metamask') {
          const provider = providerDetail.provider as MetaMaskInpageProvider

          window.removeEventListener(
            'eip6963:announceProvider',
            onProviderAnnounced,
          )

          resolve(provider)
        }
      }
      window.addEventListener('eip6963:announceProvider', (event) => {
        onProviderAnnounced(event)
      })

      window.dispatchEvent(new Event('eip6963:requestProvider'))
    },
  )

  return await Promise.race([
    metaMaskProviderPromise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 1_000)),
  ])
}
