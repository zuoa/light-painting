'use client'

import { useState, useCallback } from 'react'
import { UploadZone } from '@/components/UploadZone'
import { ParamsPanel } from '@/components/ParamsPanel'
import { ResultGrid } from '@/components/ResultGrid'
import { Download, Spinner } from '@/components/Icons'
import type { ProcessParams, ProcessResult } from '@/lib/types'
import { DEFAULT_PARAMS, STYLE_PRESETS } from '@/lib/defaults'
import { processImageBrowser } from '@/lib/imageProcessorBrowser'
import JSZip from 'jszip'

export default function Home() {
  // State
  const [originalImage, setOriginalImage] = useState<string | null>(null)
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [params, setParams] = useState<ProcessParams>(DEFAULT_PARAMS)
  const [selectedPreset, setSelectedPreset] = useState('portrait')
  const [result, setResult] = useState<ProcessResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Handle file upload
  const handleUpload = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      setOriginalImage(e.target?.result as string)
      setOriginalFile(file)
      setResult(null)
      setError(null)
    }
    reader.readAsDataURL(file)
  }, [])

  // Handle preset selection
  const handleSelectPreset = useCallback((id: string) => {
    const preset = STYLE_PRESETS.find((p) => p.id === id)
    if (preset) {
      setSelectedPreset(id)
      setParams(preset.params)
    }
  }, [])

  // Generate images (browser-side)
  const handleGenerate = useCallback(async () => {
    if (!originalFile) {
      setError('请先上传图片')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // 纯前端处理，图片不上传服务器
      const startTime = Date.now()
      const processed = await processImageBrowser(originalFile, params)
      const duration = Date.now() - startTime

      console.log(`[process] Image processed in ${duration}ms`)
      setResult(processed)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '生成失败，请重试'
      setError(msg)
      console.error('Generation error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [originalFile, params])

  // Download all as ZIP
  const handleDownloadAll = useCallback(async () => {
    if (!result) return

    try {
      const zip = new JSZip()

      // Add images to zip
      const addToZip = (dataUrl: string, filename: string) => {
        const base64 = dataUrl.split(',')[1]
        zip.file(filename, base64, { base64: true })
      }

      addToZip(result.cover, 'cover.png')
      addToZip(result.layer1, 'layer1.png')
      addToZip(result.layer2, 'layer2.png')
      addToZip(result.preview, 'preview.jpg')

      const content = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(content)

      const link = document.createElement('a')
      link.href = url
      link.download = 'light-painting.zip'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download error:', err)
      setError('下载失败，请重试')
    }
  }, [result])

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="bg-surface-1 border-b border-surface-2 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-primary">灯光画生成器</h1>
              <p className="text-xs text-muted mt-0.5">
                纯前端处理，图片不上传服务器 · 将照片转换为灯光画素材
              </p>
            </div>
            {result && (
              <button
                onClick={handleDownloadAll}
                className="btn btn-primary gap-2"
              >
                <Download className="w-4 h-4" />
                <span>打包下载</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Params Panel */}
          <div className="lg:col-span-1">
            <div className="card sticky top-24 max-h-[calc(100vh-8rem)] overflow-hidden">
              <ParamsPanel
                params={params}
                onChange={setParams}
                presets={STYLE_PRESETS}
                selectedPreset={selectedPreset}
                onSelectPreset={handleSelectPreset}
              />
            </div>
          </div>

          {/* Right: Upload and Results */}
          <div className="lg:col-span-2 space-y-6">
            {/* Upload Section */}
            <section>
              <h2 className="text-sm font-medium text-text-secondary mb-3">
                上传图片
              </h2>
              <UploadZone onUpload={handleUpload} />
            </section>

            {/* Generate Button */}
            {originalImage && (
              <div className="flex items-center gap-4">
                <button
                  onClick={handleGenerate}
                  disabled={isLoading}
                  className="btn btn-primary px-8 py-3 text-base"
                >
                  {isLoading ? (
                    <>
                      <Spinner className="w-5 h-5 mr-2" />
                      处理中...
                    </>
                  ) : (
                    result ? '重新生成' : '开始生成'
                  )}
                </button>
                {isLoading && (
                  <span className="text-sm text-muted">图像处理中，请稍候...</span>
                )}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Results */}
            <ResultGrid
              originalImage={originalImage}
              result={result}
              isLoading={isLoading}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-2 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-xs text-muted">
            灯光画生成器 · 纯前端处理，保护您的隐私
          </p>
        </div>
      </footer>
    </div>
  )
}
