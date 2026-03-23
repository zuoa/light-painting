// 纯前端图像处理器 - 使用 HTMLCanvasElement
// 无需后端，图片不上传服务器

import type { ProcessParams, ProcessResult } from './types'
import { extractPortraitSubject } from './portraitExtractor'

function clamp8(value: number): number {
  return Math.min(255, Math.max(0, value))
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function createLuminanceMask(
  data: Uint8ClampedArray,
  width: number,
  height: number
): Float32Array {
  const mask = new Float32Array(width * height)

  for (let i = 0, p = 0; i < mask.length; i++, p += 4) {
    const lum = data[p] * 0.2126 + data[p + 1] * 0.7152 + data[p + 2] * 0.0722
    mask[i] = lum / 255
  }

  return mask
}

function blurMask(
  mask: Float32Array,
  width: number,
  height: number,
  radius: number
): Float32Array {
  const r = Math.max(0, Math.round(radius))
  if (r <= 0) return mask.slice()

  const horizontal = new Float32Array(mask.length)
  const output = new Float32Array(mask.length)

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width
    for (let x = 0; x < width; x++) {
      let sum = 0
      let count = 0
      for (let dx = -r; dx <= r; dx++) {
        const sx = Math.max(0, Math.min(width - 1, x + dx))
        sum += mask[rowOffset + sx]
        count++
      }
      horizontal[rowOffset + x] = sum / count
    }
  }

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width
    for (let x = 0; x < width; x++) {
      let sum = 0
      let count = 0
      for (let dy = -r; dy <= r; dy++) {
        const sy = Math.max(0, Math.min(height - 1, y + dy))
        sum += horizontal[sy * width + x]
        count++
      }
      output[rowOffset + x] = sum / count
    }
  }

  return output
}

function createEdgeMask(
  data: Uint8ClampedArray,
  width: number,
  height: number
): Float32Array {
  const lum = createLuminanceMask(data, width, height)
  const output = new Float32Array(width * height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      const left = lum[y * width + Math.max(0, x - 1)]
      const right = lum[y * width + Math.min(width - 1, x + 1)]
      const top = lum[Math.max(0, y - 1) * width + x]
      const bottom = lum[Math.min(height - 1, y + 1) * width + x]

      const gradient = Math.abs(right - left) + Math.abs(bottom - top)
      output[idx] = Math.min(1, gradient * 1.6)
    }
  }

  return output
}

function createSaturationMask(
  data: Uint8ClampedArray,
  width: number,
  height: number
): Float32Array {
  const output = new Float32Array(width * height)

  for (let i = 0, p = 0; i < output.length; i++, p += 4) {
    const maxValue = Math.max(data[p], data[p + 1], data[p + 2])
    const minValue = Math.min(data[p], data[p + 1], data[p + 2])
    output[i] = (maxValue - minValue) / 255
  }

  return output
}

function applyMaskBlur(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  radius: number
): void {
  if (radius <= 0) return
  applyStackBlur(ctx, width, height, radius)
}

// ─── Main entry point ────────────────────────────────────────────────────────

export async function processImageBrowser(
  file: File,
  params: ProcessParams
): Promise<ProcessResult> {
  // 1. 加载图片
  const bitmap = await loadImage(file)

  // 2. 计算目标尺寸
  const targetSize = getTargetSize(params.common)
  const sourceCanvas = await resizeToTarget(bitmap, targetSize)

  // 3. 生成四张图
  const coverCanvas = await generateCover(sourceCanvas, params.cover)
  const layer1Canvas = await generateLayer1(sourceCanvas, params.layer1, params.common)
  const layer2Canvas = await generateLayer2(sourceCanvas, params.layer2, params.common)
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

function cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = createCanvas(source.width, source.height)
  getContext(canvas).drawImage(source, 0, 0)
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

function applyCoverTone(canvas: HTMLCanvasElement, params: ProcessParams['cover']): void {
  const ctx = getContext(canvas)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i]
    let g = data[i + 1]
    let b = data[i + 2]

    const gray = r * 0.2126 + g * 0.7152 + b * 0.0722
    const saturation = 1 - params.saturationReduction
    r = gray * (1 - saturation) + r * saturation
    g = gray * (1 - saturation) + g * saturation
    b = gray * (1 - saturation) + b * saturation

    r *= params.brightness
    g *= params.brightness
    b *= params.brightness

    const warmthFactor = params.warmth / 100
    r += warmthFactor * 30
    b -= warmthFactor * 15

    const contrastFactor = params.contrast
    r = ((r - 128) * contrastFactor) + 128
    g = ((g - 128) * contrastFactor) + 128
    b = ((b - 128) * contrastFactor) + 128

    data[i] = clamp8(r)
    data[i + 1] = clamp8(g)
    data[i + 2] = clamp8(b)
  }

  ctx.putImageData(imageData, 0, 0)
}

