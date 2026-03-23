// 纯前端图像处理器 - 使用 HTMLCanvasElement
// 无需后端，图片不上传服务器

import type { ProcessParams, ProcessResult } from './types'

// ─── Main entry point ────────────────────────────────────────────────────────

export async function processImageBrowser(
  file: File,
  params: ProcessParams
): Promise<ProcessResult> {
  // 1. 加载图片
  const bitmap = await loadImage(file)
  const { width, height } = bitmap

  // 2. 计算目标尺寸
  const targetSize = getTargetSize(params.common)

  // 3. 生成四张图
  const coverCanvas = await generateCover(bitmap, params.cover, targetSize)
  const layer1Canvas = await generateLayer1(bitmap, params.layer1, params.common, targetSize)
  const layer2Canvas = await generateLayer2(bitmap, params.layer2, params.common, targetSize)
  const previewCanvas = await generatePreview(coverCanvas, layer1Canvas, layer2Canvas, targetSize)

  // 4. 转换为 base64
  return {
    cover: canvasToBase64(coverCanvas, 'image/png'),
    layer1: canvasToBase64(layer1Canvas, 'image/png'),
    layer2: canvasToBase64(layer2Canvas, 'image/png'),
    preview: canvasToBase64(previewCanvas, 'image/jpeg', 0.9),
  }
}

// ─── Image loading ───────────────────────────────────────────────────────────

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
}

// ─── Target size calculation ─────────────────────────────────────────────────

function getTargetSize(common: ProcessParams['common']): { width: number; height: number } {
  if (common.sizePreset === 'custom') {
    return { width: common.customWidth, height: common.customHeight }
  }
  if (common.sizePreset === '8inch') {
    return { width: 1800, height: 2400 }
  }
  return { width: 1500, height: 2100 }
}

// ─── Canvas creation helpers ─────────────────────────────────────────────────

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Failed to get canvas context')
  return ctx
}

// ─── Resize with center crop ─────────────────────────────────────────────────

async function resizeToTarget(
  img: HTMLImageElement,
  target: { width: number; height: number }
): Promise<HTMLCanvasElement> {
  const canvas = createCanvas(target.width, target.height)
  const ctx = getContext(canvas)

  // Calculate cover crop
  const srcRatio = img.width / img.height
  const targetRatio = target.width / target.height

  let srcW, srcH, srcX, srcY

  if (srcRatio > targetRatio) {
    srcH = img.height
    srcW = img.height * targetRatio
    srcX = (img.width - srcW) / 2
    srcY = 0
  } else {
    srcW = img.width
    srcH = img.width / targetRatio
    srcX = 0
    srcY = (img.height - srcH) / 2
  }

  ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, target.width, target.height)
  return canvas
}

// ─── Cover generation: warm-gray style ───────────────────────────────────────

async function generateCover(
  img: HTMLImageElement,
  params: ProcessParams['cover'],
  targetSize: { width: number; height: number }
): Promise<HTMLCanvasElement> {
  const canvas = await resizeToTarget(img, targetSize)
  const ctx = getContext(canvas)
  const imageData = ctx.getImageData(0, 0, targetSize.width, targetSize.height)
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i]
    let g = data[i + 1]
    let b = data[i + 2]

    // Desaturate partially
    const gray = r * 0.2126 + g * 0.7152 + b * 0.0722
    const saturation = 1 - params.saturationReduction
    r = gray * (1 - saturation) + r * saturation
    g = gray * (1 - saturation) + g * saturation
    b = gray * (1 - saturation) + b * saturation

    // Brightness
    r *= params.brightness
    g *= params.brightness
    b *= params.brightness

    // Warmth
    const warmthFactor = params.warmth / 100
    r += warmthFactor * 30
    b -= warmthFactor * 15

    // Contrast
    const contrastFactor = params.contrast
    r = ((r - 128) * contrastFactor) + 128
    g = ((g - 128) * contrastFactor) + 128
    b = ((b - 128) * contrastFactor) + 128

    // Clamp
    data[i] = Math.min(255, Math.max(0, r))
    data[i + 1] = Math.min(255, Math.max(0, g))
    data[i + 2] = Math.min(255, Math.max(0, b))
  }

  ctx.putImageData(imageData, 0, 0)
  return canvas
}

