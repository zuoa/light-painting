'use client'

import { Download } from './Icons'

interface ResultCardProps {
  title: string
  subtitle?: string
  imageSrc: string | null
  filename: string
  isLoading?: boolean
  onPreview?: (src: string) => void
}

export function ResultCard({ title, subtitle, imageSrc, filename, isLoading, onPreview }: ResultCardProps) {
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
    <div className="card h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-surface-2 flex justify-between gap-3 min-h-[74px]">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-primary text-sm">{title}</h3>
          {subtitle && <p className="text-xs text-muted mt-0.5 leading-4">{subtitle}</p>}
        </div>
        {imageSrc && !isLoading && (
          <button
            onClick={handleDownload}
            className="p-2 rounded-lg hover:bg-surface-2 transition-colors self-start shrink-0"
            title="下载图片"
          >
            <Download className="w-4 h-4 text-accent" />
          </button>
        )}
      </div>

      {/* Image */}
      <div
        className={`aspect-[5/7] bg-surface-1 relative overflow-hidden flex-none ${imageSrc && !isLoading && onPreview ? 'cursor-zoom-in' : ''}`}
        onClick={() => imageSrc && !isLoading && onPreview?.(imageSrc)}
      >
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="spinner text-accent" />
          </div>
        ) : imageSrc ? (
          <>
            <img
              src={imageSrc}
              alt={title}
              className="w-full h-full object-contain"
            />
            {onPreview && (
              <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/30">
                <span className="text-white text-xs bg-black/50 px-2 py-1 rounded">点击预览大图</span>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted">
            <span className="text-sm">等待生成</span>
          </div>
        )}
      </div>
    </div>
  )
}