function createScaledAnalysisCanvas(
  source: HTMLCanvasElement,
  maxDimension = 320
): HTMLCanvasElement {
  const scale = Math.min(1, maxDimension / Math.max(source.width, source.height))
  const width = Math.max(48, Math.round(source.width * scale))
  const height = Math.max(48, Math.round(source.height * scale))
  const canvas = createCanvas(width, height)
  const ctx = getContext(canvas)
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(source, 0, 0, width, height)
  return canvas
}

function createPortraitFocusMask(width: number, height: number): Float32Array {
  const mask = new Float32Array(width * height)

  for (let y = 0; y < height; y++) {
    const ny = (y + 0.5) / height
    for (let x = 0; x < width; x++) {
      const nx = (x + 0.5) / width
      const dx = (nx - 0.5) / 0.5
      const dy = (ny - 0.46) / 0.84
      const ellipse = 1 - smoothstep(0.18, 1.04, Math.sqrt(dx * dx + dy * dy))

      const headDx = (nx - 0.5) / 0.3
      const headDy = (ny - 0.28) / 0.22
      const headBias = 1 - smoothstep(0.12, 1.0, Math.sqrt(headDx * headDx + headDy * headDy))

      mask[y * width + x] = clamp01(ellipse * 0.78 + headBias * 0.22)
    }
  }

  return mask
}

function createAlphaCanvasFromMask(
  mask: Float32Array,
  width: number,
  height: number
): HTMLCanvasElement {
  const canvas = createCanvas(width, height)
  const ctx = getContext(canvas)
  const imageData = ctx.createImageData(width, height)

  for (let i = 0, p = 0; i < mask.length; i++, p += 4) {
    const alpha = clamp8(Math.round(clamp01(mask[i]) * 255))
    imageData.data[p] = 255
    imageData.data[p + 1] = 255
    imageData.data[p + 2] = 255
    imageData.data[p + 3] = alpha
  }

  ctx.putImageData(imageData, 0, 0)
  return canvas
}

function findSubjectBounds(
  mask: Float32Array,
  width: number,
  height: number,
  threshold: number
): { x: number; y: number; width: number; height: number } | null {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  let count = 0

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = mask[y * width + x]
      if (value < threshold) continue
      count++
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }

  if (count < Math.max(24, (width * height) / 400)) return null

  const rawWidth = maxX - minX + 1
  const rawHeight = maxY - minY + 1
  const expandX = Math.max(4, rawWidth * 0.18)
  const expandTop = Math.max(6, rawHeight * 0.18)
  const expandBottom = Math.max(6, rawHeight * 0.12)

  const x = Math.max(0, minX - expandX)
  const y = Math.max(0, minY - expandTop)
  const boxWidth = Math.min(width - x, rawWidth + expandX * 2)
  const boxHeight = Math.min(height - y, rawHeight + expandTop + expandBottom)

  return { x, y, width: boxWidth, height: boxHeight }
}

