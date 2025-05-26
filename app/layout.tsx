import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Solar Writer',
  description: 'AI-powered content generation with real-time research and refinement',
  generator: 'Solar Writer',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children;
} 