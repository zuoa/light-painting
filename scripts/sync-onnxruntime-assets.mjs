import { cp, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const sourceDir = path.join(rootDir, 'node_modules', 'onnxruntime-web', 'dist')
const targetDir = path.join(rootDir, 'public', 'onnxruntime-web')

await mkdir(targetDir, { recursive: true })

for (const filename of [
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd-threaded.jsep.mjs',
  'ort-wasm-simd-threaded.jsep.wasm',
]) {
  await cp(path.join(sourceDir, filename), path.join(targetDir, filename), { force: true })
}

console.log(`Synced onnxruntime-web assets to ${path.relative(rootDir, targetDir)}`)
