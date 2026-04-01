'use client'

import { WagmiProvider, createConfig, http } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { mainnet, base } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'

// Tempo network configuration
const tempo = {
  id: 42431,
  name: 'Tempo Moderate',
  network: 'tempo-moderato',
  nativeCurrency: {
    decimals: 18,
    name: 'USD',
    symbol: 'USD',
  },
  rpcUrls: {
    default: { http: ['https://rpc.moderato.tempo.xyz'] },
    public: { http: ['https://rpc.moderato.tempo.xyz'] },
  },
} as const

const config = createConfig({
  chains: [tempo, mainnet, base],
  connectors: [
    injected({ target: 'metaMask' }),
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '85be66e6169307dc900bc2337d69d10a',
    }),
  ],
  transports: {
    [tempo.id]: http(),
    [mainnet.id]: http(),
    [base.id]: http(),
  },
})

const queryClient = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}
