import DonateClient from './DonateClient'
import { getDonationSettingsOrThrow } from '@/lib/settings'

// cached page, refreshed every 60 s or right away when an admin saves settings
export const revalidate = 60

// settings read on the server -> the Ko-fi / Patreon cards are in the first HTML (no loading flash)
export default async function DonatePage() {
  const settings = await getDonationSettingsOrThrow()
  return <DonateClient settings={settings} />
}
