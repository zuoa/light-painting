const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 纯前端静态导出，无需服务器
  output: 'export',
  distDir: 'dist',

  // 图片优化（静态导出时不使用 Sharp）
  images: {
    unoptimized: true,
  },

  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'onnxruntime-web$': path.resolve(__dirname, 'node_modules/onnxruntime-web/dist/ort.wasm.min.js'),
      'onnxruntime-web/webgpu$': path.resolve(__dirname, 'node_modules/onnxruntime-web/dist/ort.webgpu.min.js'),
    }

    return config
  },
}

module.exports = nextConfig
