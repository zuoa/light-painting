import type { Config } from '@imgly/background-removal'

const MODEL_CONFIG: Config = {
  model: 'isnet_fp16',
  output: {
    format: 'image/png',
    quality: 1,
  },
}

let preloadPromise: Promise<void> | null = null

function resolveModelPublicPath(): string | undefined {
  if (typeof document === 'undefined') return undefined
  return new URL('background-removal/', document.baseURI).toString()
}

function getModelConfig(progress?: Config['progress']): Config {
  const publicPath = resolveModelPublicPath()
  return {
    ...MODEL_CONFIG,
    ...(publicPath ? { publicPath } : {}),
    ...(progress ? { progress } : {}),
  }
}

async function ensureModelLoaded(progress?: Config['progress']): Promise<void> {
  if (!preloadPromise) {
    preloadPromise = (async () => {
      const { preload } = await import('@imgly/background-removal')
      await preload(getModelConfig(progress))
    })().catch((error) => {
      preloadPromise = null
      throw error
    })
  }

  await preloadPromise
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to decode extracted portrait image'))
    }

    img.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
        return
      }
      reject(new Error('Failed to encode portrait source canvas'))
    }, 'image/png')
  })
}

function findAlphaBounds(
  alpha: Uint8ClampedArray,
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
      const value = alpha[(y * width + x) * 4 + 3]
      if (value < threshold) continue
      count++
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }

  if (count < Math.max(32, (width * height) / 1200)) return null

  const rawWidth = maxX - minX + 1
  const rawHeight = maxY - minY + 1
  const expandX = Math.max(6, rawWidth * 0.08)
  const expandTop = Math.max(8, rawHeight * 0.12)
  const expandBottom = Math.max(8, rawHeight * 0.08)
  const x = Math.max(0, minX - expandX)
  const y = Math.max(0, minY - expandTop)
  const boxWidth = Math.min(width - x, rawWidth + expandX * 2)
  const boxHeight = Math.min(height - y, rawHeight + expandTop + expandBottom)

  return { x, y, width: boxWidth, height: boxHeight }
}

export interface ExtractedPortrait {
  canvas: HTMLCanvasElement
  bounds: { x: number; y: number; width: number; height: number }
}

export async function extractPortraitSubject(
  sourceCanvas: HTMLCanvasElement,
  progress?: Config['progress']
): Promise<ExtractedPortrait> {
  await ensureModelLoaded(progress)

  const { removeBackground } = await import('@imgly/background-removal')
  const sourceBlob = await canvasToBlob(sourceCanvas)
  const foregroundBlob = await removeBackground(sourceBlob, getModelConfig(progress))
  const foregroundImage = await loadImageFromBlob(foregroundBlob)

  const canvas = createCanvas(sourceCanvas.width, sourceCanvas.height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Failed to create portrait extraction canvas')
  ctx.drawImage(foregroundImage, 0, 0, canvas.width, canvas.height)

  const bounds = findAlphaBounds(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, 24)
  if (!bounds) {
    throw new Error('Portrait model did not detect a stable foreground subject')
  }

  return { canvas, bounds }
}
