// Запись JSON так, чтобы диффы были читаемыми: объекты — построчно, а «плоские» массивы
// (строки, числа и массивы из них — т.е. ряд времени из шести ячеек) — в одну строку.
const flat = v => v === null || typeof v !== 'object' || (Array.isArray(v) && v.every(x => x === null || typeof x !== 'object' || (Array.isArray(x) && x.every(y => typeof y !== 'object' || y === null))))

export function formatJson(value, indent = '') {
  if (flat(value)) return JSON.stringify(value)
  const inner = indent + ' '
  if (Array.isArray(value)) return `[\n${value.map(v => inner + formatJson(v, inner)).join(',\n')}\n${indent}]`
  const entries = Object.entries(value).filter(([, v]) => v !== undefined)
  return `{\n${entries.map(([k, v]) => `${inner}${JSON.stringify(k)}: ${formatJson(v, inner)}`).join(',\n')}\n${indent}}`
}
