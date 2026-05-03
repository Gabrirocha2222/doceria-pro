'use client'

import React, { useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Image as ImageIcon, Loader2, X } from 'lucide-react'

interface ImageUploadProps {
  value?: string | null
  onUpload: (url: string) => void
  onRemove: () => void
  disabled?: boolean
}

export function ImageUpload({ value, onUpload, onRemove, disabled }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  const supabase = createClient()

  const handleUpload = useCallback(
    async (file: File) => {
      if (disabled) return
      setError('')

      if (!file.type.startsWith('image/')) {
        setError('Por favor, selecione apenas imagens.')
        return
      }

      if (file.size > 5 * 1024 * 1024) {
        setError('A imagem deve ter no máximo 5MB.')
        return
      }

      setIsUploading(true)
      setProgress(0)

      let filePath = ''

      try {
        const { data: { user } } = await supabase.auth.getUser()
        const userId = user?.id || 'public'

        const fileExt = file.name.split('.').pop()
        const originalName = file.name.replace(/\.[^/.]+$/, "")
        
        const sanitizedName = originalName
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, '-')
          .replace(/[^a-zA-Z0-9-]/g, '')
          .toLowerCase()

        const uniqueId = typeof crypto !== 'undefined' && crypto.randomUUID 
          ? crypto.randomUUID() 
          : Math.random().toString(36).substring(2, 15)
        const timestamp = Date.now()
        
        const fileName = `${sanitizedName}-${uniqueId}.${fileExt}`
        filePath = `${userId}/pedidos/${timestamp}/${fileName}`

        // Simula progresso enquanto faz o upload
        const progressInterval = setInterval(() => {
          setProgress((prev) => (prev >= 90 ? 90 : prev + 10))
        }, 300)

        const { error: uploadError } = await supabase.storage
          .from('pedidos-fotos')
          .upload(filePath, file)

        clearInterval(progressInterval)

        if (uploadError) {
          throw uploadError
        }

        setProgress(100)

        const {
          data: { publicUrl },
        } = supabase.storage.from('pedidos-fotos').getPublicUrl(filePath)

        onUpload(publicUrl)
      } catch (err: any) {
        console.error('Erro ao fazer upload da imagem:', {
          message: err?.message,
          name: err?.name,
          statusCode: err?.statusCode,
          error: err?.error,
          details: err?.details,
          hint: err?.hint,
          code: err?.code,
          fullError: err,
          stringified: JSON.stringify(err, Object.getOwnPropertyNames(err), 2),
          debug: !err?.message ? {
            bucket: 'pedidos-fotos',
            path: filePath,
            originalName: file.name,
            type: file.type,
            size: file.size,
          } : undefined
        })
        setError(err?.message || 'Falha ao enviar imagem. Verifique se o bucket pedidos-fotos existe no Supabase Storage e se as políticas de upload foram aplicadas.')
      } finally {
        setIsUploading(false)
        setProgress(0)
      }
    },
    [disabled, onUpload, supabase]
  )

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleUpload(e.dataTransfer.files[0])
      }
    },
    [handleUpload]
  )

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleUpload(e.target.files[0])
      }
    },
    [handleUpload]
  )

  return (
    <div className="w-full">
      {value ? (
        <div className="relative inline-block w-full max-w-sm rounded-xl overflow-hidden border-2 border-[#C0392B]/20 bg-[#FAF6F0]">
          <img src={value} alt="Preview" className="w-full h-auto object-cover max-h-64" />
          {!disabled && (
            <button
              type="button"
              onClick={onRemove}
              className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-white text-red-600 rounded-full shadow-md transition-colors"
              title="Remover imagem"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`relative w-full rounded-xl border-2 border-dashed p-6 transition-all duration-200 flex flex-col items-center justify-center text-center cursor-pointer ${
            isDragging
              ? 'border-[#C0392B] bg-[#C0392B]/5'
              : disabled
              ? 'border-gray-300 bg-gray-50 opacity-60 cursor-not-allowed'
              : 'border-[#C0392B]/30 hover:border-[#C0392B]/60 hover:bg-[#FAF6F0]'
          }`}
        >
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onChange}
            disabled={disabled || isUploading}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />

          <div className="flex flex-col items-center space-y-3 pointer-events-none">
            {isUploading ? (
              <>
                <Loader2 className="w-10 h-10 text-[#C0392B] animate-spin" />
                <div className="text-sm font-medium text-[#C0392B]">Enviando...</div>
                <div className="w-full max-w-[200px] h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#C0392B] transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="p-3 bg-[#FAF6F0] rounded-full text-[#C0392B]">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <div className="text-sm font-medium text-gray-700">
                  <span className="text-[#C0392B]">Clique para upload</span> ou arraste a imagem
                </div>
                <div className="text-xs text-gray-500">JPG, PNG, WEBP até 5MB</div>
              </>
            )}
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
