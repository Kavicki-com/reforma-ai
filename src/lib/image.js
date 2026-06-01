// Redimensiona/compacta uma imagem no navegador antes do upload.
// No plano free do Supabase não há transformação de imagem no servidor, então
// guardamos arquivos menores na origem — carregam rápido na tela interna e no link.
// Mantém a orientação (EXIF) e cai de volta no arquivo original se algo falhar
// (ex.: HEIC que o navegador não decodifica, ou resultado maior que o original).
export async function compressImage(file, { maxDim = 1600, quality = 0.8 } = {}) {
  if (!file?.type?.startsWith('image/')) return file
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality))
    if (!blob || blob.size >= file.size) return file
    const base = file.name.replace(/\.[^.]+$/, '')
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg' })
  } catch {
    return file
  }
}
