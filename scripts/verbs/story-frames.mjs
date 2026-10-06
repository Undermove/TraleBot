#!/usr/bin/env node
// Готовит кадры комикса к выкладке: из PNG делает три WebP на кадр (800, 480 и заглушку 32 px),
// считает хеш набора и кладёт файлы в src/Trale/miniapp-src/public/stories/<id>/<хеш>/.
// Хеш в пути меняется вместе с содержимым, поэтому кадры можно кэшировать навсегда.
// Запуск: node scripts/verbs/story-frames.mjs <id истории> <папка с f1.png… или с готовыми WebP>
// Печатает значение для поля "images" в src/Trale/Verbs/stories/<id>.json. Нужен cwebp (brew install webp).
import { execFileSync } from 'child_process'
import { createHash } from 'crypto'
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { basename, dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

const [id, from] = process.argv.slice(2)
if (!/^[a-z0-9-]+$/.test(id ?? '') || !from) {
  console.error('Запуск: node scripts/verbs/story-frames.mjs <id истории> <папка с кадрами>')
  process.exit(1)
}

const here = dirname(fileURLToPath(import.meta.url))
const publicDir = resolve(here, '../../src/Trale/miniapp-src/public/stories', id)
const work = mkdtempSync(join(tmpdir(), 'story-frames-'))

// Размеры и качество — те же команды записаны в src/Trale/Verbs/stories/README.md.
const SIZES = [
  { suffix: '800', args: ['-q', '82', '-resize', '800', '0'] },
  { suffix: '480', args: ['-q', '80', '-resize', '480', '0'] },
  { suffix: 'ph', args: ['-q', '30', '-resize', '32', '0'] }
]

for (const file of readdirSync(from).sort()) {
  if (file.endsWith('.webp')) copyFileSync(join(from, file), join(work, file))
  if (!file.endsWith('.png')) continue
  for (const { suffix, args } of SIZES) {
    execFileSync('cwebp', ['-quiet', ...args, join(from, file), '-o', join(work, `${basename(file, '.png')}-${suffix}.webp`)])
  }
}

const files = readdirSync(work).sort()
if (!files.length) {
  console.error(`В ${from} нет ни PNG, ни WebP`)
  process.exit(1)
}

// Тот же расчёт повторяет тест VerbStoryTests: имя файла, нулевой байт, содержимое — по порядку имён.
const hash = createHash('sha256')
for (const file of files) hash.update(file, 'utf8').update(Buffer.from([0])).update(readFileSync(join(work, file)))
const version = hash.digest('hex').slice(0, 10)

rmSync(publicDir, { recursive: true, force: true })
mkdirSync(join(publicDir, version), { recursive: true })
for (const file of files) copyFileSync(join(work, file), join(publicDir, version, file))
rmSync(work, { recursive: true, force: true })

console.error(`${files.length} файлов → ${join(publicDir, version)}`)
console.log(`"images": "${id}/${version}"`)
