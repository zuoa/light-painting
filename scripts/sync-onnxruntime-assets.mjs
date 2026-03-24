import { createHash } from 'node:crypto'
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const sourceDir = path.join(rootDir, 'node_modules', 'onnxruntime-web', 'dist')
const targetDir = path.join(rootDir, 'public', 'onnxruntime-web')
const backgroundRemovalDir = path.join(rootDir, 'public', 'background-removal')
const resourceMapPath = path.join(backgroundRemovalDir, 'resources.json')
const CHUNK_SIZE = 4 * 1024 * 1024

const ORT_ASSETS = [
  {
    resourceKey: '/onnxruntime-web/ort-wasm-simd-threaded.mjs',
    filename: 'ort-wasm-simd-threaded.mjs',
    mime: 'text/javascript',
  },
  {
    resourceKey: '/onnxruntime-web/ort-wasm-simd-threaded.wasm',
    filename: 'ort-wasm-simd-threaded.wasm',
    mime: 'application/wasm',
  },
  {
    resourceKey: '/onnxruntime-web/ort-wasm-simd-threaded.jsep.mjs',
    filename: 'ort-wasm-simd-threaded.jsep.mjs',
    mime: 'text/javascript',
  },
  {
    resourceKey: '/onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm',
    filename: 'ort-wasm-simd-threaded.jsep.wasm',
    mime: 'application/wasm',
  },
]

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

await mkdir(targetDir, { recursive: true })

for (const { filename } of ORT_ASSETS) {
  await cp(path.join(sourceDir, filename), path.join(targetDir, filename), { force: true })
}

const resourceMap = JSON.parse(await readFile(resourceMapPath, 'utf8'))

for (const { resourceKey, filename, mime } of ORT_ASSETS) {
  const sourceBuffer = await readFile(path.join(sourceDir, filename))
  const chunks = []

  for (let offset = 0; offset < sourceBuffer.length; offset += CHUNK_SIZE) {
    const chunkBuffer = sourceBuffer.subarray(offset, Math.min(sourceBuffer.length, offset + CHUNK_SIZE))
    const hash = sha256(chunkBuffer)
    const chunkPath = path.join(backgroundRemovalDir, hash)

    await writeFile(chunkPath, chunkBuffer)
    chunks.push({
      hash,
      name: hash,
      offsets: [offset, offset + chunkBuffer.length],
    })
  }

  resourceMap[resourceKey] = {
    chunks,
    size: sourceBuffer.length,
    mime,
  }
}

await writeFile(resourceMapPath, `${JSON.stringify(resourceMap, null, 2)}\n`)

console.log(`Synced onnxruntime-web assets to ${path.relative(rootDir, targetDir)}`)
console.log(`Updated ${path.relative(rootDir, resourceMapPath)} with current onnxruntime chunks`)
