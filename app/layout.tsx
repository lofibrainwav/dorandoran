import 'maplibre-gl/dist/maplibre-gl.css'
import type { Metadata, Viewport } from 'next'
import './globals.css'
import './planner.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://dorandoran.link'),
  title: 'DoranDoran Family OS',
  description: 'Jayden-centered family coordination.',
  alternates: { canonical: '/' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
