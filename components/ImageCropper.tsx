'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { OutputSize } from '@/lib/types'

interface ImageCropperProps {
  imageSrc: string
  outputSize: OutputSize
  onConfirm: (croppedDataUrl: string) => void
  onCancel: () => void
}

const FRAME_MAX_W = 460
const FRAME_MAX_H = 560
const MAX_SCALE_FACTOR = 8

// Simple state container to ensure width/height are always updated together
interface DisplayState {
  w: number
  h: number
  x: number
  y: number
}

export function ImageCropper({ imageSrc, outputSize, onConfirm: confirmCrop, onCancel }: ImageCropperProps) {
  const aspectRatio = outputSize.width / outputSize.height

  // Compute frame dimensions
  const frameW = Math.round(FRAME_MAX_H * aspectRatio > FRAME_MAX_W ? FRAME_MAX_W : FRAME_MAX_H * aspectRatio)
  const frameH = Math.round(frameW / aspectRatio)

  const [loaded, setLoaded] = useState(false)
  const [dragging, setDragging] = useState(false)

  // Core state - all derived from this
  const [display, setDisplay] = useState<DisplayState>({ w: 0, h: 0, x: 0, y: 0 })

  // Refs for event handlers
  const displayRef = useRef(display)
  const naturalRef = useRef({ w: 0, h: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const dragStartRef = useRef({ mx: 0, my: 0, dx: 0, dy: 0 })

  // Sync ref with state
  useEffect(() => { displayRef.current = display }, [display])

  // Initialize image
  useEffect(() => {
    setLoaded(false)
    const img = new Image()
    img.onload = () => {
      const nw = img.naturalWidth
      const nh = img.naturalHeight
      naturalRef.current = { w: nw, h: nh }

      // Initial scale to cover the frame
      const scale = Math.max(frameW / nw, frameH / nh)
      setDisplay({
        w: nw * scale,
        h: nh * scale,
        x: 0,
        y: 0,
      })
      setLoaded(true)
    }
    img.src = imageSrc
  }, [imageSrc, frameW, frameH])

  // Zoom handler
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const { w: nw, h: nh } = naturalRef.current
      const { w: cw, h: ch, x: cx, y: cy } = displayRef.current
      if (!nw || !nh || !cw || !ch) return

      // Current scale
      const curScale = cw / nw
      // Min scale to cover frame
      const minScale = Math.max(frameW / nw, frameH / nh)
      // Scale delta
      const delta = e.deltaY < 0 ? 1.1 : 1 / 1.1
      // New scale (clamped)
      const newScale = Math.max(minScale, Math.min(minScale * MAX_SCALE_FACTOR, curScale * delta))

      // Zoom towards mouse position
      const rect = el.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      // Frame center
      const centerX = frameW / 2
      const centerY = frameH / 2

      // Mouse position relative to image center
      const relX = mouseX - (centerX + cx)
      const relY = mouseY - (centerY + cy)

      // After zoom, adjust offset to keep mouse point stable
      const ratio = newScale / curScale
      const newW = nw * newScale
      const newH = nh * newScale
      const newX = cx - relX * (ratio - 1)
      const newY = cy - relY * (ratio - 1)

      // Clamp to bounds
      const maxX = Math.max(0, (newW - frameW) / 2)
      const maxY = Math.max(0, (newH - frameH) / 2)

      setDisplay({
        w: newW,
        h: newH,
        x: Math.max(-maxX, Math.min(maxX, newX)),
        y: Math.max(-maxY, Math.min(maxY, newY)),
      })
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [frameW, frameH])

  // Drag handlers
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setDragging(true)
    dragStartRef.current = { mx: e.clientX, my: e.clientY, dx: display.x, dy: display.y }
  }, [display.x, display.y])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return
    const { mx, my, dx, dy } = dragStartRef.current
    const { w: dw, h: dh } = displayRef.current

    const newX = dx + (e.clientX - mx)
    const newY = dy + (e.clientY - my)

    const maxX = Math.max(0, (dw - frameW) / 2)
    const maxY = Math.max(0, (dh - frameH) / 2)

    setDisplay(prev => ({
      ...prev,
      x: Math.max(-maxX, Math.min(maxX, newX)),
      y: Math.max(-maxY, Math.min(maxY, newY)),
    }))
  }, [dragging, frameW, frameH])

  const onMouseUp = useCallback(() => setDragging(false), [])

  // Touch support
  const touchRef = useRef({ x: 0, y: 0, dx: 0, dy: 0 })
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    const t = e.touches[0]
    touchRef.current = { x: t.clientX, y: t.clientY, dx: display.x, dy: display.y }
    setDragging(true)
  }, [display.x, display.y])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging || e.touches.length !== 1) return
    e.preventDefault()
    const t = e.touches[0]
    const { x: tx, y: ty, dx, dy } = touchRef.current
    const { w: dw, h: dh } = displayRef.current

    const newX = dx + (t.clientX - tx)
    const newY = dy + (t.clientY - ty)

    const maxX = Math.max(0, (dw - frameW) / 2)
    const maxY = Math.max(0, (dh - frameH) / 2)

    setDisplay(prev => ({
      ...prev,
      x: Math.max(-maxX, Math.min(maxX, newX)),
      y: Math.max(-maxY, Math.min(maxY, newY)),
    }))
  }, [dragging, frameW, frameH])

  // Crop
  const onConfirm = useCallback(() => {
    const { w: nw, h: nh } = naturalRef.current
    const { w: dw, h: dh, x, y } = displayRef.current
    if (!nw || !nh || !dw || !dh) return

    const scale = dw / nw

    const canvas = document.createElement('canvas')
    canvas.width = outputSize.width
    canvas.height = outputSize.height
    const ctx = canvas.getContext('2d')!

    // Crop region
    const cropX = nw / 2 - (frameW / 2 - x) / scale
    const cropY = nh / 2 - (frameH / 2 - y) / scale
    const cropW = frameW / scale
    const cropH = frameH / scale

    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, outputSize.width, outputSize.height)
      confirmCrop(canvas.toDataURL('image/png'))
    }
    img.src = imageSrc
  }, [imageSrc, frameW, frameH, outputSize, confirmCrop])

  // Calculate position
  const left = (frameW - display.w) / 2 + display.x
  const top = (frameH - display.h) / 2 + display.y

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
      <div className="bg-surface rounded-xl overflow-hidden shadow-2xl w-full max-w-lg">
        <div className="px-5 py-4 border-b border-surface-2">
          <h2 className="font-semibold text-primary text-base">裁剪图片</h2>
          <p className="text-xs text-muted mt-0.5">滚轮放大 · 拖拽移动 · {outputSize.label}</p>
        </div>

        <div className="py-5 flex justify-center bg-black/40">
          <div
            ref={containerRef}
            className="relative overflow-hidden select-none"
            style={{
              width: frameW,
              height: frameH,
              cursor: dragging ? 'grabbing' : 'grab',
              touchAction: 'none',
            }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onMouseUp}
          >
            {!loaded && (
              <div className="absolute inset-0 flex items-center justify-center text-muted text-sm">加载中...</div>
            )}

            {loaded && display.w > 0 && display.h > 0 && (
              <img
                src={imageSrc}
                alt="crop"
                draggable={false}
                className="absolute pointer-events-none select-none"
                style={{
                  left,
                  top,
                  width: display.w,
                  height: display.h,
                }}
              />
            )}

            {/* Border & Grid */}
            <div className="absolute inset-0 pointer-events-none border-2 border-accent/80" />
            <div className="absolute inset-0 pointer-events-none opacity-25">
              <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white" />
              <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white" />
              <div className="absolute top-1/3 left-0 right-0 h-px bg-white" />
              <div className="absolute top-2/3 left-0 right-0 h-px bg-white" />
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-surface-2 flex justify-end gap-3">
          <button onClick={onCancel} className="btn btn-secondary">跳过裁剪</button>
          <button onClick={onConfirm} className="btn btn-primary">确认裁剪</button>
        </div>
      </div>
    </div>
  )
}
