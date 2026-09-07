import 'maplibre-gl/dist/maplibre-gl.css'
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Chad Family OS',
  description: 'Jayden-centered family coordination.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
