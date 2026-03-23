'use client'

import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload } from './Icons'

interface UploadZoneProps {
  onUpload: (file: File) => void
}

export function UploadZone({ onUpload }: UploadZoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onUpload(acceptedFiles[0])
      }
    },
    [onUpload]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    maxFiles: 1,
    multiple: false,
  })

  return (
    <div
      {...getRootProps()}
      className={`dropzone cursor-pointer p-10 text-center ${isDragActive ? 'drag-active' : 'hover:border-accent'}`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-4">
        <div className={`p-4 rounded-full transition-colors ${isDragActive ? 'bg-accent/20' : 'bg-surface-2'}`}>
          <Upload className="w-8 h-8 text-accent" />
        </div>
        <div>
          <p className="text-lg font-medium text-primary mb-1">
            {isDragActive ? '松开以上传图片' : '点击或拖拽上传图片'}
          </p>
          <p className="text-sm text-muted">
            支持 JPG、PNG、WebP 格式，最大 10MB
          </p>
        </div>
      </div>
    </div>
  )
}
