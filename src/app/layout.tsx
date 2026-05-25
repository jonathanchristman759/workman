// Workman — layout.tsx (root)
// apps/web/src/app/layout.tsx
// Next.js App Router root layout — wraps every page

import type { Metadata } from 'next'
import { Inter } 
import '../styles/themes.css'
import '../styles/globals.css'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { AuthProvider } from '@/components/providers/AuthProvider'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default:  'Workman — Study to be approved.',
    template: '%s · Workman',
  },
  description:
    'The sermon preparation workspace for faithful pastors. Lexicon, illustrations, original languages, and sermon archive — all in one place.',
  metadataBase: new URL('https://theworkman.app'),
  openGraph: {
    title:       'Workman',
    description: 'Study to be approved. — 2 Timothy 2:15',
    url:         'https://theworkman.app',
    siteName:    'Workman',
    locale:      'en_US',
    type:        'website',
  },
  icons: {
    icon:  '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.variable}>
        <AuthProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
