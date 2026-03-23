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

  const [imgSize, setImgSize] = useState({ w: 0, h: 0 })
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 })
  const offsetRef = useRef({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const scaleRef = useRef(1)
  const imgSizeRef = useRef({ w: 0, h: 0 })

  const clampOffset = useCallback(
    (ox: number, oy: number, sc: number, iw: number, ih: number) => {
      const maxOx = Math.max(0, (iw * sc - frameW) / 2)
      const maxOy = Math.max(0, (ih * sc - frameH) / 2)
      return {
        x: Math.max(-maxOx, Math.min(maxOx, ox)),
        y: Math.max(-maxOy, Math.min(maxOy, oy)),
      }
    },
    [frameW, frameH]
  )

  // Keep offsetRef in sync with offset state
  useEffect(() => { offsetRef.current = offset }, [offset])

  useEffect(() => {
    const img = new window.Image()
    img.onload = () => {
      const iw = img.naturalWidth
      const ih = img.naturalHeight
      setImgSize({ w: iw, h: ih })
      imgSizeRef.current = { w: iw, h: ih }
      const initScale = Math.max(frameW / iw, frameH / ih)
      setScale(initScale)
      scaleRef.current = initScale
      setOffset({ x: 0, y: 0 })
    }
    img.src = imageSrc
  }, [imageSrc, frameW, frameH])

  // Attach non-passive wheel listener
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const { w: iw, h: ih } = imgSizeRef.current
      if (iw === 0) return
      const minScale = Math.max(frameW / iw, frameH / ih)
      const maxScale = minScale * MAX_SCALE_FACTOR
      const delta = e.deltaY < 0 ? 1.1 : 1 / 1.1
      const newScale = Math.max(minScale, Math.min(maxScale, scaleRef.current * delta))
      scaleRef.current = newScale
      setScale(newScale)
      setOffset((prev) => clampOffset(prev.x, prev.y, newScale, iw, ih))
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [frameW, frameH, clampOffset])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsDragging(true)
      dragStart.current = {
        mx: e.clientX,
        my: e.clientY,
        ox: offsetRef.current.x,
        oy: offsetRef.current.y,
      }
    },
    []
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return
      const dx = e.clientX - dragStart.current.mx
      const dy = e.clientY - dragStart.current.my
      const { w: iw, h: ih } = imgSizeRef.current
      setOffset(clampOffset(dragStart.current.ox + dx, dragStart.current.oy + dy, scaleRef.current, iw, ih))
    },
    [isDragging, clampOffset]
  )

  const handleMouseUp = useCallback(() => setIsDragging(false), [])

  // Touch support
  const lastTouch = useRef({ x: 0, y: 0, ox: 0, oy: 0 })
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    const t = e.touches[0]
    lastTouch.current = { x: t.clientX, y: t.clientY, ox: offsetRef.current.x, oy: offsetRef.current.y }
    setIsDragging(true)
  }, [])

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length !== 1 || !isDragging) return
      e.preventDefault()
      const t = e.touches[0]
      const dx = t.clientX - lastTouch.current.x
      const dy = t.clientY - lastTouch.current.y
      const { w: iw, h: ih } = imgSizeRef.current
      setOffset(clampOffset(lastTouch.current.ox + dx, lastTouch.current.oy + dy, scaleRef.current, iw, ih))
    },
    [isDragging, clampOffset]
  )

  const handleConfirm = useCallback(() => {
    const { w: iw, h: ih } = imgSizeRef.current
    if (iw === 0) return
    const sc = scaleRef.current
    const canvas = document.createElement('canvas')
    canvas.width = outputSize.width
    canvas.height = outputSize.height
    const ctx = canvas.getContext('2d')!

    // Crop region in original image coordinates
    const cropX = iw / 2 - (frameW / 2 + offset.x) / sc
    const cropY = ih / 2 - (frameH / 2 + offset.y) / sc
    const cropW = frameW / sc
    const cropH = frameH / sc

    const img = new window.Image()
    img.onload = () => {
      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, outputSize.width, outputSize.height)
      onConfirm(canvas.toDataURL('image/png'))
    }
    img.src = imageSrc
  }, [imageSrc, offset, frameW, frameH, outputSize, onConfirm])

  // Image CSS position - use ref values for consistent calculations
  const { w: iw, h: ih } = imgSizeRef.current
  const sc = scaleRef.current
  const imgLeft = frameW / 2 + offset.x - iw * sc / 2
  const imgTop = frameH / 2 + offset.y - ih * sc / 2

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
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleMouseUp}
          >
            {iw > 0 && (
              <img
                src={imageSrc}
                alt="crop"
                draggable={false}
                style={{
                  position: 'absolute',
                  left: imgLeft,
                  top: imgTop,
                  width: iw * sc,
                  height: ih * sc,
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
