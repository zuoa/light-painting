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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function ImageCropper({ imageSrc, outputSize, onConfirm: confirmCrop, onCancel }: ImageCropperProps) {
  const aspectRatio = outputSize.width / outputSize.height

  // Frame size that fits within max bounds while maintaining aspect ratio
  const frameH = Math.round(Math.min(FRAME_MAX_H, FRAME_MAX_W / aspectRatio))
  const frameW = Math.round(frameH * aspectRatio)

  const [loaded, setLoaded] = useState(false)
  const [dragging, setDragging] = useState(false)

  // Image natural size
  const [natural, setNatural] = useState({ w: 0, h: 0 })

  // View state: scale factor and offset from center
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  // Refs for drag gestures
  const dragStartRef = useRef({ mx: 0, my: 0, ox: 0, oy: 0 })

  // Load image
  useEffect(() => {
    setLoaded(false)
    const img = new Image()
    img.onload = () => {
      const nw = img.naturalWidth
      const nh = img.naturalHeight
      setNatural({ w: nw, h: nh })

      // Initial scale: cover the frame
      const initScale = Math.max(frameW / nw, frameH / nh)
      setScale(initScale)
      setOffset({ x: 0, y: 0 })
      setLoaded(true)
    }
    img.src = imageSrc
  }, [imageSrc, frameW, frameH])

  const onWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!natural.w || !natural.h) return

    const minScale = Math.max(frameW / natural.w, frameH / natural.h)
    const delta = e.deltaY < 0 ? 1.1 : 1 / 1.1
    const nextScale = clamp(scale * delta, minScale, minScale * MAX_SCALE_FACTOR)
    const ratio = nextScale / scale

    const nextDisplayW = natural.w * nextScale
    const nextDisplayH = natural.h * nextScale
    const maxOffsetX = Math.max(0, (nextDisplayW - frameW) / 2)
    const maxOffsetY = Math.max(0, (nextDisplayH - frameH) / 2)

    setScale(nextScale)
    setOffset({
      x: clamp(offset.x * ratio, -maxOffsetX, maxOffsetX),
      y: clamp(offset.y * ratio, -maxOffsetY, maxOffsetY),
    })
  }, [natural.w, natural.h, frameW, frameH, scale, offset])

  // Drag handlers
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setDragging(true)
    dragStartRef.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y }
  }, [offset.x, offset.y])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return
    const { mx, my, ox, oy } = dragStartRef.current
    const dx = e.clientX - mx
    const dy = e.clientY - my

    const displayW = natural.w * scale
    const displayH = natural.h * scale
    const maxOffsetX = Math.max(0, (displayW - frameW) / 2)
    const maxOffsetY = Math.max(0, (displayH - frameH) / 2)

    setOffset({
      x: clamp(ox + dx, -maxOffsetX, maxOffsetX),
      y: clamp(oy + dy, -maxOffsetY, maxOffsetY),
    })
  }, [dragging, natural.w, natural.h, scale, frameW, frameH])

  const onMouseUp = useCallback(() => setDragging(false), [])

  // Touch support
  const touchRef = useRef({ x: 0, y: 0, ox: 0, oy: 0 })
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    const t = e.touches[0]
    touchRef.current = { x: t.clientX, y: t.clientY, ox: offset.x, oy: offset.y }
    setDragging(true)
  }, [offset.x, offset.y])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging || e.touches.length !== 1) return
    e.preventDefault()
    const t = e.touches[0]
    const { x: tx, y: ty, ox, oy } = touchRef.current
    const dx = t.clientX - tx
    const dy = t.clientY - ty

    const displayW = natural.w * scale
    const displayH = natural.h * scale
    const maxOffsetX = Math.max(0, (displayW - frameW) / 2)
    const maxOffsetY = Math.max(0, (displayH - frameH) / 2)

    setOffset({
      x: clamp(ox + dx, -maxOffsetX, maxOffsetX),
      y: clamp(oy + dy, -maxOffsetY, maxOffsetY),
    })
  }, [dragging, natural.w, natural.h, scale, frameW, frameH])

  // Calculate displayed image size and position
  const displayW = natural.w * scale
  const displayH = natural.h * scale
  const left = (frameW - displayW) / 2 + offset.x
  const top = (frameH - displayH) / 2 + offset.y

  // Crop handler
  const onConfirm = useCallback(() => {
    if (!natural.w || !natural.h) return

    const canvas = document.createElement('canvas')
    canvas.width = outputSize.width
    canvas.height = outputSize.height
    const ctx = canvas.getContext('2d')!

    // Calculate crop region in source image coordinates
    // frame (0,0) corresponds to source:
    const sx = natural.w / 2 - offset.x / scale - frameW / (2 * scale)
    const sy = natural.h / 2 - offset.y / scale - frameH / (2 * scale)
    const sw = frameW / scale
    const sh = frameH / scale

    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outputSize.width, outputSize.height)
      confirmCrop(canvas.toDataURL('image/png'))
    }
    img.src = imageSrc
  }, [imageSrc, natural.w, natural.h, scale, offset, frameW, frameH, outputSize, confirmCrop])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
      <div className="bg-surface rounded-xl overflow-hidden shadow-2xl w-full max-w-lg">
        <div className="px-5 py-4 border-b border-surface-2">
          <h2 className="font-semibold text-primary text-base">裁剪图片</h2>
          <p className="text-xs text-muted mt-0.5">滚轮放大 · 拖拽移动 · {outputSize.label}</p>
        </div>

        <div className="py-5 flex justify-center bg-black/40">
          <div
            className="relative overflow-hidden select-none"
            style={{
              width: frameW,
              height: frameH,
              cursor: dragging ? 'grabbing' : 'grab',
              touchAction: 'none',
            }}
            onWheel={onWheel}
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
                  maxWidth: 'none',
                  maxHeight: 'none',
                  transformOrigin: 'center center',
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