function createPortraitSubjectMask(
  sourceCanvas: HTMLCanvasElement
): {
  maskCanvas: HTMLCanvasElement
  bounds: { x: number; y: number; width: number; height: number }
} {
  const analysisCanvas = createScaledAnalysisCanvas(sourceCanvas)
  const width = analysisCanvas.width
  const height = analysisCanvas.height
  const ctx = getContext(analysisCanvas)
  const { data } = ctx.getImageData(0, 0, width, height)

  const luminance = createLuminanceMask(data, width, height)
  const smoothedLuminance = blurMask(luminance, width, height, 16)
  const edgeMask = blurMask(createEdgeMask(data, width, height), width, height, 2)
  const saturationMask = blurMask(createSaturationMask(data, width, height), width, height, 3)
  const focusMask = createPortraitFocusMask(width, height)
  const saliency = new Float32Array(width * height)

  for (let i = 0; i < saliency.length; i++) {
    const detail = Math.min(1, Math.abs(luminance[i] - smoothedLuminance[i]) * 4.4)
    const edges = Math.min(1, edgeMask[i] * 1.4)
    const saturation = saturationMask[i] * 0.75
    const midtone = 1 - Math.min(1, Math.abs(luminance[i] - 0.56) / 0.56)
    const structure = edges * 0.42 + detail * 0.3 + saturation * 0.14 + midtone * 0.14
    saliency[i] = clamp01(structure * (0.4 + focusMask[i] * 0.9))
  }

  const blurredSaliency = blurMask(saliency, width, height, 9)
  let saliencySum = 0
  let saliencyMax = 0

  for (let i = 0; i < blurredSaliency.length; i++) {
    saliencySum += blurredSaliency[i]
    if (blurredSaliency[i] > saliencyMax) saliencyMax = blurredSaliency[i]
  }

  const saliencyAvg = saliencySum / blurredSaliency.length
  const threshold = saliencyAvg + (saliencyMax - saliencyAvg) * 0.24
  const matte = new Float32Array(width * height)

  for (let i = 0; i < matte.length; i++) {
    const subject = smoothstep(threshold * 0.78, Math.max(threshold * 1.08, threshold + 0.05), blurredSaliency[i])
    matte[i] = clamp01(subject * (0.72 + focusMask[i] * 0.38))
  }

  const finalMatte = blurMask(matte, width, height, 4)
  const fallbackBounds = {
    x: width * 0.18,
    y: height * 0.08,
    width: width * 0.64,
    height: height * 0.82,
  }
  const bounds = findSubjectBounds(finalMatte, width, height, 0.16) ?? fallbackBounds

  return {
    maskCanvas: createAlphaCanvasFromMask(finalMatte, width, height),
    bounds,
  }
}

function createPaperBackground(
  width: number,
  height: number,
  warmth: number
): HTMLCanvasElement {
  const canvas = createCanvas(width, height)
  const ctx = getContext(canvas)
  const warmthFactor = warmth / 100
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, `rgb(${Math.round(236 + warmthFactor * 10)}, ${Math.round(231 + warmthFactor * 4)}, ${Math.round(225 - warmthFactor * 4)})`)
  gradient.addColorStop(1, `rgb(${Math.round(214 + warmthFactor * 14)}, ${Math.round(206 + warmthFactor * 8)}, ${Math.round(196 - warmthFactor * 8)})`)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  const glow = ctx.createRadialGradient(width * 0.5, height * 0.34, width * 0.06, width * 0.5, height * 0.34, width * 0.72)
  glow.addColorStop(0, 'rgba(255,255,255,0.28)')
  glow.addColorStop(0.55, 'rgba(255,248,240,0.10)')
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, width, height)

  const vignette = ctx.createRadialGradient(width * 0.5, height * 0.5, width * 0.2, width * 0.5, height * 0.5, width * 0.86)
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, 'rgba(82,65,50,0.14)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, width, height)

  return canvas
}

// ─── Cover generation: warm-gray style ───────────────────────────────────────

