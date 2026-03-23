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

export function ImageCropper({ imageSrc, outputSize, onConfirm, onCancel }: ImageCropperProps) {
  const aspectRatio = outputSize.width / outputSize.height

  // Compute frame dimensions
  let frameW = FRAME_MAX_W
  let frameH = frameW / aspectRatio
  if (frameH > FRAME_MAX_H) {
    frameH = FRAME_MAX_H
    frameW = frameH * aspectRatio
  }
  frameW = Math.round(frameW)
  frameH = Math.round(frameH)

  const [imgLoaded, setImgLoaded] = useState(false)
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 })
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)

  // Refs for event handlers (avoid stale closures)
  const displaySizeRef = useRef({ w: 0, h: 0 })
  const offsetRef = useRef({ x: 0, y: 0 })
  const imgNaturalRef = useRef({ w: 0, h: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const dragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 })

  // Keep refs in sync with state
  useEffect(() => { displaySizeRef.current = displaySize }, [displaySize])
  useEffect(() => { offsetRef.current = offset }, [offset])

  const clampOffset = useCallback(
    (ox: number, oy: number, dw: number, dh: number) => {
      const maxOx = Math.max(0, (dw - frameW) / 2)
      const maxOy = Math.max(0, (dh - frameH) / 2)
      return {
        x: Math.max(-maxOx, Math.min(maxOx, ox)),
        y: Math.max(-maxOy, Math.min(maxOy, oy)),
      }
    },
    [frameW, frameH]
  )

  // Load image and set initial display size (fit to frame)
  useEffect(() => {
    setImgLoaded(false)
    const img = new window.Image()
    img.onload = () => {
      const iw = img.naturalWidth
      const ih = img.naturalHeight
      imgNaturalRef.current = { w: iw, h: ih }

      // Calculate scale to fit image in frame
      const scale = Math.max(frameW / iw, frameH / ih)
      const dw = iw * scale
      const dh = ih * scale

      setDisplaySize({ w: dw, h: dh })
      displaySizeRef.current = { w: dw, h: dh }
      setOffset({ x: 0, y: 0 })
      offsetRef.current = { x: 0, y: 0 }
      setImgLoaded(true)
    }
    img.src = imageSrc
  }, [imageSrc, frameW, frameH])

  // Wheel zoom handler
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const { w: iw, h: ih } = imgNaturalRef.current
      const { w: dw, h: dh } = displaySizeRef.current
      if (iw === 0 || ih === 0 || dw === 0 || dh === 0) return

      // Calculate min scale (fit to frame)
      const minScale = Math.max(frameW / iw, frameH / ih)
      const currentScale = dw / iw

      // Calculate new scale
      const delta = e.deltaY < 0 ? 1.1 : 1 / 1.1
      const newScale = Math.max(minScale, Math.min(minScale * MAX_SCALE_FACTOR, currentScale * delta))

      // Calculate zoom center relative to image
      const rect = el.getBoundingClientRect()
      const mouseX = e.clientX - rect.left - frameW / 2
      const mouseY = e.clientY - rect.top - frameH / 2

      // Zoom towards mouse pointer
      const newDw = iw * newScale
      const newDh = ih * newScale
      const scaleRatio = newScale / currentScale

      const newOx = mouseX - (mouseX - offsetRef.current.x) * scaleRatio
      const newOy = mouseY - (mouseY - offsetRef.current.y) * scaleRatio

      const clamped = clampOffset(newOx, newOy, newDw, newDh)

      setDisplaySize({ w: newDw, h: newDh })
      setOffset(clamped)
    }

    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [frameW, frameH, clampOffset])

  // Mouse drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    dragStart.current = {
      mx: e.clientX,
      my: e.clientY,
      ox: offsetRef.current.x,
      oy: offsetRef.current.y,
    }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return
    const dx = e.clientX - dragStart.current.mx
    const dy = e.clientY - dragStart.current.my
    const { w: dw, h: dh } = displaySizeRef.current
    setOffset(clampOffset(dragStart.current.ox + dx, dragStart.current.oy + dy, dw, dh))
  }, [isDragging, clampOffset])

  const handleMouseUp = useCallback(() => setIsDragging(false), [])

  // Touch support
  const lastTouch = useRef({ x: 0, y: 0, ox: 0, oy: 0 })
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    const t = e.touches[0]
    lastTouch.current = { x: t.clientX, y: t.clientY, ox: offsetRef.current.x, oy: offsetRef.current.y }
    setIsDragging(true)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1 || !isDragging) return
    e.preventDefault()
    const t = e.touches[0]
    const dx = t.clientX - lastTouch.current.x
    const dy = t.clientY - lastTouch.current.y
    const { w: dw, h: dh } = displaySizeRef.current
    setOffset(clampOffset(lastTouch.current.ox + dx, lastTouch.current.oy + dy, dw, dh))
  }, [isDragging, clampOffset])

  // Confirm crop
  const handleConfirm = useCallback(() => {
    const { w: iw, h: ih } = imgNaturalRef.current
    const { w: dw, h: dh } = displaySizeRef.current
    if (iw === 0 || ih === 0 || dw === 0 || dh === 0) return

    const scale = dw / iw

    const canvas = document.createElement('canvas')
    canvas.width = outputSize.width
    canvas.height = outputSize.height
    const ctx = canvas.getContext('2d')!

    // Calculate crop region in original image coordinates
    const cropX = iw / 2 - (frameW / 2 - offset.x) / scale
    const cropY = ih / 2 - (frameH / 2 - offset.y) / scale
    const cropW = frameW / scale
    const cropH = frameH / scale

    const img = new window.Image()
    img.onload = () => {
      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, outputSize.width, outputSize.height)
      onConfirm(canvas.toDataURL('image/png'))
    }
    img.src = imageSrc
  }, [imageSrc, offset, frameW, frameH, outputSize, onConfirm])

  // Image position
  const imgLeft = (frameW - displaySize.w) / 2 + offset.x
  const imgTop = (frameH - displaySize.h) / 2 + offset.y

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
      <div className="bg-surface rounded-xl overflow-hidden shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="px-5 py-4 border-b border-surface-2">
          <h2 className="font-semibold text-primary text-base">裁剪图片</h2>
          <p className="text-xs text-muted mt-0.5">
            滚轮放大 · 拖拽移动 · {outputSize.label}
          </p>
        </div>

        {/* Crop frame */}
        <div className="py-5 flex justify-center bg-black/40">
          <div
            ref={containerRef}
            style={{
              width: frameW,
              height: frameH,
              position: 'relative',
              overflow: 'hidden',
              cursor: isDragging ? 'grabbing' : 'grab',
              userSelect: 'none',
              touchAction: 'none',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleMouseUp}
          >
            {!imgLoaded && (
              <div className="absolute inset-0 flex items-center justify-center text-muted text-sm">
                加载中...
              </div>
            )}
            {imgLoaded && displaySize.w > 0 && displaySize.h > 0 && (
              <img
                src={imageSrc}
                alt="crop"
                draggable={false}
                style={{
                  position: 'absolute',
                  left: imgLeft,
                  top: imgTop,
                  width: displaySize.w,
                  height: displaySize.h,
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              />
            )}
            {/* Border */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                border: '2px solid rgba(200,169,110,0.8)',
                pointerEvents: 'none',
              }}
            />
            {/* Rule-of-thirds grid */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.25 }}>
              <div style={{ position: 'absolute', left: '33.33%', top: 0, bottom: 0, width: 1, background: 'white' }} />
              <div style={{ position: 'absolute', left: '66.66%', top: 0, bottom: 0, width: 1, background: 'white' }} />
              <div style={{ position: 'absolute', top: '33.33%', left: 0, right: 0, height: 1, background: 'white' }} />
              <div style={{ position: 'absolute', top: '66.66%', left: 0, right: 0, height: 1, background: 'white' }} />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-surface-2 flex justify-end gap-3">
          <button onClick={onCancel} className="btn btn-secondary">
            跳过裁剪
          </button>
          <button onClick={handleConfirm} className="btn btn-primary">
            确认裁剪
          </button>
        </div>
      </div>
    </div>
  )
}
