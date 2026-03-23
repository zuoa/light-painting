// ─── Output size presets ─────────────────────────────────────────────────────

export type SizePreset = '7inch' | '8inch' | 'custom'

export interface OutputSize {
  width: number
  height: number
  label: string
}

export const SIZE_PRESETS: Record<SizePreset, OutputSize> = {
  '7inch': { width: 1500, height: 2100, label: '7寸 (1500×2100)' },
  '8inch': { width: 1800, height: 2400, label: '8寸 (1800×2400)' },
  custom: { width: 1500, height: 2100, label: '自定义' },
}

// ─── Parameter types ──────────────────────────────────────────────────────────

export interface CoverParams {
  /** 0 = original color, 1 = full grayscale */
  saturationReduction: number
  /** Brightness multiplier, 1.0 = no change */
  brightness: number
  /** Contrast multiplier, 1.0 = no change */
  contrast: number
  /** Warm color boost: red channel +warmth, blue channel -warmth/2 (0–50) */
  warmth: number
  /** Sharpen sigma (0 = off, higher = sharper) */
  sharpness: number
  /** Extract the centered portrait subject onto a paper-like background */
  extractSubject: boolean
}

export interface Layer1Params {
  /** Gamma correction exponent (>1 = darker midtones, <1 = lighter) */
  gamma: number
  /** Contrast multiplier */
  contrast: number
  /** Gaussian blur sigma in pixels */
  blurRadius: number
  /** Shadow crush: push darks further down (0–1) */
  shadowCrush: number
  /** Edge enhancement amount (0 = off, 1 = strong) */
  edgeStrength: number
}

export interface Layer2Params {
  /** Gamma correction */
  gamma: number
  /** Contrast multiplier */
  contrast: number
  /** Gaussian blur sigma — higher than layer1 */
  blurRadius: number
  /** Atmosphere / glow strength (0–1) */
  atmosphereStrength: number
  /** Highlight spread radius multiplier */
  highlightSpread: number
}

export interface CommonParams {
  sizePreset: SizePreset
  customWidth: number
  customHeight: number
  autoCrop: boolean
  /** Invert grayscale layers (black = transparent, white = opaque) */
  invertLayers: boolean
  generatePreview: boolean
}

export interface ProcessParams {
  cover: CoverParams
  layer1: Layer1Params
  layer2: Layer2Params
  common: CommonParams
}

// ─── API types ────────────────────────────────────────────────────────────────

export interface ProcessResult {
  cover: string   // base64 PNG
  layer1: string  // base64 PNG
  layer2: string  // base64 PNG
  preview: string // base64 JPEG
}

export interface ProcessResponse {
  success: true
  data: ProcessResult
}

export interface ErrorResponse {
  success: false
  error: string
}

// ─── Style presets ────────────────────────────────────────────────────────────

export interface StylePreset {
  id: string
  label: string
  description: string
  params: ProcessParams
}