// ─── Layer 1: detail layer (grayscale) ───────────────────────────────────────

async function generateLayer1(
  img: HTMLImageElement,
  params: ProcessParams['layer1'],
  common: ProcessParams['common'],
  targetSize: { width: number; height: number }
): Promise<HTMLCanvasElement> {
  const canvas = await resizeToTarget(img, targetSize)
  const ctx = getContext(canvas)
  const imageData = ctx.getImageData(0, 0, targetSize.width, targetSize.height)
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    // Grayscale
    let gray = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722

    // Gamma
    gray = Math.pow(gray / 255, params.gamma) * 255

    // Contrast
    gray = ((gray - 128) * params.contrast) + 128

    // Shadow crush
    if (gray < 128) {
      gray = Math.pow(gray / 128, 1 + params.shadowCrush) * 128
    }

    // Invert if requested
    if (common.invertLayers) {
      gray = 255 - gray
    }

    gray = Math.min(255, Math.max(0, gray))

    data[i] = gray
    data[i + 1] = gray
    data[i + 2] = gray
  }

  ctx.putImageData(imageData, 0, 0)

  // Apply blur
  if (params.blurRadius > 0) {
    applyStackBlur(ctx, targetSize.width, targetSize.height, params.blurRadius)
  }

  return canvas
}

// ─── Layer 2: atmosphere layer (grayscale, more blur) ────────────────────────

async function generateLayer2(
  img: HTMLImageElement,
  params: ProcessParams['layer2'],
  common: ProcessParams['common'],
  targetSize: { width: number; height: number }
): Promise<HTMLCanvasElement> {
  const canvas = await resizeToTarget(img, targetSize)
  const ctx = getContext(canvas)
  const imageData = ctx.getImageData(0, 0, targetSize.width, targetSize.height)
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    // Grayscale
    let gray = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722

    // Gamma
    gray = Math.pow(gray / 255, params.gamma) * 255

    // Contrast
    gray = ((gray - 128) * params.contrast) + 128

    // Atmosphere - boost highlights
    if (gray > 180) {
      gray += (gray - 180) * params.atmosphereStrength
    }

    // Invert if requested
    if (common.invertLayers) {
      gray = 255 - gray
    }

    gray = Math.min(255, Math.max(0, gray))

    data[i] = gray
    data[i + 1] = gray
    data[i + 2] = gray
  }

  ctx.putImageData(imageData, 0, 0)

  // Apply stronger blur
  if (params.blurRadius > 0) {
    applyStackBlur(ctx, targetSize.width, targetSize.height, params.blurRadius)
  }

  return canvas
}

// ─── Preview generation: simulate backlight effect ───────────────────────────

async function generatePreview(
  coverCanvas: HTMLCanvasElement,
  layer1Canvas: HTMLCanvasElement,
  layer2Canvas: HTMLCanvasElement,
  targetSize: { width: number; height: number }
): Promise<HTMLCanvasElement> {
  const canvas = createCanvas(targetSize.width, targetSize.height)
  const ctx = getContext(canvas)

  // Draw cover as base
  ctx.drawImage(coverCanvas, 0, 0)

  // Add layer glows using screen blend mode
  ctx.globalCompositeOperation = 'screen'

  // Layer 1 glow
  ctx.drawImage(layer1Canvas, 0, 0)

  // Layer 2 glow (brighter)
  ctx.globalAlpha = 0.8
  ctx.drawImage(layer2Canvas, 0, 0)
  ctx.globalAlpha = 1.0

  // Reset composite
  ctx.globalCompositeOperation = 'source-over'

  // Final polish
  const imageData = ctx.getImageData(0, 0, targetSize.width, targetSize.height)
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    // Slight brightness boost
    data[i] = Math.min(255, data[i] * 1.05)
    data[i + 1] = Math.min(255, data[i + 1] * 1.05)
    data[i + 2] = Math.min(255, data[i + 2] * 1.05)
  }

  ctx.putImageData(imageData, 0, 0)

  return canvas
}

