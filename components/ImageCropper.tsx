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

// State: scale factor and offset from center
interface ViewState {
  scale: number // multiply natural size by this
  ox: number // offset x from center (pixels)
  oy: number // offset y from center (pixels)
}

export function ImageCropper({ imageSrc, outputSize, onConfirm: confirmCrop, onCancel }: ImageCropperProps) {
  const aspectRatio = outputSize.width / outputSize.height

  // Frame size that fits within max bounds
  const frameH = Math.round(Math.min(FRAME_MAX_H, FRAME_MAX_W / aspectRatio))
  const frameW = Math.round(frameH * aspectRatio)

  const [loaded, setLoaded] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [natural, setNatural] = useState({ w: 0, h: 0 }) // natural image size
  const [view, setView] = useState<ViewState>({ scale: 1, ox: 0, oy: 0 })

  const viewRef = useRef(view)
  const naturalRef = useRef({ w: 0, h: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const dragStartRef = useRef({ mx: 0, my: 0, ox: 0, oy: 0 })

  useEffect(() => { viewRef.current = view }, [view])

  // Load image and initialize
  useEffect(() => {
    setLoaded(false)
    const img = new Image()
    img.onload = () => {
      const nw = img.naturalWidth
      const nh = img.naturalHeight
      setNatural({ w: nw, h: nh })
      naturalRef.current = { w: nw, h: nh }

      // Initial scale: cover the frame
      const initScale = Math.max(frameW / nw, frameH / nh)
      setView({ scale: initScale, ox: 0, oy: 0 })
      setLoaded(true)
    }
    img.src = imageSrc
  }, [imageSrc, frameW, frameH])

  // Clamp offset to keep image covering the frame
  const clampOffset = useCallback((scale: number, ox: number, oy: number) => {
    const nw = naturalRef.current.w
    const nh = naturalRef.current.h
    if (!nw || !nh) return { ox, oy }

    const dw = nw * scale
    const dh = nh * scale

    // Allow panning until image edge reaches frame edge
    const maxOx = Math.max(0, (dw - frameW) / 2)
    const maxOy = Math.max(0, (dh - frameH) / 2)

    return {
      ox: Math.max(-maxOx, Math.min(maxOx, ox)),
      oy: Math.max(-maxOy, Math.min(maxOy, oy)),
    }
  }, [frameW, frameH])

  // Wheel zoom handler - zoom towards center of frame
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const nw = naturalRef.current.w
      const nh = naturalRef.current.h
      const { scale: curScale, ox: curOx, oy: curOy } = viewRef.current
      if (!nw || !nh) return

      // Min scale to cover frame
      const minScale = Math.max(frameW / nw, frameH / nh)

      // Calculate new scale
      const delta = e.deltaY < 0 ? 1.1 : 1 / 1.1
      const newScale = Math.max(minScale, Math.min(minScale * MAX_SCALE_FACTOR, curScale * delta))

      // Zoom towards mouse position relative to frame center
      const rect = el.getBoundingClientRect()
      const mouseX = e.clientX - rect.left - frameW / 2 // mouse x relative to center
      const mouseY = e.clientY - rect.top - frameH / 2 // mouse y relative to center

      // The point under mouse in image coordinates before zoom:
      // imgX = mouseX - curOx
      // After zoom: imgX = mouseX - newOx
      // We want: imgX / newScale = imgX / curScale (same point in image)
      // So: (mouseX - newOx) / newScale = (mouseX - curOx) / curScale
      // Solving: newOx = mouseX - (mouseX - curOx) * (newScale / curScale)

      const ratio = newScale / curScale
      const newOx = mouseX - (mouseX - curOx) * ratio
      const newOy = mouseY - (mouseY - curOy) * ratio

      const clamped = clampOffset(newScale, newOx, newOy)
      setView({ scale: newScale, ...clamped })
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [frameW, frameH, clampOffset])

  // Drag handlers
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setDragging(true)
    dragStartRef.current = { mx: e.clientX, my: e.clientY, ox: view.ox, oy: view.oy }
  }, [view.ox, view.oy])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return
    const { mx, my, ox, oy } = dragStartRef.current
    const dx = e.clientX - mx
    const dy = e.clientY - my
    const clamped = clampOffset(viewRef.current.scale, ox + dx, oy + dy)
    setView(prev => ({ ...prev, ...clamped }))
  }, [dragging, clampOffset])

  const onMouseUp = useCallback(() => setDragging(false), [])

  // Touch support
  const touchRef = useRef({ x: 0, y: 0, ox: 0, oy: 0 })
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    const t = e.touches[0]
    touchRef.current = { x: t.clientX, y: t.clientY, ox: view.ox, oy: view.oy }
    setDragging(true)
  }, [view.ox, view.oy])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging || e.touches.length !== 1) return
    e.preventDefault()
    const t = e.touches[0]
    const { x: tx, y: ty, ox, oy } = touchRef.current
    const dx = t.clientX - tx
    const dy = t.clientY - ty
    const clamped = clampOffset(viewRef.current.scale, ox + dx, oy + dy)
    setView(prev => ({ ...prev, ...clamped }))
  }, [dragging, clampOffset])

  // Calculate displayed image size and position
  const displayW = natural.w * view.scale
  const displayH = natural.h * view.scale
  const left = (frameW - displayW) / 2 + view.ox
  const top = (frameH - displayH) / 2 + view.oy

  // Crop handler
  const onConfirm = useCallback(() => {
    const nw = naturalRef.current.w
    const nh = naturalRef.current.h
    const { scale, ox, oy } = viewRef.current
    if (!nw || !nh) return

    const canvas = document.createElement('canvas')
    canvas.width = outputSize.width
    canvas.height = outputSize.height
    const ctx = canvas.getContext('2d')!

    // Calculate crop region in source image coordinates
    // Frame center maps to: image center + offset
    // Image center is at (nw/2, nh/2)
    // Displayed image is at: frame_center + ox - (displayW/2)
    // We want frame (0,0) to (frameW, frameH) mapped to canvas
    // Source point (sx, sy) that maps to frame point (fx, fy):
    // sx = nw/2 + ox/scale - frameW/(2*scale) + fx/scale
    const sx = nw / 2 + ox / scale - frameW / (2 * scale)
    const sy = nh / 2 + oy / scale - frameH / (2 * scale)
    const sw = frameW / scale
    const sh = frameH / scale

    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outputSize.width, outputSize.height)
      confirmCrop(canvas.toDataURL('image/png'))
    }
    img.src = imageSrc
  }, [imageSrc, frameW, frameH, outputSize, confirmCrop])

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

            {loaded && displayW > 0 && displayH > 0 && (
              <img
                src={imageSrc}
                alt="crop"
                draggable={false}
                className="absolute pointer-events-none select-none"
                style={{
                  left,
                  top,
                  width: displayW,
                  height: displayH,
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