async function generateCover(
  sourceCanvas: HTMLCanvasElement,
  params: ProcessParams['cover']
): Promise<HTMLCanvasElement> {
  const canvas = cloneCanvas(sourceCanvas)
  applyCoverTone(canvas, params)

  if (!params.extractSubject) {
    return canvas
  }

  const { width, height } = canvas
  let subjectCanvas: HTMLCanvasElement
  let subjectBounds: { x: number; y: number; width: number; height: number }

  try {
    const extracted = await extractPortraitSubject(canvas)
    subjectCanvas = extracted.canvas
    subjectBounds = extracted.bounds
  } catch (error) {
    console.warn('[cover] Portrait model extraction failed, falling back to heuristic mask.', error)
    const { maskCanvas, bounds } = createPortraitSubjectMask(sourceCanvas)
    const fullMaskCanvas = createCanvas(width, height)
    const fullMaskCtx = getContext(fullMaskCanvas)
    fullMaskCtx.imageSmoothingEnabled = true
    fullMaskCtx.drawImage(maskCanvas, 0, 0, width, height)

    subjectCanvas = cloneCanvas(canvas)
    const subjectCtx = getContext(subjectCanvas)
    subjectCtx.globalCompositeOperation = 'destination-in'
    subjectCtx.drawImage(fullMaskCanvas, 0, 0)
    subjectCtx.globalCompositeOperation = 'source-over'
    subjectBounds = {
      x: (bounds.x / maskCanvas.width) * width,
      y: (bounds.y / maskCanvas.height) * height,
      width: (bounds.width / maskCanvas.width) * width,
      height: (bounds.height / maskCanvas.height) * height,
    }
  }

  const output = createPaperBackground(width, height, params.warmth)
  const outputCtx = getContext(output)
  const sourceCenterX = subjectBounds.x + subjectBounds.width / 2
  const sourceCenterY = subjectBounds.y + subjectBounds.height / 2
  const scale = Math.min((width * 0.7) / subjectBounds.width, (height * 0.84) / subjectBounds.height, 1.28)
  const destCenterX = width * 0.5
  const destCenterY = height * 0.56

  const halo = outputCtx.createRadialGradient(
    destCenterX,
    destCenterY - height * 0.06,
    width * 0.08,
    destCenterX,
    destCenterY - height * 0.04,
    width * 0.4
  )
  halo.addColorStop(0, 'rgba(255,249,240,0.34)')
  halo.addColorStop(0.7, 'rgba(255,246,235,0.08)')
  halo.addColorStop(1, 'rgba(255,255,255,0)')
  outputCtx.fillStyle = halo
  outputCtx.fillRect(0, 0, width, height)

  outputCtx.save()
  outputCtx.translate(destCenterX, destCenterY)
  outputCtx.scale(scale, scale)
  outputCtx.translate(-sourceCenterX, -sourceCenterY)
  outputCtx.shadowColor = 'rgba(74, 54, 36, 0.26)'
  outputCtx.shadowBlur = 28
  outputCtx.shadowOffsetY = 16
  outputCtx.drawImage(subjectCanvas, 0, 0)
  outputCtx.restore()

  outputCtx.save()
  outputCtx.translate(destCenterX, destCenterY)
  outputCtx.scale(scale, scale)
  outputCtx.translate(-sourceCenterX, -sourceCenterY)
  outputCtx.drawImage(subjectCanvas, 0, 0)
  outputCtx.restore()

  return output
}

// ─── Layer 1: detail layer (color) ───────────────────────────────────────────

