import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const icons = [
  'nodes/SendCloud/sendcloud.svg',
  'nodes/SendCloudTrigger/sendcloud.svg',
]

for (const icon of icons) {
  const dest = join(root, 'dist', icon)
  mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(join(root, icon), dest)
}
