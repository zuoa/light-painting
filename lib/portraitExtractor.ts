import type { Config } from '@imgly/background-removal'
import type { ManualMaskGuide } from './types'

const MODEL_ASSET_REVISION = '20260324-ort-cache-bust-1'

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

function toCacheBustedUrl(value: string | URL, publicPath: string): string {
  const url = new URL(typeof value === 'string' ? value : value.toString(), document.baseURI)
  if (!url.toString().startsWith(publicPath)) {
    return url.toString()
  }

  url.searchParams.set('v', MODEL_ASSET_REVISION)
  return url.toString()
}

async function withPatchedAssetFetch<T>(publicPath: string | undefined, task: () => Promise<T>): Promise<T> {
  if (!publicPath || typeof window === 'undefined') {
    return task()
  }

  const originalFetch = window.fetch.bind(window)
  const patchedFetch: typeof fetch = (input, init) => {
    if (typeof input === 'string' || input instanceof URL) {
      const url = toCacheBustedUrl(input, publicPath)
      return originalFetch(url, { cache: 'no-store', ...init })
    }

    const url = toCacheBustedUrl(input.url, publicPath)
    const request = new Request(url, input)
    return originalFetch(request, { cache: 'no-store', ...init })
  }

  window.fetch = patchedFetch

  try {
    return await task()
  } finally {
    window.fetch = originalFetch
  }
}

async function verifyModelAssets(publicPath?: string): Promise<void> {
  if (!publicPath) return

  const resourceUrl = new URL('resources.json', publicPath)
  resourceUrl.searchParams.set('v', MODEL_ASSET_REVISION)
  const response = await fetch(resourceUrl, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`模型资源清单不可访问: ${response.status} ${response.statusText} (${resourceUrl.toString()})`)
  }
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
      const config = getModelConfig(progress)
      await verifyModelAssets(config.publicPath)
      const { preload } = await import('@imgly/background-removal')
      await withPatchedAssetFetch(config.publicPath, () => preload(config))
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

function scoreComponent(
  count: number,
  centroidX: number,
  centroidY: number,
  width: number,
  height: number,
  touchesEdge: boolean
): number {
  const nx = centroidX / Math.max(1, width)
  const ny = centroidY / Math.max(1, height)
  const centerDx = (nx - 0.5) / 0.38
  const centerDy = (ny - 0.46) / 0.5
  const centerWeight = 1 - Math.min(1, Math.sqrt(centerDx * centerDx + centerDy * centerDy))
  const edgeWeight = touchesEdge ? 0.84 : 1

  return count * (0.7 + centerWeight * 0.95) * edgeWeight
}

function collectPrimarySeedPixels(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
  threshold: number
): number[] | null {
  const visited = new Uint8Array(width * height)
  const queue = new Int32Array(width * height)
  let bestPixels: number[] | null = null
  let bestScore = -1

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const start = y * width + x
      if (visited[start] || alpha[start * 4 + 3] < threshold) continue

      let head = 0
      let tail = 0
      let count = 0
      let sumX = 0
      let sumY = 0
      let touchesEdge = false
      const pixels: number[] = []

      visited[start] = 1
      queue[tail++] = start

      while (head < tail) {
        const index = queue[head++]
        const px = index % width
        const py = (index - px) / width

        pixels.push(index)
        count++
        sumX += px + 0.5
        sumY += py + 0.5
        if (px === 0 || px === width - 1 || py === 0 || py === height - 1) touchesEdge = true

        for (let ny = Math.max(0, py - 1); ny <= Math.min(height - 1, py + 1); ny++) {
          for (let nx = Math.max(0, px - 1); nx <= Math.min(width - 1, px + 1); nx++) {
            const next = ny * width + nx
            if (visited[next] || alpha[next * 4 + 3] < threshold) continue
            visited[next] = 1
            queue[tail++] = next
          }
        }
      }

      const score = scoreComponent(count, sumX / count, sumY / count, width, height, touchesEdge)
      if (score > bestScore) {
        bestScore = score
        bestPixels = pixels
      }
    }
  }

  return bestPixels
}

function expandSelectionFromSeeds(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
  seedPixels: number[],
  threshold: number
): Uint8Array {
  const selected = new Uint8Array(width * height)
  const queue = new Int32Array(width * height)
  let head = 0
  let tail = 0

  for (const pixel of seedPixels) {
    selected[pixel] = 1
    queue[tail++] = pixel
  }

  while (head < tail) {
    const index = queue[head++]
    const px = index % width
    const py = (index - px) / width

    for (let ny = Math.max(0, py - 1); ny <= Math.min(height - 1, py + 1); ny++) {
      for (let nx = Math.max(0, px - 1); nx <= Math.min(width - 1, px + 1); nx++) {
        const next = ny * width + nx
        if (selected[next] || alpha[next * 4 + 3] < threshold) continue
        selected[next] = 1
        queue[tail++] = next
      }
    }
  }

  return selected
}

