import { notFound } from 'next/navigation'
import EarlyAccessClient from './EarlyAccessClient'

// Early Access stays off until the creator turns it on. Checked on the server
// so a disabled page is a real 404 with no signup form in the HTML; it used to
// render the form and only redirect in the browser, so crawlers still saw it.
// NEXT_PUBLIC_ values are baked in at build time, so this is decided per deploy.
export default function EarlyAccessPage() {
  if (process.env.NEXT_PUBLIC_EARLY_ACCESS_ENABLED !== 'true') notFound()
  return <EarlyAccessClient />
}
