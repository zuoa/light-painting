'use client'

import type { ProcessParams, StylePreset } from '@/lib/types'
import { ParamSlider, ParamSection, Checkbox } from './ParamSlider'
import { PARAM_META } from '@/lib/defaults'
import { Settings } from './Icons'

interface ParamsPanelProps {
  params: ProcessParams
  onChange: (params: ProcessParams) => void
  presets: StylePreset[]
  selectedPreset: string
  onSelectPreset: (id: string) => void
}

export function ParamsPanel({
  params,
  onChange,
  presets,
  selectedPreset,
  onSelectPreset,
}: ParamsPanelProps) {
  const updateCover = (key: keyof ProcessParams['cover'], value: number) => {
    onChange({ ...params, cover: { ...params.cover, [key]: value } })
  }

  const updateLayer1 = (key: keyof ProcessParams['layer1'], value: number) => {
    onChange({ ...params, layer1: { ...params.layer1, [key]: value } })
  }

  const updateLayer2 = (key: keyof ProcessParams['layer2'], value: number) => {
    onChange({ ...params, layer2: { ...params.layer2, [key]: value } })
  }

  const updateCommon = (key: keyof ProcessParams['common'], value: any) => {
    onChange({ ...params, common: { ...params.common, [key]: value } })
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Settings className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-semibold text-primary">参数设置</h2>
        </div>

        {/* Style Presets */}
        <div className="mb-8">
          <h3 className="text-sm font-medium text-text-secondary mb-3">风格预设</h3>
          <div className="space-y-2">
            {presets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => onSelectPreset(preset.id)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selectedPreset === preset.id
                    ? 'bg-accent/10 border-accent'
                    : 'bg-surface-2 border-transparent hover:border-surface-3'
                }`}
              >
                <div className="font-medium text-primary text-sm">{preset.label}</div>
                <div className="text-xs text-muted mt-0.5">{preset.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Common Params */}
        <ParamSection title="通用参数">
          {/* Size preset */}
          <div className="mb-4">
            <div className="text-xs text-muted mb-2">输出尺寸</div>
            <div className="flex gap-2 mb-3">
              {(['7inch', '8inch', 'custom'] as const).map((preset) => (
                <button
                  key={preset}
                  onClick={() => updateCommon('sizePreset', preset)}
                  className={`flex-1 py-1.5 text-xs rounded-md border transition-all ${
                    params.common.sizePreset === preset
                      ? 'bg-accent/10 border-accent text-accent'
                      : 'bg-surface-2 border-transparent text-muted hover:border-surface-3'
                  }`}
                >
                  {preset === '7inch' ? '7寸' : preset === '8inch' ? '8寸' : '自定义'}
                </button>
              ))}
            </div>
            {params.common.sizePreset === 'custom' && (
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  value={params.common.customWidth}
                  onChange={(e) => updateCommon('customWidth', Number(e.target.value))}
                  className="w-full bg-surface-2 border border-surface-3 rounded-md px-2 py-1 text-xs text-primary"
                  placeholder="宽 px"
                  min={100}
                />
                <span className="text-muted text-xs">×</span>
                <input
                  type="number"
                  value={params.common.customHeight}
                  onChange={(e) => updateCommon('customHeight', Number(e.target.value))}
                  className="w-full bg-surface-2 border border-surface-3 rounded-md px-2 py-1 text-xs text-primary"
                  placeholder="高 px"
                  min={100}
                />
              </div>
            )}
            {params.common.sizePreset !== 'custom' && (
              <div className="text-xs text-muted">
                {params.common.sizePreset === '7inch' ? '1500 × 2100 px' : '1800 × 2400 px'}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Checkbox
              label="自动居中裁切"
              checked={params.common.autoCrop}
              onChange={(v) => updateCommon('autoCrop', v)}
            />
            <Checkbox
              label="反相透光层（白=透光）"
              checked={params.common.invertLayers}
              onChange={(v) => updateCommon('invertLayers', v)}
            />
            <Checkbox
              label="生成预览图"
              checked={params.common.generatePreview}
              onChange={(v) => updateCommon('generatePreview', v)}
            />
          </div>
        </ParamSection>

        {/* Cover Params */}
        <ParamSection title="封面纸参数">
          {Object.entries(PARAM_META.cover).map(([key, meta]) => (
            <ParamSlider
              key={key}
              label={meta.label}
              tip={meta.tip}
              min={meta.min}
              max={meta.max}
              step={meta.step}
              value={params.cover[key as keyof ProcessParams['cover']]}
              onChange={(v) => updateCover(key as keyof ProcessParams['cover'], v)}
            />
          ))}
        </ParamSection>

        {/* Layer 1 Params */}
        <ParamSection title="第一层透光层（细节层）">
          {Object.entries(PARAM_META.layer1).map(([key, meta]) => (
            <ParamSlider
              key={key}
              label={meta.label}
              tip={meta.tip}
              min={meta.min}
              max={meta.max}
              step={meta.step}
              value={params.layer1[key as keyof ProcessParams['layer1']]}
              onChange={(v) => updateLayer1(key as keyof ProcessParams['layer1'], v)}
            />
          ))}
        </ParamSection>

        {/* Layer 2 Params */}
        <ParamSection title="第二层透光层（氛围层）">
          {Object.entries(PARAM_META.layer2).map(([key, meta]) => (
            <ParamSlider
              key={key}
              label={meta.label}
              tip={meta.tip}
              min={meta.min}
              max={meta.max}
              step={meta.step}
              value={params.layer2[key as keyof ProcessParams['layer2']]}
              onChange={(v) => updateLayer2(key as keyof ProcessParams['layer2'], v)}
            />
          ))}
        </ParamSection>
      </div>
    </div>
  )
}
