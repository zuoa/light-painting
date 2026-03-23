import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // 纯前端静态导出，无需服务器
  output: 'export',
  distDir: 'dist',

  // 图片优化（静态导出时不使用 Sharp）
  images: {
    unoptimized: true,
  },
}

export default nextConfig
