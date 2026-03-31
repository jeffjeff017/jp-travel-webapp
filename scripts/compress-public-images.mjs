/**
 * 使用 sharp 批次壓縮 public/ 內 jpg/png/webp（略過 gif/svg）。
 * 執行：npm run compress-images
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.join(__dirname, '..', 'public')

const EXT = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const MAX_WIDTH = 2048

async function walk(dir) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) await walk(full)
    else if (EXT.has(path.extname(e.name).toLowerCase())) await optimizeFile(full)
  }
}

async function optimizeFile(filePath) {
  const buf = await fs.promises.readFile(filePath)
  const ext = path.extname(filePath).toLowerCase()
  const rel = path.relative(publicDir, filePath)

  // 副檔名為 .png 但內容為 GIF（動畫）時，sharp 會誤轉成靜態 PNG，務必略過
  const magic = buf.slice(0, 6).toString('ascii')
  if (ext === '.png' && magic.startsWith('GIF8')) {
    console.log(`略過（PNG 副檔名但為 GIF 動畫）: ${rel}`)
    return
  }

  const meta = await sharp(buf).metadata()
  const didResize = Boolean(meta.width && meta.width > MAX_WIDTH)
  let pipeline = sharp(buf).rotate()
  if (didResize) {
    pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true })
  }

  let out
  if (ext === '.png') {
    out = await pipeline.png({ compressionLevel: 9, effort: 10 }).toBuffer()
  } else if (ext === '.webp') {
    out = await pipeline.webp({ quality: 82 }).toBuffer()
  } else {
    out = await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer()
  }

  const before = buf.length
  const after = out.length
  if (!didResize && after >= before) {
    console.log(`略過（未變小）: ${rel}`)
    return
  }
  await fs.promises.writeFile(filePath, out)
  console.log(
    `${rel}: ${(before / 1024).toFixed(1)} KB → ${(after / 1024).toFixed(1)} KB`
  )
}

async function main() {
  try {
    await fs.promises.access(publicDir)
  } catch {
    console.error('public/ 不存在，略過')
    process.exit(0)
  }
  let count = 0
  const countWalk = async (dir) => {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true })
    for (const e of entries) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) await countWalk(full)
      else if (EXT.has(path.extname(e.name).toLowerCase())) count++
    }
  }
  await countWalk(publicDir)
  if (count === 0) {
    console.log('public/ 內沒有 jpg/png/webp，無需處理')
    return
  }
  console.log(`處理 ${count} 個檔案…`)
  await walk(publicDir)
  console.log('完成')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
