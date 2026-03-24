import type { ProcessParams, StylePreset } from './types'

// ─── Default parameters (portrait, 7-inch, warm-gray style) ──────────────────

export const DEFAULT_PARAMS: ProcessParams = {
  cover: {
    mode: 'tone',
    saturationReduction: 0.86,
    brightness: 0.99,
    contrast: 1.1,
    warmth: 10,
    sharpness: 0.6,
    extractSubject: true,
  },
  layer1: {
    gamma: 1.25,
    contrast: 1.35,
    blurRadius: 0.9,
    shadowCrush: 0.28,
    edgeStrength: 0.18,
  },
  layer2: {
    gamma: 1.55,
    contrast: 1.08,
    blurRadius: 3.5,
    atmosphereStrength: 0.75,
    highlightSpread: 0.6,
  },
  common: {
    sizePreset: '7inch',
    customWidth: 1500,
    customHeight: 2100,
    autoCrop: true,
    invertLayers: false,
    generatePreview: true,
  },
}

// ─── Style presets ────────────────────────────────────────────────────────────

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'portrait',
    label: '人物纪念版',
    description: '适合人像、偏暖灰、细节清晰',
    params: DEFAULT_PARAMS,
  },
  {
    id: 'dreamy',
    label: '梦幻氛围版',
    description: '柔和朦胧、高光扩散、适合风景',
    params: {
      cover: {
        mode: 'tone',
        saturationReduction: 0.88,
        brightness: 1.0,
        contrast: 1.06,
        warmth: 12,
        sharpness: 0.3,
        extractSubject: false,
      },
      layer1: {
        gamma: 1.4,
        contrast: 1.2,
        blurRadius: 1.5,
        shadowCrush: 0.2,
        edgeStrength: 0.1,
      },
      layer2: {
        gamma: 1.8,
        contrast: 1.0,
        blurRadius: 6.0,
        atmosphereStrength: 0.9,
        highlightSpread: 0.8,
      },
      common: {
        sizePreset: '7inch',
        customWidth: 1500,
        customHeight: 2100,
        autoCrop: true,
        invertLayers: false,
        generatePreview: true,
      },
    },
  },
  {
    id: 'illustration',
    label: '插画柔光版',
    description: '对比更强、适合线条感强的图',
    params: {
      cover: {
        mode: 'tone',
        saturationReduction: 0.72,
        brightness: 1.0,
        contrast: 1.16,
        warmth: 8,
        sharpness: 1.0,
        extractSubject: false,
      },
      layer1: {
        gamma: 1.1,
        contrast: 1.5,
        blurRadius: 0.5,
        shadowCrush: 0.4,
        edgeStrength: 0.35,
      },
      layer2: {
        gamma: 1.3,
        contrast: 1.15,
        blurRadius: 2.5,
        atmosphereStrength: 0.6,
        highlightSpread: 0.45,
      },
      common: {
        sizePreset: '7inch',
        customWidth: 1500,
        customHeight: 2100,
        autoCrop: true,
        invertLayers: false,
        generatePreview: true,
      },
    },
  },
]

// ─── Parameter metadata (for UI rendering) ───────────────────────────────────

export const PARAM_META = {
  cover: {
    saturationReduction: { label: '去色程度', min: 0, max: 1, step: 0.01, tip: '0=原色，1=完全灰度' },
    brightness: { label: '亮度', min: 0.7, max: 1.5, step: 0.01, tip: '1.0为原始亮度' },
    contrast: { label: '对比度', min: 0.8, max: 1.8, step: 0.01, tip: '1.0为原始对比度' },
    warmth: { label: '暖色调强度', min: 0, max: 50, step: 1, tip: '提升暖调，增加红通道' },
    sharpness: { label: '锐化强度', min: 0, max: 3, step: 0.1, tip: '0为不锐化' },
  },
  layer1: {
    gamma: { label: 'Gamma 校正', min: 0.5, max: 2.5, step: 0.05, tip: '>1 压暗中间调' },
    contrast: { label: '对比度', min: 0.8, max: 2.0, step: 0.05, tip: '增加层次感' },
    blurRadius: { label: '模糊半径', min: 0, max: 5, step: 0.1, tip: '像素，柔化边缘' },
    shadowCrush: { label: '暗部压黑', min: 0, max: 1, step: 0.01, tip: '让暗部更黑' },
    edgeStrength: { label: '边缘细节', min: 0, max: 1, step: 0.01, tip: '叠加边缘信息' },
  },
  layer2: {
    gamma: { label: 'Gamma 校正', min: 0.5, max: 2.5, step: 0.05, tip: '> 1 让亮部更突出' },
    contrast: { label: '对比度', min: 0.8, max: 1.8, step: 0.05, tip: '整体氛围对比' },
    blurRadius: { label: '模糊半径', min: 1, max: 15, step: 0.5, tip: '比第一层更柔和' },
    atmosphereStrength: { label: '氛围强度', min: 0, max: 1, step: 0.01, tip: '整体发光感' },
    highlightSpread: { label: '亮部扩散', min: 0, max: 1, step: 0.01, tip: '高光晕散程度' },
  },
} as const
