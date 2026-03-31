import type { Metadata } from 'next'
import { Providers } from './providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'AgentPad Terminal',
  description: 'CLI-style token launchpad for Tempo',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-black text-green-400 font-mono">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
