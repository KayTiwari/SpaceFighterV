import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SpaceFighterV',
  description: 'Space invaders clone built in React. Shoot, survive, save your score.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#000', color: '#fff', fontFamily: 'monospace' }}>
        {children}
      </body>
    </html>
  )
}