// ─── Stack Blur Algorithm (fast approximate Gaussian blur) ───────────────────

function applyStackBlur(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  radius: number
): void {
  if (radius < 1) return

  const imageData = ctx.getImageData(0, 0, width, height)
  const pixels = imageData.data

  const wm = width - 1
  const hm = height - 1
  const wh = width * height
  const r = Math.floor(radius)

  const rSum = new Int32Array(wh)
  const gSum = new Int32Array(wh)
  const bSum = new Int32Array(wh)

  const rOut = new Uint8Array(wh)
  const gOut = new Uint8Array(wh)
  const bOut = new Uint8Array(wh)

  const vmin = new Int32Array(Math.max(width, height))

  let yw = 0
  const mulSum = 1 / ((r + 1) * (r + 1))

  // Horizontal pass
  for (let y = 0; y < height; y++) {
    let rSumVal = 0, gSumVal = 0, bSumVal = 0

    for (let i = -r; i <= r; i++) {
      const p = yw + Math.min(wm, Math.max(i, 0)) << 2
      rSumVal += pixels[p]
      gSumVal += pixels[p + 1]
      bSumVal += pixels[p + 2]
    }

    for (let x = 0; x < width; x++) {
      const p = yw + x << 2
      rSum[p >> 2] = rSumVal
      gSum[p >> 2] = gSumVal
      bSum[p >> 2] = bSumVal

      if (y === 0) {
        vmin[x] = Math.min(x + r + 1, wm)
      }

      const p1 = yw + vmin[x] << 2
      const p2 = yw + Math.max(x - r, 0) << 2

      rSumVal += pixels[p1] - pixels[p2]
      gSumVal += pixels[p1 + 1] - pixels[p2 + 1]
      bSumVal += pixels[p1 + 2] - pixels[p2 + 2]
    }

    yw += width
  }

  // Vertical pass
  for (let x = 0; x < width; x++) {
    let rSumVal = 0, gSumVal = 0, bSumVal = 0

    for (let i = -r; i <= r; i++) {
      const yi = Math.min(hm, Math.max(i, 0)) * width + x
      rSumVal += rSum[yi]
      gSumVal += gSum[yi]
      bSumVal += bSum[yi]
    }

    for (let y = 0; y < height; y++) {
      const p = (y * width + x) << 2
      rOut[p >> 2] = Math.min(255, Math.floor(rSumVal * mulSum))
      gOut[p >> 2] = Math.min(255, Math.floor(gSumVal * mulSum))
      bOut[p >> 2] = Math.min(255, Math.floor(bSumVal * mulSum))

      if (x === 0) {
        vmin[y] = Math.min(y + r + 1, hm) * width
      }

      const yi1 = vmin[y] + x
      const yi2 = (Math.max(y - r, 0) * width + x)

      rSumVal += rSum[yi1] - rSum[yi2]
      gSumVal += gSum[yi1] - gSum[yi2]
      bSumVal += bSum[yi1] - bSum[yi2]
    }
  }

  // Write back
  for (let i = 0; i < wh; i++) {
    const p = i << 2
    pixels[p] = rOut[i]
    pixels[p + 1] = gOut[i]
    pixels[p + 2] = gOut[i]
  }

  ctx.putImageData(imageData, 0, 0)
}

// ─── Helper: canvas to base64 ────────────────────────────────────────────────

function canvasToBase64(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number
): string {
  return canvas.toDataURL(mimeType, quality)
}
