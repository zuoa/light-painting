import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '灯光画生成器 | Light Painting Generator',
  description: '将照片转换为适合灯光画制作的封面纸图和透光层图',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
