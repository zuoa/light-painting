'use client'

import { useState } from 'react'
import type { ProcessResult } from '@/lib/types'
import { ResultCard } from './ResultCard'
import { ImageLightbox } from './ImageLightbox'

interface ResultGridProps {
  originalImage: string | null
  result: ProcessResult | null
  isLoading: boolean
}

export function ResultGrid({ originalImage, result, isLoading }: ResultGridProps) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [lightboxAlt, setLightboxAlt] = useState('')

  const openPreview = (src: string, alt: string) => {
    setLightboxSrc(src)
    setLightboxAlt(alt)
  }

  return (
    <>
      <div className="space-y-6">
        {/* Original Image */}
        <div>
          <h3 className="text-sm font-medium text-text-secondary mb-3">原始图片</h3>
          <div className="card max-w-sm">
            <div className="px-4 py-3 border-b border-surface-2">
              <h3 className="font-medium text-primary text-sm">原图</h3>
            </div>
            <div
              className={`aspect-[5/7] bg-surface-1 relative overflow-hidden ${originalImage ? 'cursor-zoom-in' : ''}`}
              onClick={() => originalImage && openPreview(originalImage, '原图')}
            >
              {originalImage ? (
                <>
                  <img
                    src={originalImage}
                    alt="Original"
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/30">
                    <span className="text-white text-xs bg-black/50 px-2 py-1 rounded">点击预览大图</span>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-muted">
                  <span className="text-sm">请上传图片</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Results Grid */}
        {(result || isLoading) && (
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-3">生成结果</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <ResultCard
                title="封面纸图"
                subtitle="Cover - 低饱和暖灰质感"
                imageSrc={result?.cover || null}
                filename="cover.png"
                isLoading={isLoading}
                onPreview={(src) => openPreview(src, '封面纸图')}
              />
              <ResultCard
                title="第一层透光层"
                subtitle="Layer 1 - 细节层"
                imageSrc={result?.layer1 || null}
                filename="layer1.png"
                isLoading={isLoading}
                onPreview={(src) => openPreview(src, '第一层透光层')}
              />
              <ResultCard
                title="第二层透光层"
                subtitle="Layer 2 - 氛围层"
                imageSrc={result?.layer2 || null}
                filename="layer2.png"
                isLoading={isLoading}
                onPreview={(src) => openPreview(src, '第二层透光层')}
              />
              <ResultCard
                title="预览图"
                subtitle="Preview - 叠加效果模拟"
                imageSrc={result?.preview || null}
                filename="preview.jpg"
                isLoading={isLoading}
                onPreview={(src) => openPreview(src, '预览图')}
              />
            </div>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxSrc && (
        <ImageLightbox
          src={lightboxSrc}
          alt={lightboxAlt}
          onClose={() => setLightboxSrc(null)}
        />
      )}
    </>
  )
}
