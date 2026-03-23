'use client'

import type { ProcessParams } from '@/lib/types'

interface ParamSliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  tip?: string
  onChange: (value: number) => void
}

export function ParamSlider({ label, value, min, max, step, tip, onChange }: ParamSliderProps) {
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1.5">
        <label className="text-sm font-medium text-text-secondary">{label}</label>
        <span className="text-sm font-mono text-accent">{value.toFixed(step < 0.1 ? 2 : 1)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
      {tip && <p className="text-xs text-muted mt-1">{tip}</p>}
    </div>
  )
}

interface ParamSectionProps {
  title: string
  children: React.ReactNode
}

export function ParamSection({ title, children }: ParamSectionProps) {
  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold text-primary mb-4 pb-2 border-b border-surface-3">{title}</h4>
      {children}
    </div>
  )
}

interface CheckboxProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export function Checkbox({ label, checked, onChange }: CheckboxProps) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className={`w-5 h-5 rounded border-2 transition-colors ${
            checked ? 'bg-accent border-accent' : 'border-surface-3 group-hover:border-accent'
          }`}
        >
          {checked && (
            <svg className="w-3 h-3 text-surface m-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>
      <span className="text-sm text-text-secondary group-hover:text-primary transition-colors">{label}</span>
    </label>
  )
}
