'use client'

import Compressor from 'compressorjs'

type CompressorOptions = NonNullable<ConstructorParameters<typeof Compressor>[1]>

export type ClientCompressOptions = Partial<
  Pick<CompressorOptions, 'quality' | 'maxWidth' | 'maxHeight' | 'mimeType' | 'convertSize'>
>

function blobOrFileToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsDataURL(blob)
  })
}

/** 上傳前壓縮，降低寫入 Supabase 的 payload，減少 statement timeout 風險。失敗時退回原圖。 */
export function compressImageFileToDataUrl(
  file: File,
  options?: ClientCompressOptions
): Promise<string> {
  return new Promise((resolve, reject) => {
    new Compressor(file, {
      quality: 0.82,
      maxWidth: 1920,
      maxHeight: 1920,
      checkOrientation: true,
      ...options,
      success: async (result) => {
        try {
          resolve(await blobOrFileToDataUrl(result))
        } catch (e) {
          reject(e)
        }
      },
      error: async () => {
        try {
          resolve(await blobOrFileToDataUrl(file))
        } catch (e) {
          reject(e)
        }
      },
    })
  })
}
