"use client"

import { useRef } from 'react'
import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

export default function Providers({ children }: PropsWithChildren<{}>) {
  const clientRef = useRef<QueryClient>()
  if (!clientRef.current) clientRef.current = new QueryClient()

  return <QueryClientProvider client={clientRef.current}>{children}</QueryClientProvider>
}
