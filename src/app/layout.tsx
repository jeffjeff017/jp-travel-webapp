import type { Metadata } from 'next'
import './globals.css'
import { LanguageProvider } from '@/lib/i18n'
import { QueryProvider } from '@/lib/query-provider'

export const metadata: Metadata = {
  title: '日本旅遊 | Japan Travel App',
  description: '探索日本之美 - Explore Japan with beautiful sakura-themed travel experience',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW">
      <body className="antialiased overflow-x-hidden">
        <QueryProvider>
          <LanguageProvider>
            {children}
          </LanguageProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
