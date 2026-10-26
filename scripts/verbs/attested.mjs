// Чтение фильтра Блума src/Trale/Verbs/attested.bloom (его пишет build-attested.mjs): встречалась ли
// словоформа в настоящих текстах. Ответ «да» ошибочен примерно в 1 % случаев, «нет» — всегда верен.
// Формат и хеши — как в build-attested.mjs и AttestedForms.cs.
import { readFileSync } from 'fs'

export function loadAttested(file) {
  const buf = readFileSync(file)
  if (buf.toString('ascii', 0, 4) !== 'TBF1') throw new Error(`${file}: не фильтр TBF1`)
  const bits = buf.readUInt32LE(4), hashes = buf.readUInt8(8), filter = buf.subarray(9)
  const encoder = new TextEncoder()
  const fnv = (bytes, basis) => {
    let h = basis
    for (const b of bytes) { h ^= b; h = Math.imul(h, 0x01000193) }
    return h >>> 0
  }
  return word => {
    const bytes = encoder.encode(word)
    const h1 = fnv(bytes, 0x811c9dc5), h2 = fnv(bytes, 0x01000193) | 1
    for (let i = 0; i < hashes; i++) {
      const bit = (h1 + Math.imul(i, h2) >>> 0) % bits
      if (!(filter[bit >> 3] & (1 << (bit & 7)))) return false
    }
    return true
  }
}