async function loadGuideMask(
  src: string | null,
  width: number,
  height: number
): Promise<Uint8Array | null> {
  if (!src) return null

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load manual mask guide'))
    img.src = src
  })

  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  ctx.drawImage(image, 0, 0, width, height)
  const data = ctx.getImageData(0, 0, width, height).data
  const mask = new Uint8Array(width * height)
  let hasPaint = false

  for (let i = 0, p = 0; i < mask.length; i++, p += 4) {
    if (data[p + 3] < 8) continue
    mask[i] = 1
    hasPaint = true
  }

  return hasPaint ? mask : null
}

function getGuideSeeds(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
  guideMask: Uint8Array | null
): number[] | null {
  if (!guideMask) return null

  for (const threshold of [80, 48, 24]) {
    const seeds: number[] = []
    for (let i = 0; i < guideMask.length; i++) {
      if (!guideMask[i] || alpha[i * 4 + 3] < threshold) continue
      seeds.push(i)
    }
    if (seeds.length > 0) return seeds
  }

  return null
}

function applyGuideRemoval(imageData: ImageData, removeMask: Uint8Array | null): void {
  if (!removeMask) return

  for (let i = 0, p = 0; i < removeMask.length; i++, p += 4) {
    if (!removeMask[i]) continue
    imageData.data[p] = 0
    imageData.data[p + 1] = 0
    imageData.data[p + 2] = 0
    imageData.data[p + 3] = 0
  }
}

function isolatePrimarySubject(
  canvas: HTMLCanvasElement,
  guideMasks?: {
    keepMask: Uint8Array | null
    removeMask: Uint8Array | null
  }
): void {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Failed to isolate portrait subject')

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const alpha = imageData.data
  const guidedSeeds = getGuideSeeds(alpha, canvas.width, canvas.height, guideMasks?.keepMask ?? null)
  const strongSeeds =
    guidedSeeds ??
    collectPrimarySeedPixels(alpha, canvas.width, canvas.height, 80) ??
    collectPrimarySeedPixels(alpha, canvas.width, canvas.height, 48) ??
    collectPrimarySeedPixels(alpha, canvas.width, canvas.height, 24)

  if (!strongSeeds) return

  const selected = expandSelectionFromSeeds(alpha, canvas.width, canvas.height, strongSeeds, 18)

  for (let i = 0, p = 0; i < selected.length; i++, p += 4) {
    if (selected[i]) continue
    imageData.data[p] = 0
    imageData.data[p + 1] = 0
    imageData.data[p + 2] = 0
    imageData.data[p + 3] = 0
  }

  applyGuideRemoval(imageData, guideMasks?.removeMask ?? null)

  if (!guidedSeeds && guideMasks?.removeMask) {
    const refinedSeeds =
      collectPrimarySeedPixels(imageData.data, canvas.width, canvas.height, 80) ??
      collectPrimarySeedPixels(imageData.data, canvas.width, canvas.height, 48) ??
      collectPrimarySeedPixels(imageData.data, canvas.width, canvas.height, 24)

    if (refinedSeeds) {
      const refined = expandSelectionFromSeeds(imageData.data, canvas.width, canvas.height, refinedSeeds, 18)
      for (let i = 0, p = 0; i < refined.length; i++, p += 4) {
        if (refined[i]) continue
        imageData.data[p] = 0
        imageData.data[p + 1] = 0
        imageData.data[p + 2] = 0
        imageData.data[p + 3] = 0
      }
    }
  }

  ctx.putImageData(imageData, 0, 0)
}

export interface ExtractedPortrait {
  canvas: HTMLCanvasElement
  bounds: { x: number; y: number; width: number; height: number }
}

export async function extractPortraitSubject(
  sourceCanvas: HTMLCanvasElement,
  progress?: Config['progress'],
  manualGuide?: ManualMaskGuide | null
): Promise<ExtractedPortrait> {
  await ensureModelLoaded(progress)

  const { removeBackground } = await import('@imgly/background-removal')
  const sourceBlob = await canvasToBlob(sourceCanvas)
  const config = getModelConfig(progress)
  const foregroundBlob = await withPatchedAssetFetch(config.publicPath, () => removeBackground(sourceBlob, config))
  const foregroundImage = await loadImageFromBlob(foregroundBlob)

  const canvas = createCanvas(sourceCanvas.width, sourceCanvas.height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Failed to create portrait extraction canvas')
  ctx.drawImage(foregroundImage, 0, 0, canvas.width, canvas.height)

  const guideMasks = manualGuide
    ? {
        keepMask: await loadGuideMask(manualGuide.keepMask, canvas.width, canvas.height),
        removeMask: await loadGuideMask(manualGuide.removeMask, canvas.width, canvas.height),
      }
    : undefined

  isolatePrimarySubject(canvas, guideMasks)

  const bounds = findAlphaBounds(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, 24)
  if (!bounds) {
    throw new Error('Portrait model did not detect a stable foreground subject')
  }

  return { canvas, bounds }
}
