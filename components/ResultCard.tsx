'use client'

import { Download } from './Icons'

interface ResultCardProps {
  title: string
  subtitle?: string
  imageSrc: string | null
  filename: string
  isLoading?: boolean
}

export function ResultCard({ title, subtitle, imageSrc, filename, isLoading }: ResultCardProps) {
  const handleDownload = () => {
    if (!imageSrc) return
    const link = document.createElement('a')
    link.href = imageSrc
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="px-4 py-3 border-b border-surface-2 flex justify-between items-center">
        <div>
          <h3 className="font-medium text-primary text-sm">{title}</h3>
          {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
        </div>
        {imageSrc && !isLoading && (
          <button
            onClick={handleDownload}
            className="p-2 rounded-lg hover:bg-surface-2 transition-colors"
            title="下载图片"
          >
            <Download className="w-4 h-4 text-accent" />
          </button>
        )}
      </div>

      {/* Image */}
      <div className="aspect-[5/7] bg-surface-1 relative overflow-hidden">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="spinner text-accent" />
          </div>
        ) : imageSrc ? (
          <img
            src={imageSrc}
            alt={title}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted">
            <span className="text-sm">等待生成</span>
          </div>
        )}
      </div>
    </div>
  )
}