async function generateLayer1(
  sourceCanvas: HTMLCanvasElement,
  params: ProcessParams['layer1'],
  common: ProcessParams['common']
): Promise<HTMLCanvasElement> {
  const canvas = cloneCanvas(sourceCanvas)
  const ctx = getContext(canvas)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  const width = canvas.width
  const height = canvas.height
  const subjectMask = blurMask(createLuminanceMask(data, width, height), width, height, 12)
  const edgeMask = blurMask(createEdgeMask(data, width, height), width, height, 1)

  for (let i = 0; i < data.length; i += 4) {
    const idx = i >> 2
    let r = data[i]
    let g = data[i + 1]
    let b = data[i + 2]

    const lum = r * 0.2126 + g * 0.7152 + b * 0.0722
    if (lum === 0) continue
    const lumNorm = lum / 255

    const subjectFocus = smoothstep(0.12, 0.78, subjectMask[idx])
    const edgeBoost = edgeMask[idx] * params.edgeStrength
    const middleBand = 1 - Math.min(1, Math.abs(lumNorm - 0.52) / 0.52)
    const structureWeight = Math.max(subjectFocus * 0.75, middleBand * 0.55)

    let lumGamma = Math.pow(lumNorm, params.gamma)
    lumGamma = lerp(lumNorm, lumGamma, 0.72)

    let lumFinal = ((lumGamma * 255 - 128) * params.contrast) + 128

    if (lumFinal < 128) {
      lumFinal = Math.pow(lumFinal / 128, 1 + params.shadowCrush) * 128
    }

    lumFinal *= lerp(0.38, 1.12, structureWeight)
    lumFinal += edgeBoost * 72

    if (common.invertLayers) {
      lumFinal = 255 - lumFinal
    }

    lumFinal = clamp8(lumFinal)
    const ratio = lumFinal / lum
    const desat = lerp(1, 0.72, subjectFocus)

    data[i] = clamp8(r * ratio * desat)
    data[i + 1] = clamp8(g * ratio * desat)
    data[i + 2] = clamp8(b * ratio * (desat + 0.08))
  }

  ctx.putImageData(imageData, 0, 0)

  applyMaskBlur(ctx, width, height, params.blurRadius)

  return canvas
}

// ─── Layer 2: atmosphere layer (color, more blur) ────────────────────────────

async function generateLayer2(
  sourceCanvas: HTMLCanvasElement,
  params: ProcessParams['layer2'],
  common: ProcessParams['common']
): Promise<HTMLCanvasElement> {
  const canvas = cloneCanvas(sourceCanvas)
  const ctx = getContext(canvas)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  const width = canvas.width
  const height = canvas.height
  const baseLumMask = createLuminanceMask(data, width, height)
  const glowMask = blurMask(baseLumMask, width, height, Math.max(8, Math.round(params.highlightSpread * 24)))

  for (let i = 0; i < data.length; i += 4) {
    const idx = i >> 2
    let r = data[i]
    let g = data[i + 1]
    let b = data[i + 2]

    const lum = r * 0.2126 + g * 0.7152 + b * 0.0722
    if (lum === 0) continue
    const lumNorm = lum / 255

    let lumFinal = Math.pow(lumNorm, params.gamma) * 255

    lumFinal = ((lumFinal - 128) * params.contrast) + 128

    const glow = smoothstep(0.35, 0.92, glowMask[idx])
    const warmFocus = smoothstep(0.45, 0.95, lumNorm)
    const atmosphere = glow * (0.65 + params.atmosphereStrength * 0.7)
    lumFinal = lerp(lumFinal, 255, atmosphere * 0.68)
    lumFinal += warmFocus * params.atmosphereStrength * 26

    let nr = r * 0.35 + lumFinal * 0.65
    let ng = g * 0.3 + lumFinal * 0.56
    let nb = b * 0.42 + lumFinal * 0.35

    nr += glow * (18 + params.atmosphereStrength * 22)
    ng += glow * (8 + params.atmosphereStrength * 8)
    nb -= glow * 10

    if (common.invertLayers) {
      nr = 255 - nr
      ng = 255 - ng
      nb = 255 - nb
    }

    data[i] = clamp8(nr)
    data[i + 1] = clamp8(ng)
    data[i + 2] = clamp8(nb)
  }

  ctx.putImageData(imageData, 0, 0)

  applyMaskBlur(ctx, width, height, params.blurRadius)

  return canvas
}

// ─── Preview generation: simulate backlight effect ───────────────────────────

