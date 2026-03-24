'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ManualMaskGuide } from '@/lib/types'

interface MaskEditorProps {
  imageSrc: string
  initialGuide: ManualMaskGuide | null
  onConfirm: (guide: ManualMaskGuide | null) => void
  onCancel: () => void
}

const FRAME_MAX_W = 460
const FRAME_MAX_H = 560
const DEFAULT_BRUSH_SIZE = 28

type BrushMode = 'keep' | 'remove'

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function createOffscreenCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

export function MaskEditor({ imageSrc, initialGuide, onConfirm, onCancel }: MaskEditorProps) {
  const [loaded, setLoaded] = useState(false)
  const [natural, setNatural] = useState({ w: 0, h: 0 })
  const [brushMode, setBrushMode] = useState<BrushMode>('remove')
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH_SIZE)
  const [hasKeepMask, setHasKeepMask] = useState(Boolean(initialGuide?.keepMask))
  const [hasRemoveMask, setHasRemoveMask] = useState(Boolean(initialGuide?.removeMask))

  const imageRef = useRef<HTMLImageElement | null>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const keepMaskRef = useRef<HTMLCanvasElement | null>(null)
  const removeMaskRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)

  const aspectRatio = useMemo(() => {
    return natural.w && natural.h ? natural.w / natural.h : 5 / 7
  }, [natural.h, natural.w])
  const frameH = Math.round(Math.min(FRAME_MAX_H, FRAME_MAX_W / aspectRatio))
  const frameW = Math.round(frameH * aspectRatio)

  const renderPreview = useCallback(() => {
    const previewCanvas = previewCanvasRef.current
    const keepMaskCanvas = keepMaskRef.current
    const removeMaskCanvas = removeMaskRef.current
    const image = imageRef.current
    if (!previewCanvas || !keepMaskCanvas || !removeMaskCanvas || !image || !natural.w || !natural.h) return

    const ctx = previewCanvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, frameW, frameH)
    ctx.drawImage(image, 0, 0, frameW, frameH)

    ctx.save()
    ctx.drawImage(keepMaskCanvas, 0, 0, frameW, frameH)
    ctx.drawImage(removeMaskCanvas, 0, 0, frameW, frameH)
    ctx.restore()
  }, [frameH, frameW, natural.h, natural.w])

  useEffect(() => {
    let disposed = false
    setLoaded(false)

    const image = new Image()
    image.onload = async () => {
      if (disposed) return

      imageRef.current = image
      setNatural({ w: image.naturalWidth, h: image.naturalHeight })

      const keepCanvas = createOffscreenCanvas(image.naturalWidth, image.naturalHeight)
      const removeCanvas = createOffscreenCanvas(image.naturalWidth, image.naturalHeight)
      keepMaskRef.current = keepCanvas
      removeMaskRef.current = removeCanvas

      const keepCtx = keepCanvas.getContext('2d')
      const removeCtx = removeCanvas.getContext('2d')
      if (!keepCtx || !removeCtx) return

      keepCtx.fillStyle = 'rgba(66, 211, 146, 0.42)'
      removeCtx.fillStyle = 'rgba(255, 99, 99, 0.42)'

      const loadMask = (src: string | null, target: CanvasRenderingContext2D) =>
        new Promise<void>((resolve) => {
          if (!src) {
            resolve()
            return
          }

          const maskImage = new Image()
          maskImage.onload = () => {
            target.clearRect(0, 0, image.naturalWidth, image.naturalHeight)
            target.drawImage(maskImage, 0, 0, image.naturalWidth, image.naturalHeight)
            resolve()
          }
          maskImage.onerror = () => resolve()
          maskImage.src = src
        })

      await Promise.all([
        loadMask(initialGuide?.keepMask ?? null, keepCtx),
        loadMask(initialGuide?.removeMask ?? null, removeCtx),
      ])

      setLoaded(true)
    }
    image.src = imageSrc

    return () => {
      disposed = true
    }
  }, [imageSrc, initialGuide?.keepMask, initialGuide?.removeMask])

  useEffect(() => {
    if (!loaded) return
    renderPreview()
  }, [brushMode, brushSize, frameH, frameW, loaded, renderPreview])

  const toCanvasPoint = useCallback((clientX: number, clientY: number) => {
    const canvas = previewCanvasRef.current
    if (!canvas || !natural.w || !natural.h) return null
    const rect = canvas.getBoundingClientRect()
    const scaleX = natural.w / rect.width
    const scaleY = natural.h / rect.height
    return {
      x: clamp((clientX - rect.left) * scaleX, 0, natural.w),
      y: clamp((clientY - rect.top) * scaleY, 0, natural.h),
    }
  }, [natural.h, natural.w])

  const drawStroke = useCallback((from: { x: number; y: number }, to: { x: number; y: number }) => {
    const targetCanvas = brushMode === 'keep' ? keepMaskRef.current : removeMaskRef.current
    const ctx = targetCanvas?.getContext('2d')
    if (!ctx) return

    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = brushMode === 'keep' ? 'rgba(66, 211, 146, 0.42)' : 'rgba(255, 99, 99, 0.42)'
    ctx.lineWidth = brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
    ctx.restore()

    if (brushMode === 'keep') setHasKeepMask(true)
    else setHasRemoveMask(true)

    renderPreview()
  }, [brushMode, brushSize, renderPreview])

  const handlePointerDown = useCallback((clientX: number, clientY: number) => {
    const point = toCanvasPoint(clientX, clientY)
    if (!point) return
    drawingRef.current = true
    lastPointRef.current = point
    drawStroke(point, point)
  }, [drawStroke, toCanvasPoint])

  const handlePointerMove = useCallback((clientX: number, clientY: number) => {
    if (!drawingRef.current || !lastPointRef.current) return
    const point = toCanvasPoint(clientX, clientY)
    if (!point) return
    drawStroke(lastPointRef.current, point)
    lastPointRef.current = point
  }, [drawStroke, toCanvasPoint])

  const stopDrawing = useCallback(() => {
    drawingRef.current = false
    lastPointRef.current = null
  }, [])

  const clearMask = useCallback((mode: BrushMode) => {
    const targetCanvas = mode === 'keep' ? keepMaskRef.current : removeMaskRef.current
    const ctx = targetCanvas?.getContext('2d')
    if (!ctx || !targetCanvas) return
    ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height)
    if (mode === 'keep') setHasKeepMask(false)
    else setHasRemoveMask(false)
    renderPreview()
  }, [renderPreview])

  const handleConfirm = useCallback(() => {
    const keepMask = hasKeepMask ? keepMaskRef.current?.toDataURL('image/png') ?? null : null
    const removeMask = hasRemoveMask ? removeMaskRef.current?.toDataURL('image/png') ?? null : null
    if (!keepMask && !removeMask) {
      onConfirm(null)
      return
    }
    onConfirm({ keepMask, removeMask })
  }, [hasKeepMask, hasRemoveMask, onConfirm])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
      <div className="bg-surface rounded-xl overflow-hidden shadow-2xl w-full max-w-xl">
        <div className="px-5 py-4 border-b border-surface-2">
          <h2 className="font-semibold text-primary text-base">封面抠图修正</h2>
          <p className="text-xs text-muted mt-0.5">绿色画保留 · 红色画去除 · 只影响封面纸图</p>
        </div>

        <div className="px-5 py-4 border-b border-surface-2 flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg overflow-hidden border border-surface-3">
            <button
              onClick={() => setBrushMode('keep')}
              className={`px-3 py-2 text-xs ${brushMode === 'keep' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-surface-2 text-muted'}`}
            >
              保留
            </button>
            <button
              onClick={() => setBrushMode('remove')}
              className={`px-3 py-2 text-xs ${brushMode === 'remove' ? 'bg-red-500/20 text-red-300' : 'bg-surface-2 text-muted'}`}
            >
              去除
            </button>
          </div>

          <label className="flex items-center gap-2 text-xs text-muted">
            画笔大小
            <input
              type="range"
              min={8}
              max={80}
              step={1}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
            />
            <span className="text-primary w-8 text-right">{brushSize}</span>
          </label>

          <button onClick={() => clearMask('keep')} className="btn btn-secondary text-xs px-3 py-2">
            清空保留
          </button>
          <button onClick={() => clearMask('remove')} className="btn btn-secondary text-xs px-3 py-2">
            清空去除
          </button>
        </div>

        <div className="py-5 flex justify-center bg-black/40">
          <div className="relative" style={{ width: frameW, height: frameH }}>
            {!loaded && (
              <div className="absolute inset-0 flex items-center justify-center text-muted text-sm">加载中...</div>
            )}
            <canvas
              ref={previewCanvasRef}
              width={frameW}
              height={frameH}
              className="block rounded cursor-crosshair touch-none"
              onMouseDown={(e) => handlePointerDown(e.clientX, e.clientY)}
              onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={(e) => {
                const touch = e.touches[0]
                if (!touch) return
                handlePointerDown(touch.clientX, touch.clientY)
              }}
              onTouchMove={(e) => {
                e.preventDefault()
                const touch = e.touches[0]
                if (!touch) return
                handlePointerMove(touch.clientX, touch.clientY)
              }}
              onTouchEnd={stopDrawing}
            />
            <div className="absolute inset-0 pointer-events-none border border-white/30 rounded" />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-surface-2 flex justify-between items-center gap-3">
          <div className="text-xs text-muted">
            {hasKeepMask || hasRemoveMask ? '已添加抠图修正标注' : '未添加任何标注'}
          </div>
          <div className="flex gap-3">
            <button onClick={onCancel} className="btn btn-secondary">取消</button>
            <button onClick={handleConfirm} className="btn btn-primary">保存修正</button>
          </div>
        </div>
      </div>
    </div>
  )
}
