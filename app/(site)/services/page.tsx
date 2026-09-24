import { redirect } from 'next/navigation'

// Retired section: preserve old links without exposing a second services page.
export default function ServicesPage() {
  redirect('/contact')
}
