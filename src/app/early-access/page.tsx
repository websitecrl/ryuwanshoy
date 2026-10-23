import { notFound } from 'next/navigation'
import EarlyAccessClient from './EarlyAccessClient'

// EA off -> real 404 on the server (decided per deploy: NEXT_PUBLIC_ is build time)
export default function EarlyAccessPage() {
  if (process.env.NEXT_PUBLIC_EARLY_ACCESS_ENABLED !== 'true') notFound()
  return <EarlyAccessClient />
}