async function generatePreview(
  coverCanvas: HTMLCanvasElement,
  layer1Canvas: HTMLCanvasElement,
  layer2Canvas: HTMLCanvasElement,
  targetSize: { width: number; height: number }
): Promise<HTMLCanvasElement> {
  const { width, height } = targetSize
  const canvas = createCanvas(width, height)
  const ctx = getContext(canvas)

  const lightCanvas = createCanvas(width, height)
  const lightCtx = getContext(lightCanvas)

  lightCtx.fillStyle = '#000'
  lightCtx.fillRect(0, 0, width, height)

  // Simulate the light source first hitting the back layer, then being refined by the front layer.
  lightCtx.globalCompositeOperation = 'source-over'
  lightCtx.globalAlpha = 0.72
  lightCtx.drawImage(layer2Canvas, 0, 0)
  lightCtx.globalCompositeOperation = 'screen'
  lightCtx.globalAlpha = 0.88
  lightCtx.drawImage(layer1Canvas, 0, 0)
  lightCtx.globalAlpha = 1
  lightCtx.globalCompositeOperation = 'source-over'

  // Slight diffusion to mimic projection spread between layers and cover.
  applyMaskBlur(lightCtx, width, height, 4)

  const coverData = getContext(coverCanvas).getImageData(0, 0, width, height)
  const lightData = lightCtx.getImageData(0, 0, width, height)
  const output = ctx.createImageData(width, height)
  const out = output.data

  for (let i = 0; i < out.length; i += 4) {
    const coverR = coverData.data[i] / 255
    const coverG = coverData.data[i + 1] / 255
    const coverB = coverData.data[i + 2] / 255
    const lightR = lightData.data[i] / 255
    const lightG = lightData.data[i + 1] / 255
    const lightB = lightData.data[i + 2] / 255

    const coverLum = coverR * 0.2126 + coverG * 0.7152 + coverB * 0.0722
    const lightLum = lightR * 0.2126 + lightG * 0.7152 + lightB * 0.0722

    // Let projected color dominate more clearly while the cover still acts as the receiving surface.
    const receiving = lerp(0.56, 1.0, coverLum)
    const projectionStrength = 0.34 + lightLum * 0.88

    const projectedR = lightR * projectionStrength * receiving
    const projectedG = lightG * projectionStrength * receiving
    const projectedB = lightB * projectionStrength * receiving

    const paperR = coverR * 0.44
    const paperG = coverG * 0.44
    const paperB = coverB * 0.44

    let litR = 1 - (1 - paperR) * (1 - Math.min(1, projectedR))
    let litG = 1 - (1 - paperG) * (1 - Math.min(1, projectedG))
    let litB = 1 - (1 - paperB) * (1 - Math.min(1, projectedB))

    litR += coverR * lightLum * 0.08
    litG += coverG * lightLum * 0.08
    litB += coverB * lightLum * 0.06

    ;[litR, litG, litB] = boostPreviewColor(
      Math.min(1, litR),
      Math.min(1, litG),
      Math.min(1, litB)
    )

    out[i] = compressPreviewChannel(clamp8(Math.round(litR * 255)))
    out[i + 1] = compressPreviewChannel(clamp8(Math.round(litG * 255)))
    out[i + 2] = compressPreviewChannel(clamp8(Math.round(litB * 255)))
    out[i + 3] = 255
  }

  ctx.putImageData(output, 0, 0)
  return canvas
}

function compressPreviewChannel(value: number): number {
  let v = (value / 255) * 0.97

  if (v > 0.62) {
    v = 0.62 + (v - 0.62) * 0.52
  }

  if (v > 0.84) {
    v = 0.84 + (v - 0.84) * 0.35
  }

  return clamp8(Math.round(v * 255))
}

function boostPreviewColor(r: number, g: number, b: number): [number, number, number] {
  const lum = r * 0.2126 + g * 0.7152 + b * 0.0722
  const maxChannel = Math.max(r, g, b)
  const minChannel = Math.min(r, g, b)
  const chroma = maxChannel - minChannel
  const vibrance = 0.14 + (1 - Math.min(1, chroma / 0.4)) * 0.18

  return [
    Math.max(0, Math.min(1, lerp(lum, r, 1 + vibrance))),
    Math.max(0, Math.min(1, lerp(lum, g, 1 + vibrance))),
    Math.max(0, Math.min(1, lerp(lum, b, 1 + vibrance))),
  ]
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
  const mulSum = 1 / ((2 * r + 1) * (2 * r + 1))

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
    pixels[p + 2] = bOut[i]
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
